import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  asDate,
  assertPeriodOpen,
  createAuditLog,
  dayBounds,
  ensureAttendanceMissingNotifications,
  monthKey,
  notifyCompanyRoles,
  ensureDefaultChartOfAccounts,
  postBalancedEntry,
} from "@/lib/accountant/accounting";
import {
  assertCompanyRecord,
  assertNotSelfApproval,
  assertWithinApprovalLimit,
  requireAccountant,
} from "@/lib/accountant/permissions";

export const dynamic = "force-dynamic";

const mismatchStatuses = [
  "AMOUNT_MISMATCH",
  "MISSING_RECEIPT",
  "DUPLICATE_DEPOSIT",
  "MISSING_BANK_RECORD",
];

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function amount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  return parsed;
}

function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`REQUIRED:${name}`);
  return result;
}

function monthRange(periodKey: string) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error("INVALID_PERIOD_KEY");
  }
  const [year, month] = periodKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Please sign in."],
    FORBIDDEN: [403, "Accountant access is required."],
    ACCOUNTANT_COMPANY_REQUIRED: [403, "The accountant is not attached to a company."],
    RECORD_NOT_FOUND: [404, "The selected record was not found in your company."],
    INVALID_AMOUNT: [400, "Enter a valid amount greater than zero."],
    INVALID_DATE: [400, "Enter a valid date."],
    INVALID_PERIOD_KEY: [400, "Enter a valid accounting month."],
    INVALID_JSON: [400, "The request body must be valid JSON."],
    INVALID_ACCOUNT_SIDE: [400, "Select debit or credit for the opening balance."],
    INVALID_ACCOUNT_TYPE: [400, "Select a valid account type."],
    OPENING_BALANCE_EXISTS: [409, "An opening balance already exists for this account and date."],
    UNBALANCED_JOURNAL_ENTRY: [400, "The journal entry is not balanced."],
    ACCOUNTING_PERIOD_LOCKED: [409, "This accounting period is locked. New postings and edits are blocked."],
    SELF_APPROVAL_FORBIDDEN: [403, "An accountant cannot approve their own expense request."],
    APPROVAL_LIMIT_EXCEEDED: [403, "This expense exceeds the accountant approval limit and requires Company Admin approval."],
    RECEIPT_REQUIRED: [400, "A receipt or supporting document is required."],
    FINANCIAL_DAY_ALREADY_OPEN: [409, "A financial day is already open."],
    FINANCIAL_DAY_NOT_OPEN: [409, "Open a financial day before closing it."],
    UNRESOLVED_BANK_MISMATCHES: [409, "Resolve all bank mismatches before closing the financial day or locking the period."],
    OPEN_FINANCIAL_DAYS_EXIST: [409, "All financial days in the selected month must be closed first."],
    TRANSACTION_ALREADY_POSTED: [409, "This transaction has already been posted."],
    PERIOD_REOPEN_REQUIRES_ADMIN: [403, "Only a Company Admin can approve and reopen a locked accounting period."],
    EXPENSE_NOT_PENDING: [409, "Only pending expenses can be approved or rejected."],
    FLOAT_NOT_PENDING: [409, "This float transaction has already been completed."],
    DEPOSIT_NOT_FOUND: [404, "The bank deposit was not found."],
  };

  if (message.startsWith("REQUIRED:")) {
    return NextResponse.json(
      { success: false, message: `${message.split(":")[1]} is required.` },
      { status: 400 },
    );
  }

  if (known[message]) {
    return NextResponse.json(
      { success: false, message: known[message][1] },
      { status: known[message][0] },
    );
  }

  const prismaCode = (error as any)?.code;
  if (prismaCode === "P2002") {
    return NextResponse.json(
      { success: false, message: "This reference or accounting record already exists.", error: prismaCode },
      { status: 409 },
    );
  }
  if (prismaCode === "P2021" || prismaCode === "P2022") {
    return NextResponse.json(
      {
        success: false,
        message: "The database is not synchronized with Prisma. Run npx prisma db push and npx prisma generate.",
        error: `${prismaCode}: ${message}`,
      },
      { status: 500 },
    );
  }
  console.error("[ACCOUNTANT_ACTION]", error);
  return NextResponse.json(
    { success: false, message: `The accounting action failed: ${message}`, error: message },
    { status: 500 },
  );
}

