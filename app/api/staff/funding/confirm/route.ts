import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { asPortalError, PortalHttpError, requirePortalRole } from "@/lib/accountant-control/auth";
import { notifyUser } from "@/lib/accountant-control/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const staff = await requirePortalRole(["STAFF"]);
    const body = await request.json();
    const receiptId = String(body.receiptId ?? "").trim();
    if (!receiptId) throw new PortalHttpError("Funding receipt is required.", 400);

    const db = prisma as any;
    const receipt = await db.staffFundingReceipt.findFirst({
      where: { id: receiptId, companyId: staff.companyId, staffId: staff.id, status: "PENDING" },
    });
    if (!receipt) throw new PortalHttpError("Pending funding receipt not found.", 404);

    await db.$transaction(async (tx: any) => {
      await tx.staffFundingReceipt.update({
        where: { id: receipt.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (receipt.floatTransactionId) {
        await tx.floatTransaction.updateMany({
          where: { id: receipt.floatTransactionId, companyId: staff.companyId, toUserId: staff.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });
      }
    });

    await notifyUser(db, {
      companyId: staff.companyId,
      userId: receipt.accountantId,
      title: "Staff funding confirmed",
      message: `${staff.name} confirmed receipt of funding reference ${receipt.referenceNo}.`,
      type: "SUCCESS",
    });

    return NextResponse.json({ success: true, message: "Funding receipt confirmed." });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
