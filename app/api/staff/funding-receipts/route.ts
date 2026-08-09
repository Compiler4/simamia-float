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

const staffRoles = ["STAFF", "BROKER", "GPS_MANAGER"];

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  try {
    const staff = await requirePortalRole(staffRoles);
    const rows = await (prisma as any).staffFundingReceipt.findMany({
      where: {
        companyId: staff.companyId,
        staffId: staff.id,
      },
      include: { accountant: true, networkLine: true },
      orderBy: [{ issuedAt: "desc" }],
      take: 500,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row: any) => ({
        ...row,
        floatAmount: Number(row.floatAmount),
        cashAmount: Number(row.cashAmount),
        totalAmount: Number(row.floatAmount) + Number(row.cashAmount),
      })),
    });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json(
      { success: false, message: mapped.message },
      { status: mapped.status },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requirePortalRole(staffRoles);
    const body = await request.json();
    const receiptId = text(body.receiptId);
    const decision = text(body.decision).toUpperCase();
    const reason = text(body.reason);

    if (!receiptId || !["CONFIRMED", "REJECTED"].includes(decision)) {
      throw new PortalHttpError("Funding receipt and decision are required.", 400);
    }
    if (decision === "REJECTED" && !reason) {
      throw new PortalHttpError("Enter a rejection reason.", 400);
    }

    const receipt = await (prisma as any).staffFundingReceipt.findFirst({
      where: {
        id: receiptId,
        companyId: staff.companyId,
        staffId: staff.id,
        status: "PENDING",
      },
    });
    if (!receipt) {
      throw new PortalHttpError("Pending funding receipt not found.", 404);
    }

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const result = await tx.staffFundingReceipt.update({
        where: { id: receipt.id },
        data: {
          status: decision,
          confirmedAt: decision === "CONFIRMED" ? new Date() : null,
          rejectedAt: decision === "REJECTED" ? new Date() : null,
          note: reason || receipt.note,
        },
      });

      if (receipt.floatTransactionId) {
        await tx.floatTransaction.update({
          where: { id: receipt.floatTransactionId },
          data: {
            status: decision === "CONFIRMED" ? "CONFIRMED" : "REJECTED",
            confirmedAt: decision === "CONFIRMED" ? new Date() : null,
          },
        });
      }

      return result;
    });

    await notifyUser(prisma as any, {
      companyId: staff.companyId,
      userId: String(receipt.accountantId),
      title: `Staff funding ${decision.toLowerCase()}`,
      message: `${staff.name} ${decision.toLowerCase()} funding receipt ${receipt.referenceNo}.${reason ? ` ${reason}` : ""}`,
      type: decision === "CONFIRMED" ? "SUCCESS" : "ERROR",
    });

    return NextResponse.json({
      success: true,
      message: `Funding ${decision.toLowerCase()} successfully.`,
      row: updated,
    });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json(
      { success: false, message: mapped.message },
      { status: mapped.status },
    );
  }
}
