import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/accountant-v3/guard";
import { jsonError, optionalText, positiveAmount, requiredText } from "@/lib/accountant-v3/http";
import { notifyRoles } from "@/lib/accountant-v3/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireStaff();
    const db = prisma as any;
    const packets = await db.accountantVerificationPacket.findMany({
      where: { companyId: user.companyId, staffId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const bankComparisons = await db.accountantBankComparison.findMany({
      where: { companyId: user.companyId, staffId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, packets, bankComparisons });
  } catch (error) {
    return jsonError(error, "Your verification records could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    const db = prisma as any;
    const body = await request.json();
    const action = String(body.action ?? "SUBMIT_PACKET").toUpperCase();

    if (action === "SUBMIT_PACKET") {
      const kind = requiredText(body.kind, "Verification type").toUpperCase();
      if (!["SMS", "PROOF", "DOCUMENT", "BANK_REFERENCE"].includes(kind)) {
        throw new Error("Verification type must be SMS, PROOF, DOCUMENT or BANK_REFERENCE.");
      }
      const staffMessage = optionalText(body.staffMessage);
      const staffFileUrl = optionalText(body.staffFileUrl);
      if (!staffMessage && !staffFileUrl) {
        throw new Error("Upload a file or enter the SMS/message content.");
      }

      const packet = await db.accountantVerificationPacket.create({
        data: {
          companyId: user.companyId,
          staffId: user.id,
          staffFileId: optionalText(body.staffFileId),
          kind,
          staffMessage,
          staffFileUrl,
          status: "WAITING_ADMIN_REFERENCE",
        },
      });

      await notifyRoles({
        companyId: user.companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
        title: "Staff verification upload received",
        message: `${user.name} uploaded a ${kind.toLowerCase()} for Company Admin reference and Accountant review.`,
        type: "INFO",
      });

      return NextResponse.json({
        success: true,
        packet,
        message: "Your upload was sent for Company Admin reference and Accountant verification.",
      });
    }

    if (action === "SUBMIT_BANK_PROOF") {
      const staffAmount = positiveAmount(body.staffAmount, "Deposit amount");
      const staffReference = requiredText(body.staffReference, "Deposit reference");
      const staffBankAccount = requiredText(body.staffBankAccount, "Bank account");
      const staffFileUrl = requiredText(body.staffFileUrl, "Bank proof file");
      const depositId = optionalText(body.depositId);
      const existing = depositId
        ? await db.accountantBankComparison.findFirst({
            where: { companyId: user.companyId, depositId, staffId: user.id },
          })
        : null;
      const data = {
        companyId: user.companyId,
        depositId,
        staffId: user.id,
        staffAmount,
        staffReference,
        staffDate: body.staffDate ? new Date(String(body.staffDate)) : new Date(),
        staffBankAccount,
        staffFileUrl,
        accountantDecision: "PENDING",
        mismatchReason: null,
        reviewedById: null,
        reviewedAt: null,
      };
      const comparison = existing
        ? await db.accountantBankComparison.update({
            where: { id: existing.id },
            data,
          })
        : await db.accountantBankComparison.create({ data });

      await notifyRoles({
        companyId: user.companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
        title: "Staff bank proof received",
        message: `${user.name} uploaded bank proof ${staffReference}. Company Admin must attach the bank reference before Accountant verification.`,
        type: "INFO",
      });

      return NextResponse.json({
        success: true,
        comparison,
        message: "Bank proof was uploaded for reconciliation.",
      });
    }

    return NextResponse.json(
      { success: false, message: `Unsupported action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return jsonError(error, "The staff verification upload could not be saved.");
  }
}
