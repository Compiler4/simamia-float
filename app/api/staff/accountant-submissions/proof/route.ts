import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredText(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!result) throw new Error(`${label} is required.`); return result; }
function optionalText(value: unknown) { const result = String(value ?? "").trim(); return result || null; }

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["STAFF"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const companyId = String(auth.user.companyId);
    const proof = await prisma.$transaction(async (tx: any) => {
      const created = await tx.accountantStaffProof.create({
        data: {
          companyId,
          staffId: String(auth.user!.id),
          kind: String(body.kind ?? "SMS").trim().toUpperCase(),
          referenceNo: requiredText(body.referenceNo, "Reference number"),
          transactionId: optionalText(body.transactionId),
          amount: Number(body.amount ?? 0),
          senderName: optionalText(body.senderName),
          receiverName: optionalText(body.receiverName),
          transactionAt: body.transactionAt ? new Date(String(body.transactionAt)) : null,
          smsText: optionalText(body.smsText),
          proofUrl: optionalText(body.proofUrl),
        },
      });
      await createNotification(tx, {
        companyId,
        roleTarget: "ACCOUNTANT",
        title: "STAFF proof uploaded",
        message: `A new ${created.kind.toLowerCase()} proof (${created.referenceNo}) needs comparison with a Company Admin packet.`,
        type: "INFO",
      });
      return created;
    });
    return NextResponse.json({ success: true, message: "Proof uploaded for verification.", proof }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Proof upload failed." }, { status: 400 });
  }
}
