import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { calendarDateInDar, darDate } from "@/lib/accountant/date-range";
import { createNotification } from "@/lib/accountant/notifications";
import { getCompanyStaff } from "@/lib/accountant/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalise(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}
function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}
function sameDate(left: Date, right: Date) {
  return calendarDateInDar(left) === calendarDateInDar(right);
}

export async function GET() {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const companyId = String(auth.user.companyId);
    const staff = await getCompanyStaff(auth.user.companyId);
    const staffById = new Map(staff.map((row) => [row.id, row]));
    const deposits = await prisma.accountantBankDeposit.findMany({
      where: { companyId, staffId: { in: staff.map((row) => row.id) } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json({
      success: true,
      deposits: deposits.map((row: any) => ({
        ...row,
        amount: Number(row.amount),
        statementAmount: row.statementAmount == null ? null : Number(row.statementAmount),
        staff: staffById.get(row.staffId) ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Could not load deposits." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const companyId = String(auth.user.companyId);
    const depositId = requiredText(body.depositId, "Deposit ID");
    const deposit = await prisma.accountantBankDeposit.findFirst({ where: { id: depositId, companyId } });
    if (!deposit) throw new Error("Bank deposit was not found.");
    const packet = await prisma.accountantAdminPacket.findFirst({
      where: { companyId, targetType: "BANK_DEPOSIT", targetId: depositId },
      orderBy: { createdAt: "desc" },
    });
    const statementAmount = Number(body.statementAmount ?? 0);
    const statementReference = requiredText(body.statementReference, "Statement reference");
    const statementDate = darDate(requiredText(body.statementDate, "Statement date"));
    const statementBankAccount = requiredText(body.statementBankAccount, "Statement bank account");

    let status: string = "VERIFIED";
    if (!deposit.depositSlipUrl && !deposit.bankReceiptUrl) status = "MISSING_RECEIPT";
    else if (!packet) status = "MISSING_BANK_RECORD";
    else if (Number(deposit.amount) !== statementAmount) status = "AMOUNT_MISMATCH";
    else if (normalise(deposit.referenceNo) !== normalise(statementReference)) status = "REFERENCE_MISMATCH";
    else if (!sameDate(deposit.depositDate, statementDate)) status = "DATE_MISMATCH";
    else if (normalise(deposit.bankAccount) !== normalise(statementBankAccount)) status = "ACCOUNT_MISMATCH";

    const reason = status === "VERIFIED"
      ? "The staff deposit matches the bank statement and Company Admin comparison packet."
      : `Reconciliation result: ${status.replaceAll("_", " ").toLowerCase()}.`;

    await prisma.$transaction(async (tx: any) => {
      await tx.accountantBankDeposit.update({
        where: { id: depositId },
        data: {
          statementAmount,
          statementReference,
          statementDate,
          statementBankAccount,
          bankStatementUrl: optionalText(body.bankStatementUrl),
          status,
          reviewReason: reason,
          reviewedById: String(auth.user!.id),
          reviewedAt: new Date(),
        },
      });
      if (packet) {
        await tx.accountantAdminPacket.update({
          where: { id: packet.id },
          data: {
            status: status === "VERIFIED" ? "VERIFIED" : "REJECTED",
            reviewReason: reason,
            reviewedById: String(auth.user!.id),
            reviewedAt: new Date(),
          },
        });
      }
      await createNotification(tx, {
        companyId,
        userId: deposit.staffId,
        title: status === "VERIFIED" ? "Bank deposit verified" : "Bank deposit needs correction",
        message: reason,
        type: status === "VERIFIED" ? "SUCCESS" : "ERROR",
      });
    });

    return NextResponse.json({ success: true, message: `Deposit comparison completed: ${status}.` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Verification failed." }, { status: 400 });
  }
}
