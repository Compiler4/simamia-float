import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}
function optionalText(value: unknown) { const result = String(value ?? "").trim(); return result || null; }

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["STAFF"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Expense amount must be greater than zero.");
    const companyId = String(auth.user.companyId);
    const requestRow = await prisma.$transaction(async (tx: any) => {
      const created = await tx.accountantExpenseRequest.create({
        data: {
          companyId,
          staffId: String(auth.user!.id),
          category: requiredText(body.category, "Expense category"),
          requestedAction: optionalText(body.requestedAction),
          description: requiredText(body.description, "Expense purpose"),
          amount,
          expenseDate: body.expenseDate ? new Date(String(body.expenseDate)) : new Date(),
          receiptUrl: optionalText(body.receiptUrl),
          requestMode: "STAFF_REQUEST",
        },
      });
      await createNotification(tx, {
        companyId,
        roleTarget: "ACCOUNTANT",
        title: "New STAFF expense request",
        message: `${requiredText(body.category, "Expense category")} request for TZS ${amount.toLocaleString("en-TZ")}.`,
        type: "INFO",
      });
      return created;
    });
    return NextResponse.json({ success: true, message: "Expense request submitted for Company Admin and Accountant review.", expense: requestRow }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Expense request failed." }, { status: 400 });
  }
}
