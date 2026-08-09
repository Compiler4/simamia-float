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
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Deposit amount must be greater than zero.");
    const companyId = String(auth.user.companyId);
    const deposit = await prisma.$transaction(async (tx: any) => {
      const created = await tx.accountantBankDeposit.create({
        data: {
          companyId,
          staffId: String(auth.user!.id),
          amount,
          referenceNo: requiredText(body.referenceNo, "Reference number"),
          depositDate: new Date(requiredText(body.depositDate, "Deposit date")),
          bankAccount: requiredText(body.bankAccount, "Bank account"),
          depositSlipUrl: optionalText(body.depositSlipUrl),
          bankReceiptUrl: optionalText(body.bankReceiptUrl),
        },
      });
      await createNotification(tx, {
        companyId,
        roleTarget: "ACCOUNTANT",
        title: "New STAFF bank deposit",
        message: `Deposit ${created.referenceNo} for TZS ${amount.toLocaleString("en-TZ")} needs reconciliation.`,
        type: "INFO",
      });
      return created;
    });
    return NextResponse.json({ success: true, message: "Bank deposit submitted for reconciliation.", deposit }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Bank deposit submission failed." }, { status: 400 });
  }
}