async function notifyUser(input: {
  companyId: string;
  recipientId: string;
  title: string;
  message: string;
  type?: string;
}) {
  await (db as any).notification.create({
    data: {
      companyId: input.companyId,
      userId: input.recipientId,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
    },
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireAccountant();
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      throw new Error("INVALID_JSON");
    }
    const action = required(body.action, "action").toUpperCase();
    const companyId = session.companyId;

    switch (action) {
      case "OPEN_DAY": {
        const date = asDate(body.date);
        await assertPeriodOpen(companyId, date);
        const { start, end } = dayBounds(date);

        const existingOpen = await (db as any).financialDay.findFirst({
          where: { companyId, status: "OPEN" },
        });
        if (existingOpen) throw new Error("FINANCIAL_DAY_ALREADY_OPEN");

        const duplicate = await (db as any).financialDay.findFirst({
          where: { companyId, date: { gte: start, lte: end } },
        });
        if (duplicate) throw new Error("FINANCIAL_DAY_ALREADY_OPEN");

        const previous = await (db as any).financialDay.findFirst({
          where: { companyId, status: "CLOSED", date: { lt: start } },
          orderBy: { date: "desc" },
        });

        const openingBalance =
          body.openingBalance === "" || body.openingBalance == null
            ? Number(previous?.closingBalance ?? 0)
            : Number(body.openingBalance);
        if (!Number.isFinite(openingBalance) || openingBalance < 0) {
          throw new Error("INVALID_AMOUNT");
        }

        const day = await (db as any).financialDay.create({
          data: {
            companyId,
            date: start,
            openingBalance,
            cashIn: 0,
            cashOut: 0,
            closingBalance: openingBalance,
            status: "OPEN",
            openedById: session.id,
            openedAt: new Date(),
          },
        });

        await createAuditLog({
          companyId,
          actorId: session.id,
          action: "OPEN_FINANCIAL_DAY",
          entityType: "FinancialDay",
          entityId: day.id,
          description: `Opened ${start.toISOString().slice(0, 10)} with balance ${openingBalance}`,
        });

        return NextResponse.json({ success: true, message: "Financial day opened successfully." });
      }

      case "CLOSE_DAY": {
        const financialDayId = text(body.financialDayId);
        const day = financialDayId
          ? await assertCompanyRecord("financialDay", financialDayId, companyId)
          : await (db as any).financialDay.findFirst({
              where: { companyId, status: "OPEN" },
            });

        if (!day || day.status !== "OPEN") throw new Error("FINANCIAL_DAY_NOT_OPEN");

        const unresolved = await (db as any).bankDeposit.count({
          where: { companyId, status: { in: mismatchStatuses } },
        });
        if (unresolved > 0) throw new Error("UNRESOLVED_BANK_MISMATCHES");

        const { start, end } = dayBounds(day.date);
        const entries = await (db as any).cashBookEntry.findMany({
          where: { companyId, transactionDate: { gte: start, lte: end } },
        });
        const cashIn = entries.reduce((sum: number, item: any) => sum + Number(item.debit ?? 0), 0);
        const cashOut = entries.reduce((sum: number, item: any) => sum + Number(item.credit ?? 0), 0);
        const closingBalance = Number(day.openingBalance ?? 0) + cashIn - cashOut;

        await (db as any).financialDay.update({
          where: { id: day.id },
          data: {
            cashIn,
            cashOut,
            closingBalance,
            status: "CLOSED",
            closedById: session.id,
            closedAt: new Date(),
          },
        });

        await createAuditLog({
          companyId,
          actorId: session.id,
          action: "CLOSE_FINANCIAL_DAY",
          entityType: "FinancialDay",
          entityId: day.id,
          description: `Closed with automatically calculated balance ${closingBalance}`,
        });

        return NextResponse.json({ success: true, message: "Financial day closed with the calculated closing balance." });
      }

      case "SAVE_OPENING_BALANCE": {
        const asOfDate = asDate(body.asOfDate ?? body.date);
        const accountCode = required(body.accountCode, "accountCode");
        const accountName = required(body.accountName, "accountName");
        const accountType = required(body.accountType, "accountType").toUpperCase();
        const side = required(body.side, "side").toUpperCase();
        const value = amount(body.amount);
        if (!["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].includes(accountType)) {
          throw new Error("INVALID_ACCOUNT_TYPE");
        }
        if (!["DEBIT", "CREDIT"].includes(side)) throw new Error("INVALID_ACCOUNT_SIDE");
        await assertPeriodOpen(companyId, asOfDate);
        await ensureDefaultChartOfAccounts(companyId);

        const account = await (db as any).chartOfAccount.upsert({
          where: { companyId_code: { companyId, code: accountCode } },
          update: {
            name: accountName,
            type: accountType,
            normalBalance: side,
            isActive: true,
          },
          create: {
            companyId,
            code: accountCode,
            name: accountName,
            type: accountType,
            normalBalance: side,
            isSystem: false,
            isActive: true,
          },
        });

        const { start } = dayBounds(asOfDate);
        const existing = await (db as any).openingBalance.findFirst({
          where: { companyId, accountId: account.id, asOfDate: start },
        });
        if (existing) throw new Error("OPENING_BALANCE_EXISTS");

        const reference = `OPEN-${accountCode}-${start.toISOString().slice(0, 10)}`;
        const opening = await (db as any).openingBalance.create({
          data: {
            companyId,
            accountId: account.id,
            asOfDate: start,
            debit: side === "DEBIT" ? value : 0,
            credit: side === "CREDIT" ? value : 0,
            reference,
            postedById: session.id,
          },
        });

        const counterSide = side === "DEBIT" ? "CREDIT" : "DEBIT";
        await postBalancedEntry({
          companyId,
          transactionDate: start,
          reference,
          description: `Opening balance for ${accountName}`,
          sourceType: "OPENING_BALANCE",
          sourceId: opening.id,
          postedById: session.id,
          lines: [
            {
              accountCode,
              accountName,
              debit: side === "DEBIT" ? value : 0,
              credit: side === "CREDIT" ? value : 0,
            },
            {
              accountCode: "3000",
              accountName: "Opening Balance Equity",
              debit: counterSide === "DEBIT" ? value : 0,
              credit: counterSide === "CREDIT" ? value : 0,
            },
          ],
          ...(accountCode === "1000" || accountCode === "1100"
            ? {
                cashBook: {
                  type: "OPENING_BALANCE",
                  account: accountName,
                  debit: side === "DEBIT" ? value : 0,
                  credit: side === "CREDIT" ? value : 0,
                },
              }
            : {}),
        });

        await createAuditLog({
          companyId,
          actorId: session.id,
          action: "SAVE_OPENING_BALANCE",
          entityType: "OpeningBalance",
          entityId: opening.id,
          description: `${accountCode} ${accountName}: ${side} ${value}`,
        });

        return NextResponse.json({
          success: true,
          message: "Opening balance posted to the double-entry ledger.",
        });
      }

      case "CREATE_MANUAL_RECEIPT": {
        const sourceUserId = required(body.sourceUserId, "sourceUserId");
        const transactionDate = asDate(body.transactionDate);
        const value = amount(body.amount);
        const classification = required(body.classification, "classification");
        const description = required(body.description, "description");
        const referenceNo = required(body.referenceNo, "referenceNo");
        const receiptUrl = required(body.receiptUrl, "receiptUrl");
        await assertPeriodOpen(companyId, transactionDate);
        await assertCompanyRecord("user", sourceUserId, companyId);

        const receipt = await (db as any).manualReceipt.create({
          data: {
            companyId,
            sourceUserId,
            postedById: session.id,
            transactionDate,
            amount: value,
            classification,
            description,
            referenceNo,
            receiptUrl,
            status: "POSTED",
          },
        });

        const creditAccount =
          classification === "REVENUE"
            ? { accountCode: "4000", accountName: "Service Revenue" }
            : classification === "STAFF_RETURN"
              ? { accountCode: "1300", accountName: "Staff Float Receivable" }
              : { accountCode: "4200", accountName: "Other Receipts" };

        await postBalancedEntry({
          companyId,
          transactionDate,
          reference: referenceNo,
          description,
          sourceType: "MANUAL_RECEIPT",
          sourceId: receipt.id,
          postedById: session.id,
          lines: [
            { accountCode: "1000", accountName: "Cash on Hand", debit: value },
            { ...creditAccount, credit: value },
          ],
          cashBook: {
            type: classification === "REVENUE" ? "MANUAL_REVENUE" : "MANUAL_RECEIPT",
            account: "Cash on Hand",
            debit: value,
            credit: 0,
          },
        });

        await notifyUser({
          companyId,
          recipientId: sourceUserId,
          title: "Money received and posted",
          message: `${session.name} recorded ${value.toLocaleString()} against reference ${referenceNo}.`,
          type: "SUCCESS",
        });

        return NextResponse.json({ success: true, message: "Manual cash receipt posted to the cash book and ledger." });
      }

      case "CREATE_EXPENSE": {
        const employeeId = required(body.employeeId, "employeeId");
        const expenseDate = asDate(body.expenseDate);
        const value = amount(body.amount);
        const category = required(body.category, "category");
        const description = required(body.description, "description");
        const receiptUrl = required(body.receiptUrl, "receiptUrl");
        if (!receiptUrl) throw new Error("RECEIPT_REQUIRED");
        await assertPeriodOpen(companyId, expenseDate);
        await assertCompanyRecord("user", employeeId, companyId);

        const expense = await (db as any).expense.create({
          data: {
            companyId,
            employeeId,
            createdById: session.id,
            expenseDate,
            category,
            description,
            amount: value,
            receiptUrl,
            status: "PENDING",
          },
        });

        await notifyUser({
          companyId,
          recipientId: employeeId,
          title: "Expense submitted",
          message: `${category} expense of ${value.toLocaleString()} is waiting for approval.`,
        });

        return NextResponse.json({ success: true, message: "Expense submitted. It will not affect accounts until approved." });
      }

      case "APPROVE_EXPENSE": {
        const expenseId = required(body.expenseId, "expenseId");
        const expense = await (db as any).expense.findFirst({
          where: { id: expenseId, companyId },
          include: { employee: true, createdBy: true },
        });
        if (!expense) throw new Error("RECORD_NOT_FOUND");
        if (expense.status !== "PENDING") throw new Error("EXPENSE_NOT_PENDING");
        if (!expense.receiptUrl) throw new Error("RECEIPT_REQUIRED");
        assertNotSelfApproval(session.id, expense.employeeId, expense.createdById);
        assertWithinApprovalLimit(Number(expense.amount), session.approvalLimit);
        await assertPeriodOpen(companyId, expense.expenseDate ?? expense.createdAt);

        await postBalancedEntry({
          companyId,
          transactionDate: asDate(expense.expenseDate ?? expense.createdAt),
          reference: `EXP-${expense.id}`,
          description: `${expense.category}: ${expense.description}`,
          sourceType: "EXPENSE",
          sourceId: expense.id,
          postedById: session.id,
          lines: [
            {
              accountCode:
                String(expense.category).toUpperCase() === "FUEL"
                  ? "5100"
                  : String(expense.category).toUpperCase() === "TRANSPORT"
                    ? "5200"
                    : String(expense.category).toUpperCase() === "AIRTIME"
                      ? "5300"
                      : "5000",
              accountName: `${expense.category} Expense`,
              debit: Number(expense.amount),
            },
            { accountCode: "1000", accountName: "Cash on Hand", credit: Number(expense.amount) },
          ],
          cashBook: {
            type: "EXPENSE",
            account: "Cash on Hand",
            debit: 0,
            credit: Number(expense.amount),
          },
        });

        await (db as any).expense.update({
          where: { id: expense.id },
          data: {
            status: "APPROVED",
            reviewNote: text(body.reviewNote) || "Approved",
            reviewedById: session.id,
            reviewedAt: new Date(),
          },
        });

        await notifyUser({
          companyId,
          recipientId: expense.employeeId,
          title: "Expense approved",
          message: `${expense.category} expense of ${Number(expense.amount).toLocaleString()} was approved.`,
          type: "SUCCESS",
        });

        return NextResponse.json({ success: true, message: "Expense approved and posted to the ledger." });
      }

      case "REJECT_EXPENSE": {
        const expenseId = required(body.expenseId, "expenseId");
        const expense = await (db as any).expense.findFirst({
          where: { id: expenseId, companyId },
        });
        if (!expense) throw new Error("RECORD_NOT_FOUND");
        if (expense.status !== "PENDING") throw new Error("EXPENSE_NOT_PENDING");
        assertNotSelfApproval(session.id, expense.employeeId, expense.createdById);

        await (db as any).expense.update({
          where: { id: expense.id },
          data: {
            status: "REJECTED",
            reviewNote: required(body.reviewNote, "reviewNote"),
            reviewedById: session.id,
            reviewedAt: new Date(),
          },
        });

        await notifyUser({
          companyId,
          recipientId: expense.employeeId,
          title: "Expense rejected",
          message: text(body.reviewNote) || "The expense was rejected.",
          type: "ERROR",
        });

        return NextResponse.json({ success: true, message: "Expense rejected without changing financial records." });
      }

      case "REVIEW_DEPOSIT": {
        const depositId = required(body.depositId, "depositId");
        const deposit = await (db as any).bankDeposit.findFirst({
          where: { id: depositId, companyId },
        });
        if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");

        const statementAmount = body.statementAmount === "" ? Number(deposit.amount) : amount(body.statementAmount);
        const statementReference = text(body.statementReference) || text(deposit.referenceNo);
        const statementDate = body.statementDate ? asDate(body.statementDate) : asDate(deposit.depositDate);
        const statementBankAccount = text(body.statementBankAccount) || text(deposit.bankAccount);
        const bankStatementUrl = text(body.bankStatementUrl) || text(deposit.bankStatementUrl);

        let status = "VERIFIED";
        let mismatchReason: string | null = null;
        if (!deposit.depositSlipUrl && !deposit.bankReceiptUrl) {
          status = "MISSING_RECEIPT";
          mismatchReason = "Staff deposit slip or bank receipt is missing.";
        } else if (Math.abs(statementAmount - Number(deposit.amount)) > 0.005) {
          status = "AMOUNT_MISMATCH";
          mismatchReason = "The staff amount does not match the bank statement amount.";
        } else if (statementReference !== text(deposit.referenceNo)) {
          status = "MISSING_BANK_RECORD";
          mismatchReason = "The bank statement reference does not match the submitted reference.";
        } else if (statementBankAccount !== text(deposit.bankAccount)) {
          status = "MISSING_BANK_RECORD";
          mismatchReason = "The bank account does not match the submitted bank account.";
        }

        await (db as any).bankDeposit.update({
          where: { id: deposit.id },
          data: {
            statementAmount,
            statementReference,
            statementDate,
            statementBankAccount,
            bankStatementUrl,
            status,
            mismatchReason,
            holdActive: status !== "VERIFIED",
            accountantId: session.id,
            reviewedAt: new Date(),
          },
        });

        if (status === "VERIFIED") {
          await postBalancedEntry({
            companyId,
            transactionDate: asDate(deposit.depositDate),
            reference: text(deposit.referenceNo) || `DEP-${deposit.id}`,
            description: `Verified staff bank deposit from ${deposit.staffId}`,
            sourceType: "BANK_DEPOSIT",
            sourceId: deposit.id,
            postedById: session.id,
            lines: [
              { accountCode: "1010", accountName: "Bank", debit: Number(deposit.amount) },
              { accountCode: "1200", accountName: "Staff Collection Clearing", credit: Number(deposit.amount) },
            ],
            cashBook: {
              type: "DEPOSIT",
              account: "Bank",
              debit: Number(deposit.amount),
              credit: 0,
            },
          });
        }

        await notifyUser({
          companyId,
          recipientId: deposit.staffId,
          title: status === "VERIFIED" ? "Bank deposit verified" : "Bank deposit needs correction",
          message: status === "VERIFIED" ? "Your bank deposit was verified and posted." : String(mismatchReason),
          type: status === "VERIFIED" ? "SUCCESS" : "WARNING",
        });

        return NextResponse.json({ success: true, message: status === "VERIFIED" ? "Deposit verified and posted." : `Deposit placed on hold: ${mismatchReason}` });
      }

      case "CLEAR_FINANCIAL_HOLD": {
        const depositId = required(body.depositId, "depositId");
        const note = required(body.investigationNote, "investigationNote");
        const deposit = await assertCompanyRecord("bankDeposit", depositId, companyId);

        await (db as any).bankDeposit.update({
          where: { id: deposit.id },
          data: {
            status: "PENDING",
            holdActive: false,
            mismatchReason: null,
            investigationNote: note,
            holdClearedById: session.id,
            holdClearedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, message: "Financial hold cleared. The deposit must be reviewed again before posting." });
      }

      case "APPROVE_FLOAT": {
        const floatId = required(body.floatId, "floatId");
        const classification = text(body.classification) || "FLOAT_SETTLEMENT";
        const float = await (db as any).floatTransaction.findFirst({
          where: { id: floatId, companyId },
        });
        if (!float) throw new Error("RECORD_NOT_FOUND");
        if (!["PENDING", "ISSUED", "CONFIRMED", "RETURNED"].includes(float.status)) throw new Error("FLOAT_NOT_PENDING");
        if (!float.receiptUrl) throw new Error("RECEIPT_REQUIRED");

        const returned = Number(float.returnedAmount ?? float.amount);
        const transactionDate = asDate(float.returnedAt ?? float.confirmedAt ?? new Date());
        await assertPeriodOpen(companyId, transactionDate);

        const credit = classification === "REVENUE"
          ? { accountCode: "4000", accountName: "Service Revenue" }
          : { accountCode: "1300", accountName: "Staff Float Receivable" };

        await postBalancedEntry({
          companyId,
          transactionDate,
          reference: `FLT-${float.id}`,
          description: classification === "REVENUE" ? `Verified earned revenue: ${float.purpose || "Float return"}` : `Float settlement: ${float.purpose || "Operational float"}`,
          sourceType: "FLOAT_VERIFICATION",
          sourceId: float.id,
          postedById: session.id,
          lines: [
            { accountCode: "1000", accountName: "Cash on Hand", debit: returned },
            { ...credit, credit: returned },
          ],
          cashBook: {
            type: classification === "REVENUE" ? "FLOAT_REVENUE" : "FLOAT_SETTLEMENT",
            account: "Cash on Hand",
            debit: returned,
            credit: 0,
          },
        });

        await (db as any).floatTransaction.update({
          where: { id: float.id },
          data: {
            status: "APPROVED",
            verificationClassification: classification,
            approvedById: session.id,
            approvedAt: new Date(),
          },
        });

        const recipientId = float.toUserId || float.fromUserId;
        if (recipientId) {
          await notifyUser({
            companyId,
            recipientId,
            title: "Float verified",
            message: `Float return of ${returned.toLocaleString()} was verified as ${classification.replaceAll("_", " ").toLowerCase()}.`,
            type: "SUCCESS",
          });
        }

        return NextResponse.json({ success: true, message: classification === "REVENUE" ? "Float verified and posted as earned revenue." : "Float verified; cash increased and staff-float receivable reduced." });
      }

      case "REJECT_FLOAT": {
        const floatId = required(body.floatId, "floatId");
        const float = await assertCompanyRecord("floatTransaction", floatId, companyId);
        if (!["PENDING", "ISSUED", "CONFIRMED", "RETURNED"].includes(float.status)) throw new Error("FLOAT_NOT_PENDING");

        await (db as any).floatTransaction.update({
          where: { id: float.id },
          data: { status: "REJECTED", approvedById: session.id, approvedAt: new Date() },
        });
        return NextResponse.json({ success: true, message: "Float verification rejected without posting income or cash." });
      }

      case "LOCK_PERIOD": {
        const periodKey = required(body.periodKey, "periodKey");
        const reason = required(body.reason, "reason");
        const { start, end } = monthRange(periodKey);

        const openDays = await (db as any).financialDay.count({
          where: { companyId, date: { gte: start, lte: end }, status: "OPEN" },
        });
        if (openDays > 0) throw new Error("OPEN_FINANCIAL_DAYS_EXIST");

        const unresolved = await (db as any).bankDeposit.count({
          where: { companyId, depositDate: { gte: start, lte: end }, status: { in: mismatchStatuses } },
        });
        if (unresolved > 0) throw new Error("UNRESOLVED_BANK_MISMATCHES");

        await (db as any).accountingPeriod.upsert({
          where: { companyId_periodKey: { companyId, periodKey } },
          update: {
            status: "LOCKED",
            reason,
            lockedById: session.id,
            lockedAt: new Date(),
          },
          create: {
            companyId,
            periodKey,
            label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            startsAt: start,
            endsAt: end,
            status: "LOCKED",
            reason,
            lockedById: session.id,
            lockedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, message: "Accounting period locked. Posted records can no longer be changed." });
      }

      case "REQUEST_PERIOD_REOPEN": {
        const periodKey = required(body.periodKey, "periodKey");
        const reason = required(body.reason, "reason");
        const period = await (db as any).accountingPeriod.findFirst({
          where: { companyId, periodKey, status: "LOCKED" },
        });
        if (!period) throw new Error("RECORD_NOT_FOUND");

        await (db as any).periodReopenRequest.upsert({
          where: { periodId_requestedById: { periodId: period.id, requestedById: session.id } },
          update: { reason, status: "PENDING", reviewedById: null, reviewedAt: null },
          create: {
            companyId,
            periodId: period.id,
            requestedById: session.id,
            reason,
            status: "PENDING",
          },
        });

        await notifyCompanyRoles({
          companyId,
          roles: ["COMPANY_ADMIN"],
          title: "Accounting period reopen request",
          message: `${session.name} requested approval to reopen ${period.label}. Reason: ${reason}`,
          type: "WARNING",
          dedupeKey: `period-reopen:${period.id}`,
        });

        return NextResponse.json({ success: true, message: "Reopen request sent to Company Admin. The period remains locked." });
      }

      case "UNLOCK_PERIOD":
        throw new Error("PERIOD_REOPEN_REQUIRES_ADMIN");

      case "MARK_ATTENDANCE":
      case "ADJUST_ATTENDANCE": {
        const userId = required(body.userId, "userId");
        const status = required(body.status, "status");
        const date = asDate(body.date);
        const { start } = dayBounds(date);
        await assertCompanyRecord("user", userId, companyId);

        await (db as any).attendance.upsert({
          where: { userId_date: { userId, date: start } },
          update: {
            status,
            notes: text(body.notes) || null,
            source: action === "ADJUST_ATTENDANCE" ? "MANUAL_ADJUSTMENT" : "CLASS_REGISTER",
            adjustedById: session.id,
            adjustedAt: new Date(),
            checkInAt: status === "PRESENT" ? new Date() : null,
          },
          create: {
            companyId,
            userId,
            date: start,
            status,
            notes: text(body.notes) || null,
            source: action === "ADJUST_ATTENDANCE" ? "MANUAL_ADJUSTMENT" : "CLASS_REGISTER",
            adjustedById: session.id,
            adjustedAt: new Date(),
            checkInAt: status === "PRESENT" ? new Date() : null,
          },
        });

        return NextResponse.json({ success: true, message: `Attendance marked ${status.toLowerCase()}.` });
      }

      case "SYNC_ATTENDANCE": {
        const date = asDate(body.date);
        const { start, end } = dayBounds(date);
        const users = await (db as any).user.findMany({
          where: { companyId, status: "ACTIVE" },
          select: { id: true },
        });

        for (const user of users) {
          const activityCount =
            (await (db as any).expense.count({ where: { companyId, employeeId: user.id, createdAt: { gte: start, lte: end } } })) +
            (await (db as any).bankDeposit.count({ where: { companyId, staffId: user.id, createdAt: { gte: start, lte: end } } })) +
            (await (db as any).floatTransaction.count({ where: { companyId, OR: [{ fromUserId: user.id }, { toUserId: user.id }], createdAt: { gte: start, lte: end } } }));

          await (db as any).attendance.upsert({
            where: { userId_date: { userId: user.id, date: start } },
            update: {
              status: activityCount > 0 ? "PRESENT" : "ABSENT",
              source: "AUTO_ACTIVITY",
              notes: activityCount > 0 ? "Generated from operational database activity." : "No qualifying database activity found.",
            },
            create: {
              companyId,
              userId: user.id,
              date: start,
              status: activityCount > 0 ? "PRESENT" : "ABSENT",
              source: "AUTO_ACTIVITY",
              notes: activityCount > 0 ? "Generated from operational database activity." : "No qualifying database activity found.",
            },
          });
        }

        await ensureAttendanceMissingNotifications(companyId, date);
        return NextResponse.json({ success: true, message: "Attendance generated from real company activity." });
      }

      case "GENERATE_ATTENDANCE_ALERTS": {
        const result = await ensureAttendanceMissingNotifications(companyId, body.date || new Date());
        return NextResponse.json({ success: true, message: result.missing ? `Attendance alert sent for ${result.missing} missing user(s).` : "Attendance is complete; no alert was required." });
      }

      case "UPDATE_PROFILE_IMAGE": {
        const profileImageUrl = required(body.profileImageUrl, "profileImageUrl");
        await (db as any).user.update({
          where: { id: session.id },
          data: { profileImageUrl },
        });
        return NextResponse.json({ success: true, message: "Profile image updated." });
      }

      case "MARK_NOTIFICATION_READ": {
        const notificationId = required(body.notificationId, "notificationId");
        await (db as any).notification.updateMany({
          where: { id: notificationId, companyId, userId: session.id },
          data: { isRead: true, readAt: new Date() },
        });
        return NextResponse.json({ success: true, message: "Notification marked as read." });
      }

      case "MARK_ALL_NOTIFICATIONS_READ": {
        await (db as any).notification.updateMany({
          where: { companyId, userId: session.id, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
        return NextResponse.json({ success: true, message: "All notifications marked as read." });
      }

      default:
        return NextResponse.json({ success: false, message: `Unsupported accountant action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
