import { type NextRequest, NextResponse } from "next/server";

import { requirePortalRole } from "@/lib/accountant/auth";
import { decideExpense } from "@/lib/accountant/expense-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["COMPANY_ADMIN"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const body = await request.json();
    const decision = text(body.decision, "Decision").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(decision)) throw new Error("Decision must be APPROVED or REJECTED.");

    const result = await decideExpense({
      companyId: String(auth.user.companyId),
      expenseId: text(body.expenseId, "Expense ID"),
      reviewerId: String(auth.user.id),
      reviewerRole: "COMPANY_ADMIN",
      decision: decision as "APPROVED" | "REJECTED",
      reason: text(body.reason, "Decision reason"),
    });

    return NextResponse.json({ success: true, message: `Company Admin decision saved. Final status: ${result.status}.` });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Expense decision failed." },
      { status: 400 },
    );
  }
}
