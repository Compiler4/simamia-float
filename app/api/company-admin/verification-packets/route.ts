import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  asPortalError,
  PortalHttpError,
  requirePortalRole,
} from "@/lib/accountant-control/auth";
import { notifyUser } from "@/lib/accountant-control/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  try {
    const admin = await requirePortalRole(["COMPANY_ADMIN"]);
    const db = prisma as any;
    const [packets, proofs, deposits, expenses, decisions] = await Promise.all([
      db.verificationPacket.findMany({
        where: { companyId: admin.companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.staffProofSubmission.findMany({
        where: { companyId: admin.companyId },
        include: { staff: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.bankDeposit.findMany({
        where: { companyId: admin.companyId },
        include: { staff: true },
        orderBy: { depositDate: "desc" },
        take: 5000,
      }),
      db.expense.findMany({
        where: { companyId: admin.companyId },
        include: { employee: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.approvalDecision.findMany({
        where: { companyId: admin.companyId, itemType: "EXPENSE" },
        orderBy: { decidedAt: "desc" },
        take: 10000,
      }),
    ]);
    return NextResponse.json({
      success: true,
      packets,
      proofs: proofs.map((row: any) => ({ ...row, amount: Number(row.amount) })),
      deposits: deposits.map((row: any) => ({ ...row, amount: Number(row.amount) })),
      expenses: expenses.map((row: any) => ({
        ...row,
        amount: Number(row.amount),
        decisions: decisions.filter((decision: any) => String(decision.itemId) === String(row.id)),
      })),
    });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePortalRole(["COMPANY_ADMIN"]);
    const body = await request.json();
    const targetType = text(body.targetType).toUpperCase();
    const targetId = text(body.targetId);
    const message = text(body.message);
    const attachmentUrl = text(body.attachmentUrl);

    if (!targetId || !message || !["STAFF_PROOF", "BANK_DEPOSIT", "EXPENSE", "OTHER"].includes(targetType)) {
      throw new PortalHttpError("Target, target type and verification message are required.", 400);
    }

    const db = prisma as any;
    let staffId: string | null = null;
    if (targetType === "STAFF_PROOF") {
      const proof = await db.staffProofSubmission.findFirst({
        where: { id: targetId, companyId: admin.companyId },
      });
      if (!proof) throw new PortalHttpError("Staff proof not found.", 404);
      staffId = String(proof.staffId);
    } else if (targetType === "BANK_DEPOSIT") {
      const deposit = await db.bankDeposit.findFirst({
        where: { id: targetId, companyId: admin.companyId },
      });
      if (!deposit) throw new PortalHttpError("Bank deposit not found.", 404);
      staffId = String(deposit.staffId);
    } else if (targetType === "EXPENSE") {
      const expense = await db.expense.findFirst({
        where: { id: targetId, companyId: admin.companyId },
      });
      if (!expense) throw new PortalHttpError("Expense request not found.", 404);
      staffId = String(expense.employeeId);
    }

    const packet = await db.verificationPacket.create({
      data: {
        companyId: admin.companyId,
        targetType,
        targetId,
        staffId,
        sentByAdminId: admin.id,
        sentByAdminName: admin.name,
        message,
        attachmentUrl: attachmentUrl || null,
        status: "PENDING",
      },
    });

    const accountants = await db.user.findMany({
      where: {
        companyId: admin.companyId,
        role: "ACCOUNTANT",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await Promise.all(
      accountants.map((accountant: any) =>
        notifyUser(db, {
          companyId: admin.companyId,
          userId: String(accountant.id),
          title: "Company Admin verification file received",
          message: `${admin.name} sent a ${targetType.replaceAll("_", " ").toLowerCase()} comparison packet: ${message}`,
          type: "INFO",
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      message: "Verification packet sent to the accountant.",
      packet,
    }, { status: 201 });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
