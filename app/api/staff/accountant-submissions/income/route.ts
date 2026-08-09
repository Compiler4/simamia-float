import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredText(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!result) throw new Error(`${label} is required.`); return result; }

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["STAFF"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Income amount must be greater than zero.");
    const entry = await prisma.accountantIncomeEntry.upsert({
      where: {
        companyId_referenceNo: {
          companyId: String(auth.user.companyId),
          referenceNo: requiredText(body.referenceNo, "Reference number"),
        },
      },
      update: {
        amount,
        serviceType: requiredText(body.serviceType, "Service type"),
        sourceType: String(body.sourceType ?? "STAFF_SERVICE"),
        sourceId: body.sourceId ? String(body.sourceId) : null,
        status: "COMPLETED",
        transactionAt: body.transactionAt ? new Date(String(body.transactionAt)) : new Date(),
      },
      create: {
        companyId: String(auth.user.companyId),
        staffId: String(auth.user.id),
        amount,
        serviceType: requiredText(body.serviceType, "Service type"),
        referenceNo: requiredText(body.referenceNo, "Reference number"),
        sourceType: String(body.sourceType ?? "STAFF_SERVICE"),
        sourceId: body.sourceId ? String(body.sourceId) : null,
        status: "COMPLETED",
        transactionAt: body.transactionAt ? new Date(String(body.transactionAt)) : new Date(),
      },
    });
    return NextResponse.json({ success: true, message: "Income entry recorded for financial and performance reports.", entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Income entry failed." }, { status: 400 });
  }
}
