import { db } from "@/lib/db";
import { sendNotice, sendNoticeToRoles } from "./notify";
import { tzDateKey } from "./time";

function normalized(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function amount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type BankComparison = {
  amountMatch: boolean;
  referenceMatch: boolean;
  dateMatch: boolean;
  accountMatch: boolean;
  receiptPresent: boolean;
  statementPresent: boolean;
  mismatches: string[];
};

export function compareBankDeposit(deposit: any): BankComparison {
  const statementPresent =
    deposit.statementAmount != null ||
    Boolean(deposit.statementReference) ||
    Boolean(deposit.statementDate) ||
    Boolean(deposit.statementBankAccount) ||
    Boolean(deposit.bankStatementUrl);
  const amountMatch = statementPresent && amount(deposit.amount) === amount(deposit.statementAmount);
  const referenceMatch =
    statementPresent && normalized(deposit.referenceNo) === normalized(deposit.statementReference);
  const dateMatch = statementPresent && tzDateKey(deposit.depositDate) === tzDateKey(deposit.statementDate);
  const accountMatch =
    statementPresent && normalized(deposit.bankAccount) === normalized(deposit.statementBankAccount);
  const receiptPresent = Boolean(deposit.bankReceiptUrl || deposit.depositSlipUrl);
  const mismatches: string[] = [];
  if (!receiptPresent) mismatches.push("Receipt is missing");
  if (!statementPresent) mismatches.push("Matching bank record is missing");
  if (statementPresent && !amountMatch) mismatches.push("Amount does not match the bank record");
  if (statementPresent && !referenceMatch) mismatches.push("Reference number does not match");
  if (statementPresent && !dateMatch) mismatches.push("Deposit date does not match");
  if (statementPresent && !accountMatch) mismatches.push("Bank account does not match");
  return { amountMatch, referenceMatch, dateMatch, accountMatch, receiptPresent, statementPresent, mismatches };
}

export async function verifyBankDeposit(depositId: string, accountantId?: string | null) {
  const deposit = await (db as any).bankDeposit.findUnique({
    where: { id: depositId },
    include: { staff: true },
  });
  if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");

  const duplicate = deposit.referenceNo
    ? await (db as any).bankDeposit.findFirst({
        where: {
          companyId: deposit.companyId,
          referenceNo: deposit.referenceNo,
          id: { not: deposit.id },
        },
      })
    : null;

  const comparison = compareBankDeposit(deposit);
  let status: string;
  if (duplicate) status = "DUPLICATE_DEPOSIT";
  else if (!comparison.receiptPresent) status = "MISSING_RECEIPT";
  else if (!comparison.statementPresent) status = "MISSING_BANK_RECORD";
  else if (
    comparison.amountMatch &&
    comparison.referenceMatch &&
    comparison.dateMatch &&
    comparison.accountMatch
  ) {
    status = "VERIFIED";
  } else {
    status = "AMOUNT_MISMATCH";
  }

  const holdActive = status !== "VERIFIED";
  const updated = await (db as any).bankDeposit.update({
    where: { id: deposit.id },
    data: {
      accountantId: accountantId || deposit.accountantId,
      status,
      holdActive,
      mismatchReason: comparison.mismatches.join("; ") || null,
      comparisonJson: JSON.stringify({ ...comparison, duplicate: Boolean(duplicate) }),
      comparedAt: new Date(),
      reviewedAt: accountantId ? new Date() : deposit.reviewedAt,
      ...(status === "VERIFIED"
        ? { holdClearedAt: new Date(), holdClearedById: accountantId || deposit.holdClearedById }
        : {}),
    },
  });

  const today = new Date(`${tzDateKey()}T12:00:00+03:00`);
  const otherHolds = await (db as any).bankDeposit.count({
    where: { companyId: deposit.companyId, holdActive: true, id: { not: deposit.id } },
  });
  const financialDay = await (db as any).financialDay.findUnique({
    where: { companyId_date: { companyId: deposit.companyId, date: today } },
  });
  if (financialDay) {
    if (holdActive) {
      await (db as any).financialDay.update({
        where: { id: financialDay.id },
        data: {
          status: "BLOCKED",
          blockedReason: `Bank deposit ${deposit.referenceNo || deposit.id} requires resolution: ${comparison.mismatches.join("; ")}`,
        },
      });
    } else if (otherHolds === 0 && financialDay.status === "BLOCKED") {
      await (db as any).financialDay.update({
        where: { id: financialDay.id },
        data: { status: "OPEN", blockedReason: null },
      });
    }
  }

  await sendNotice({
    companyId: deposit.companyId,
    userId: deposit.staffId,
    title: status === "VERIFIED" ? "Deposit verified" : "Bank deposit financial hold",
    message:
      status === "VERIFIED"
        ? `Deposit ${deposit.referenceNo || deposit.id} has been verified successfully.`
        : `Deposit ${deposit.referenceNo || deposit.id} requires action: ${comparison.mismatches.join("; ")}`,
    type: status === "VERIFIED" ? "SUCCESS" : "WARNING",
  });
  await sendNoticeToRoles({
    companyId: deposit.companyId,
    roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
    title: status === "VERIFIED" ? "Deposit verified" : "Bank mismatch detected",
    message: `${deposit.staff.name}: ${deposit.referenceNo || deposit.id} — ${status.replaceAll("_", " ")}`,
    type: status === "VERIFIED" ? "SUCCESS" : "WARNING",
  });

  return { updated, comparison, status };
}
