import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { saveLocalUpload } from "@/lib/accountant/local-upload";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["STAFF"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const form = await request.formData();
    const fundingId = String(form.get("fundingId") ?? form.get("floatId") ?? "").trim();
    const returnedAmount = Number(form.get("returnedAmount") ?? 0);
    const file = form.get("file");

    if (!fundingId || !Number.isFinite(returnedAmount) || returnedAmount <= 0) {
      throw new Error("Funding record and a returned amount greater than zero are required.");
    }
    if (!(file instanceof File)) throw new Error("Choose a receipt file.");

    const companyId = String(auth.user.companyId);
    const staffId = String(auth.user.id);
    const funding = await prisma.accountantStaffFunding.findFirst({
      where: {
        id: fundingId,
        companyId,
        staffId,
        status: { in: ["ISSUED", "CONFIRMED", "REJECTED"] },
      },
    });
    if (!funding) throw new Error("The funding record was not found or cannot receive another return.");
    if (returnedAmount > Number(funding.totalAmount)) throw new Error("Returned amount cannot exceed the issued float plus cash.");

    const uploaded = await saveLocalUpload({ file, companyId, category: "float-receipts", maxBytes: 5 * 1024 * 1024 });
    const updated = await prisma.accountantStaffFunding.update({
      where: { id: funding.id },
      data: {
        receiptUrl: uploaded.url,
        returnedAmount,
        returnedAt: new Date(),
        returnReason: null,
        status: "RETURNED",
        verifiedById: null,
        verifiedAt: null,
      },
    });

    await createNotification(prisma, {
      companyId,
      roleTarget: "ACCOUNTANT",
      title: "STAFF funding receipt uploaded",
      message: `${String(auth.user.name ?? auth.user.username ?? auth.user.email ?? "STAFF user")} returned TZS ${returnedAmount.toLocaleString("en-TZ")} for ${funding.referenceNo}. Review the receipt in Float Returns.`,
      type: "INFO",
    });

    return NextResponse.json({ success: true, message: "Receipt uploaded and sent for accountant verification.", receiptUrl: uploaded.url, funding: updated });
  } catch (error) {
    console.error("[STAFF_FLOAT_RECEIPT]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "The float receipt could not be submitted." },
      { status: 400 },
    );
  }
}
