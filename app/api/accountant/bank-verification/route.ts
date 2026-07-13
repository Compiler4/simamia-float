import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyBankDeposit } from "@/lib/staff/bank";
import { dateAtNoon } from "@/lib/staff/time";

export const dynamic = "force-dynamic";

async function requireReviewer() {
  const session = (await getCurrentUser()) as any;
  if (!session) throw new Error("UNAUTHENTICATED");
  if (!["ACCOUNTANT", "COMPANY_ADMIN"].includes(String(session.role))) throw new Error("FORBIDDEN");
  if (!session.companyId) throw new Error("COMPANY_REQUIRED");
  return {
    id: String(session.id),
    name: String(session.name || session.username || "Reviewer"),
    companyId: String(session.companyId),
    role: String(session.role),
  };
}

function required(value: unknown, field: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`REQUIRED:${field}`);
  return result;
}

function amount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("INVALID_AMOUNT");
  return parsed;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNAUTHENTICATED") return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Accountant or Company Admin access is required." }, { status: 403 });
  if (message === "COMPANY_REQUIRED") return NextResponse.json({ success: false, message: "Your account is not attached to a company." }, { status: 403 });
  if (message === "DEPOSIT_NOT_FOUND") return NextResponse.json({ success: false, message: "Bank deposit not found." }, { status: 404 });
  if (message === "INVALID_AMOUNT" || message === "INVALID_DATE") return NextResponse.json({ success: false, message: "Enter a valid amount and deposit date." }, { status: 400 });
  if (message.startsWith("REQUIRED:")) return NextResponse.json({ success: false, message: `${message.split(":")[1]} is required.` }, { status: 400 });
  console.error("[ACCOUNTANT_BANK_VERIFICATION]", error);
  return NextResponse.json({ success: false, message: "Bank verification failed." }, { status: 500 });
}

export async function GET() {
  try {
    const session = await requireReviewer();
    const deposits = await (db as any).bankDeposit.findMany({
      where: { companyId: session.companyId },
      include: {
        staff: { select: { id: true, name: true, username: true, email: true, profileImageUrl: true } },
        accountant: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }],
      take: 3000,
    });
    return NextResponse.json({
      success: true,
      deposits: deposits.map((item: any) => ({
        ...item,
        amount: Number(item.amount),
        statementAmount: item.statementAmount == null ? null : Number(item.statementAmount),
        comparison: item.comparisonJson ? JSON.parse(item.comparisonJson) : null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireReviewer();
    const body = await request.json();
    const depositId = required(body.depositId, "depositId");
    const deposit = await (db as any).bankDeposit.findFirst({ where: { id: depositId, companyId: session.companyId } });
    if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");

    await (db as any).bankDeposit.update({
      where: { id: deposit.id },
      data: {
        statementAmount: amount(body.statementAmount),
        statementReference: required(body.statementReference, "statementReference"),
        statementDate: dateAtNoon(required(body.statementDate, "statementDate")),
        statementBankAccount: required(body.statementBankAccount, "statementBankAccount"),
        bankStatementUrl: String(body.bankStatementUrl || "").trim() || deposit.bankStatementUrl,
        accountantId: session.id,
      },
    });

    const result = await verifyBankDeposit(deposit.id, session.id);
    return NextResponse.json({
      success: true,
      message:
        result.status === "VERIFIED"
          ? "The deposit matches the bank record and is verified."
          : `The comparison detected a financial hold: ${result.comparison.mismatches.join("; ")}`,
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
