import { randomBytes, randomUUID } from "node:crypto";

import { db } from "@/lib/db";

import {
  AccountantContext,
  PortalError,
  assertPeriodOpen,
  audit,
  dateKey,
  getApprovalLimit,
  getSettings,
  notifyRole,
  notifyUser,
  number,
  safeQuery,
  startOfDay,
  text,
} from "@/lib/accountant/portal";

const prisma = db as any;

function required(value: unknown, label: string): string {
  const result = text(value).trim();
  if (!result) throw new PortalError(`${label} is required.`, 422);
  return result;
}

function positive(value: unknown, label: string): number {
  const result = number(value);
  if (!(result > 0)) throw new PortalError(`${label} must be greater than zero.`, 422);
  return result;
}

function validDate(value: unknown, label = "Date"): Date {
  const key = required(value, label);
  const result = startOfDay(key);
  if (Number.isNaN(result.getTime())) throw new PortalError(`${label} is invalid.`, 422);
  return result;
}

function timeOnDate(dateValue: unknown, timeValue: unknown, fallback: string): Date | null {
  const statusTime = text(timeValue || fallback);
  if (!dateValue || !statusTime) return null;
  const result = new Date(`${dateKey(dateValue)}T${statusTime}:00+03:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

async function updateExpenseDecision(context: AccountantContext, body: any, forcedDecision?: "APPROVED" | "REJECTED") {
  const expenseId = required(body.expenseId, "Expense");
  const decision = forcedDecision || text(body.decision).toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(decision)) throw new PortalError("Decision must be APPROVED or REJECTED.", 422);
  const reason = required(body.reason ?? body.reviewNote, "Decision reason");

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, companyId: context.companyId },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
  if (!expense) throw new PortalError("Expense request was not found.", 404);
  if (text(expense.employeeId) === context.accountantId) {
    throw new PortalError("An accountant cannot approve their own expense request.", 403);
  }
  const settings = await getSettings(context.companyId);
  const limit = getApprovalLimit(settings);
  if (decision === "APPROVED" && limit > 0 && number(expense.amount) > limit) {
    throw new PortalError(`This expense exceeds the accountant approval limit of TZS ${limit.toLocaleString("en-GB")}.`, 403);
  }
  await assertPeriodOpen(context.companyId, expense.expenseDate);

  let finalStatus = decision;
  const decisionSaved = await safeQuery(
    "approvalDecision.upsert",
    async () => {
      await prisma.approvalDecision.upsert({
        where: {
          companyId_itemType_itemId_reviewerRole: {
            companyId: context.companyId,
            itemType: "EXPENSE",
            itemId: expenseId,
            reviewerRole: "ACCOUNTANT",
          },
        },
        update: {
          reviewerId: context.accountantId,
          reviewerName: text(context.accountant.name || context.accountant.email),
          decision,
          reason,
          decidedAt: new Date(),
        },
        create: {
          companyId: context.companyId,
          itemType: "EXPENSE",
          itemId: expenseId,
          reviewerId: context.accountantId,
          reviewerName: text(context.accountant.name || context.accountant.email),
          reviewerRole: "ACCOUNTANT",
          decision,
          reason,
        },
      });
      const decisions = await prisma.approvalDecision.findMany({
        where: { companyId: context.companyId, itemType: "EXPENSE", itemId: expenseId },
      });
      if (decisions.some((row: any) => text(row.decision) === "REJECTED")) finalStatus = "REJECTED";
      else if (["ACCOUNTANT", "COMPANY_ADMIN"].every((role) => decisions.some((row: any) => text(row.reviewerRole) === role && text(row.decision) === "APPROVED"))) finalStatus = "APPROVED";
      else finalStatus = "PENDING";
      return true;
    },
    false,
  );

  if (!decisionSaved) finalStatus = decision;
  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      reviewedById: context.accountantId,
      reviewNote: reason,
      reviewedAt: new Date(),
      status: finalStatus,
    },
  });
  await notifyUser(
    context,
    expense.employeeId,
    `Expense ${finalStatus.toLowerCase()}`,
    `Your ${text(expense.category).replaceAll("_", " ").toLowerCase()} expense for TZS ${number(expense.amount).toLocaleString("en-GB")} is ${finalStatus.toLowerCase()}. ${reason}`,
    finalStatus === "APPROVED" ? "SUCCESS" : finalStatus === "REJECTED" ? "ERROR" : "INFO",
  );
  await audit(context, `EXPENSE_${decision}`, "EXPENSE", { expenseId, finalStatus, reason });
  return `Expense decision saved. Final status: ${finalStatus}.`;
}

async function saveAttendanceRows(context: AccountantContext, body: any) {
  const date = validDate(body.date, "Attendance date");
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw new PortalError("At least one attendance row is required.", 422);
  await assertPeriodOpen(context.companyId, date);

  const activeStaff = await prisma.user.findMany({
    where: { companyId: context.companyId, role: "STAFF", status: "ACTIVE", id: { in: rows.map((row: any) => text(row.userId)).filter(Boolean) } },
    select: { id: true },
  });
  const allowed = new Set(activeStaff.map((row: any) => text(row.id)));

  await prisma.$transaction(
    rows
      .filter((row: any) => allowed.has(text(row.userId)))
      .map((row: any) => {
        const morningStatus = text(row.morningStatus).toUpperCase() || null;
        const eveningStatus = text(row.eveningStatus).toUpperCase() || null;
        const validStatuses = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY", "SUSPENDED"];
        if (morningStatus && !validStatuses.includes(morningStatus)) throw new PortalError("Invalid morning attendance status.", 422);
        if (eveningStatus && !validStatuses.includes(eveningStatus)) throw new PortalError("Invalid evening attendance status.", 422);
        const status = morningStatus || eveningStatus || "ABSENT";
        const checkInAt = ["PRESENT", "LATE"].includes(morningStatus || "") ? timeOnDate(date, row.morningTime, "08:00") : null;
        const checkOutAt = ["PRESENT", "LATE"].includes(eveningStatus || "") ? timeOnDate(date, row.eveningTime, "17:00") : null;
        return prisma.attendance.upsert({
          where: { userId_date: { userId: text(row.userId), date } },
          update: {
            companyId: context.companyId,
            status,
            morningStatus,
            eveningStatus,
            checkInAt,
            checkOutAt,
            source: "ACCOUNTANT_MANUAL",
            morningSource: "ACCOUNTANT_MANUAL",
            eveningSource: "ACCOUNTANT_MANUAL",
            notes: text(row.note || row.notes) || null,
            markedById: context.accountantId,
            verifiedById: context.accountantId,
            verifiedAt: new Date(),
          },
          create: {
            companyId: context.companyId,
            userId: text(row.userId),
            date,
            status,
            morningStatus,
            eveningStatus,
            checkInAt,
            checkOutAt,
            source: "ACCOUNTANT_MANUAL",
            morningSource: "ACCOUNTANT_MANUAL",
            eveningSource: "ACCOUNTANT_MANUAL",
            notes: text(row.note || row.notes) || null,
            markedById: context.accountantId,
            verifiedById: context.accountantId,
            verifiedAt: new Date(),
          },
        });
      }),
  );
  await audit(context, "SAVE_ATTENDANCE", "ATTENDANCE", { date: dateKey(date), rows: rows.length });
  return "Morning and evening attendance saved successfully.";
}

async function issueStaffFunds(context: AccountantContext, body: any) {
  const staffId = required(body.staffId ?? body.staffUserId, "Staff user");
  const floatAmount = Math.max(0, number(body.floatAmount ?? body.amount));
  const cashAmount = Math.max(0, number(body.cashAmount));
  const totalAmount = floatAmount + cashAmount;
  if (!(totalAmount > 0)) throw new PortalError("Float or cash amount must be greater than zero.", 422);
  const staff = await prisma.user.findFirst({
    where: { id: staffId, companyId: context.companyId, role: "STAFF", status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });
  if (!staff) throw new PortalError("The selected active STAFF user was not found.", 404);
  const issueDate = body.issueDate ? validDate(body.issueDate, "Issue date") : new Date();
  await assertPeriodOpen(context.companyId, issueDate);
  const referenceNo = text(body.referenceNo).trim() || `FUND-${dateKey(issueDate).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const purpose = text(body.purpose).trim() || "Daily field operations";
  const note = text(body.note ?? body.notes).trim() || null;

  const result = await prisma.$transaction(async (tx: any) => {
    const transaction = await tx.floatTransaction.create({
      data: {
        companyId: context.companyId,
        fromUserId: context.accountantId,
        toUserId: staffId,
        transactionType: "ACCOUNTANT_TO_STAFF",
        referenceNo,
        amount: totalAmount,
        purpose,
        receiptUrl: text(body.receiptUrl) || null,
        notes: note,
        status: "ISSUED",
        issuedAt: issueDate,
      },
    });
    const receipt = await safeQuery(
      "staffFundingReceipt.create",
      () =>
        tx.staffFundingReceipt.create({
          data: {
            companyId: context.companyId,
            staffId,
            accountantId: context.accountantId,
            networkLineId: text(body.networkLineId) || null,
            floatTransactionId: transaction.id,
            referenceNo,
            floatAmount,
            cashAmount,
            note,
            status: "PENDING",
            issuedAt: issueDate,
          },
        }),
      null,
    );
    return { transaction, receipt };
  });

  await notifyUser(context, staffId, "Float and cash issued", `You have received TZS ${totalAmount.toLocaleString("en-GB")} for ${purpose}. Reference: ${referenceNo}.`, "SUCCESS");
  await audit(context, "ISSUE_STAFF_FUNDS", "FLOAT", { staffId, floatAmount, cashAmount, referenceNo, transactionId: result.transaction.id });
  return `Float and cash were issued to ${staff.name}. Reference: ${referenceNo}.`;
}

export async function performAccountantAction(context: AccountantContext, body: any): Promise<{ message: string; [key: string]: any }> {
  const action = required(body.action, "Action").toUpperCase();

  switch (action) {
    case "OPEN_DAY": {
      const date = validDate(body.date, "Financial date");
      const openingBalance = Math.max(0, number(body.openingBalance));
      await assertPeriodOpen(context.companyId, date);
      const existingOpen = await prisma.financialDay.findFirst({ where: { companyId: context.companyId, status: "OPEN" } });
      if (existingOpen) throw new PortalError(`A financial day is already open for ${dateKey(existingOpen.date)}.`, 409);
      await prisma.financialDay.upsert({
        where: { companyId_date: { companyId: context.companyId, date } },
        update: { openingBalance, cashIn: 0, cashOut: 0, closingBalance: openingBalance, status: "OPEN", blockedReason: null, openedById: context.accountantId, openedAt: new Date(), closedById: null, closedAt: null },
        create: { companyId: context.companyId, date, openingBalance, closingBalance: openingBalance, status: "OPEN", openedById: context.accountantId },
      });
      await audit(context, "OPEN_DAY", "FINANCIAL_DAY", { date: dateKey(date), openingBalance });
      return { message: `Financial day ${dateKey(date)} opened successfully.` };
    }

    case "CLOSE_DAY": {
      const day = body.financialDayId
        ? await prisma.financialDay.findFirst({ where: { id: text(body.financialDayId), companyId: context.companyId } })
        : await prisma.financialDay.findFirst({ where: { companyId: context.companyId, status: "OPEN" }, orderBy: { date: "desc" } });
      if (!day) throw new PortalError("No open financial day was found.", 404);
      await assertPeriodOpen(context.companyId, day.date);
      const unresolved = await prisma.bankDeposit.count({ where: { companyId: context.companyId, OR: [{ holdActive: true }, { status: { in: ["AMOUNT_MISMATCH", "MISSING_RECEIPT", "DUPLICATE_DEPOSIT", "MISSING_BANK_RECORD"] } }] } });
      if (unresolved > 0) throw new PortalError(`Financial day cannot close while ${unresolved} bank mismatch or hold remains unresolved.`, 409);
      const start = new Date(day.date);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      const [services, expenses, receipts] = await Promise.all([
        prisma.serviceActivity.findMany({ where: { companyId: context.companyId, status: "COMPLETED", servedAt: { gte: start, lte: end } }, select: { amount: true } }),
        prisma.expense.findMany({ where: { companyId: context.companyId, status: "APPROVED", expenseDate: { gte: start, lte: end } }, select: { amount: true } }),
        safeQuery("manualReceipts", () => prisma.companySetting.findMany({ where: { companyId: context.companyId, key: { startsWith: "accounting.manualReceipt." } } }), []),
      ]);
      const cashIn = services.reduce((sum: number, row: any) => sum + number(row.amount), 0) + receipts.map((row: any) => { try { return JSON.parse(row.value); } catch { return null; } }).filter((row: any) => row && new Date(row.transactionDate).getTime() >= start.getTime() && new Date(row.transactionDate).getTime() <= end.getTime()).reduce((sum: number, row: any) => sum + number(row.amount), 0);
      const cashOut = expenses.reduce((sum: number, row: any) => sum + number(row.amount), 0);
      const closingBalance = number(day.openingBalance) + cashIn - cashOut;
      await prisma.financialDay.update({ where: { id: day.id }, data: { cashIn, cashOut, closingBalance, status: "CLOSED", closedById: context.accountantId, closedAt: new Date(), blockedReason: null } });
      await audit(context, "CLOSE_DAY", "FINANCIAL_DAY", { financialDayId: day.id, cashIn, cashOut, closingBalance });
      return { message: `Financial day closed with a balance of TZS ${closingBalance.toLocaleString("en-GB")}.` };
    }

    case "SAVE_OPENING_BALANCE": {
      const accountCode = required(body.accountCode, "Account code");
      const accountName = required(body.accountName, "Account name");
      const amount = positive(body.amount, "Amount");
      const asOfDate = validDate(body.asOfDate, "As-of date");
      await assertPeriodOpen(context.companyId, asOfDate);
      const id = randomUUID();
      const record = {
        id,
        accountCode,
        accountName,
        accountType: text(body.accountType || "ASSET"),
        side: text(body.side || "DEBIT").toUpperCase(),
        amount,
        asOfDate: asOfDate.toISOString(),
        referenceNo: `OB-${accountCode}-${dateKey(asOfDate)}`,
        postedBy: { id: context.accountantId, name: context.accountant.name, email: context.accountant.email },
        createdAt: new Date().toISOString(),
      };
      await prisma.companySetting.upsert({
        where: { companyId_key: { companyId: context.companyId, key: `accounting.openingBalance.${id}` } },
        update: { value: JSON.stringify(record) },
        create: { companyId: context.companyId, key: `accounting.openingBalance.${id}`, value: JSON.stringify(record) },
      });
      await audit(context, "SAVE_OPENING_BALANCE", "GENERAL_LEDGER", record);
      return { message: `Opening balance posted to ${accountCode} · ${accountName}.` };
    }

    case "CREATE_MANUAL_RECEIPT": {
      const amount = positive(body.amount, "Amount");
      const transactionDate = validDate(body.transactionDate, "Transaction date");
      await assertPeriodOpen(context.companyId, transactionDate);
      const sourceUserId = required(body.sourceUserId, "Source user");
      const sourceUser = await prisma.user.findFirst({ where: { id: sourceUserId, companyId: context.companyId }, select: { id: true, name: true, email: true } });
      if (!sourceUser) throw new PortalError("Source user was not found.", 404);
      const id = randomUUID();
      const referenceNo = text(body.referenceNo).trim() || `RCPT-${dateKey(transactionDate).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const record = {
        id,
        sourceUserId,
        transactionDate: transactionDate.toISOString(),
        amount,
        classification: text(body.classification || "OTHER_INCOME"),
        description: required(body.description, "Description"),
        referenceNo,
        receiptUrl: text(body.receiptUrl) || null,
        postedBy: { id: context.accountantId, name: context.accountant.name, email: context.accountant.email },
        createdAt: new Date().toISOString(),
      };
      await prisma.companySetting.create({ data: { companyId: context.companyId, key: `accounting.manualReceipt.${id}`, value: JSON.stringify(record) } });
      await audit(context, "CREATE_MANUAL_RECEIPT", "CASH_BOOK", record);
      return { message: `Manual receipt ${referenceNo} saved for ${sourceUser.name}.` };
    }

    case "CREATE_EXPENSE": {
      const employeeId = required(body.employeeId, "Expense owner");
      const employee = await prisma.user.findFirst({ where: { id: employeeId, companyId: context.companyId }, select: { id: true, name: true, email: true } });
      if (!employee) throw new PortalError("Expense owner was not found.", 404);
      const expenseDate = validDate(body.expenseDate, "Expense date");
      await assertPeriodOpen(context.companyId, expenseDate);
      const receiptUrl = required(body.receiptUrl, "Receipt");
      const expense = await prisma.expense.create({
        data: {
          companyId: context.companyId,
          employeeId,
          expenseDate,
          category: required(body.category, "Category"),
          requestMode: text(body.requestMode || "REIMBURSEMENT"),
          requestedAction: text(body.requestedAction) || null,
          amount: positive(body.amount, "Amount"),
          description: required(body.description, "Description"),
          receiptUrl,
          status: "PENDING",
        },
      });
      await notifyRole(context, "COMPANY_ADMIN", "New expense request", `${employee.name} submitted an expense request for review.`, "INFO");
      await audit(context, "CREATE_EXPENSE", "EXPENSE", { expenseId: expense.id, employeeId });
      return { message: "Expense request created and sent for dual approval." };
    }

    case "REVIEW_EXPENSE":
      return { message: await updateExpenseDecision(context, body) };
    case "APPROVE_EXPENSE":
      return { message: await updateExpenseDecision(context, body, "APPROVED") };
    case "REJECT_EXPENSE":
      return { message: await updateExpenseDecision(context, body, "REJECTED") };

    case "ASSIGN_STAFF_FLOAT":
    case "ISSUE_STAFF_FUNDS":
      return { message: await issueStaffFunds(context, body) };

    case "REVIEW_DEPOSIT":
    case "REVIEW_BANK_DEPOSIT": {
      const depositId = required(body.depositId, "Deposit");
      const deposit = await prisma.bankDeposit.findFirst({ where: { id: depositId, companyId: context.companyId }, include: { staff: { select: { id: true, name: true } } } });
      if (!deposit) throw new PortalError("Bank deposit was not found.", 404);
      await assertPeriodOpen(context.companyId, deposit.depositDate);
      const statementAmount = positive(body.statementAmount, "Statement amount");
      const statementReference = required(body.statementReference, "Statement reference");
      const statementDate = validDate(body.statementDate, "Statement date");
      const statementBankAccount = required(body.statementBankAccount, "Statement bank account");
      const amountMatch = Math.abs(statementAmount - number(deposit.amount)) < 0.01;
      const referenceMatch = text(deposit.referenceNo).trim().toLowerCase() === statementReference.trim().toLowerCase();
      const accountMatch = text(deposit.bankAccount).replace(/\s+/g, "").toLowerCase() === statementBankAccount.replace(/\s+/g, "").toLowerCase();
      const dateMatch = dateKey(deposit.depositDate) === dateKey(statementDate);
      const matched = amountMatch && referenceMatch && accountMatch && dateMatch;
      const reason = text(body.reason || body.investigationNote).trim() || (matched ? "All bank fields matched." : `Mismatch: ${[!amountMatch && "amount", !referenceMatch && "reference", !accountMatch && "account", !dateMatch && "date"].filter(Boolean).join(", ")}.`);
      await prisma.bankDeposit.update({
        where: { id: depositId },
        data: {
          accountantId: context.accountantId,
          statementAmount,
          statementReference,
          statementDate,
          statementBankAccount,
          bankStatementUrl: text(body.bankStatementUrl) || deposit.bankStatementUrl,
          comparisonJson: JSON.stringify({ amountMatch, referenceMatch, accountMatch, dateMatch }),
          comparedAt: new Date(),
          status: matched ? "VERIFIED" : "AMOUNT_MISMATCH",
          holdActive: !matched,
          mismatchReason: matched ? null : reason,
          reviewedAt: new Date(),
        },
      });
      if (body.packetId) {
        await safeQuery("verificationPacket.update", () => prisma.verificationPacket.update({ where: { id: text(body.packetId) }, data: { status: matched ? "VERIFIED" : "REJECTED", reviewedByAccountantId: context.accountantId, reviewReason: reason, reviewedAt: new Date() } }), null);
      }
      await notifyUser(context, deposit.staffId, matched ? "Bank deposit verified" : "Bank deposit requires correction", matched ? `Your bank deposit ${text(deposit.referenceNo)} was verified.` : reason, matched ? "SUCCESS" : "ERROR");
      await audit(context, "REVIEW_DEPOSIT", "BANK_RECONCILIATION", { depositId, matched, reason });
      return { message: matched ? "Bank deposit verified successfully." : "Bank mismatch recorded and a financial hold was activated." };
    }

    case "CLEAR_FINANCIAL_HOLD": {
      const depositId = required(body.depositId, "Deposit");
      const investigationNote = required(body.investigationNote ?? body.reason, "Investigation note");
      const deposit = await prisma.bankDeposit.findFirst({ where: { id: depositId, companyId: context.companyId } });
      if (!deposit) throw new PortalError("Bank deposit was not found.", 404);
      await prisma.bankDeposit.update({ where: { id: depositId }, data: { holdActive: false, holdClearedAt: new Date(), holdClearedById: context.accountantId, mismatchReason: investigationNote } });
      await audit(context, "CLEAR_FINANCIAL_HOLD", "BANK_RECONCILIATION", { depositId, investigationNote });
      return { message: "Financial hold cleared. The investigation note remains in the audit trail." };
    }

    case "APPROVE_FLOAT":
    case "REJECT_FLOAT": {
      const floatId = required(body.floatId, "Float transaction");
      const row = await prisma.floatTransaction.findFirst({ where: { id: floatId, companyId: context.companyId } });
      if (!row) throw new PortalError("Float transaction was not found.", 404);
      if (action === "APPROVE_FLOAT" && !row.receiptUrl && number(row.returnedAmount) <= 0) throw new PortalError("A receipt or returned amount is required before float approval.", 422);
      const status = action === "APPROVE_FLOAT" ? "APPROVED" : "REJECTED";
      await prisma.floatTransaction.update({ where: { id: floatId }, data: { status, approvedById: context.accountantId, approvedAt: new Date() } });
      await safeQuery("staffFundingReceipt.updateMany", () => prisma.staffFundingReceipt.updateMany({ where: { floatTransactionId: floatId }, data: { status: status === "APPROVED" ? "CONFIRMED" : "REJECTED", confirmedAt: status === "APPROVED" ? new Date() : null, rejectedAt: status === "REJECTED" ? new Date() : null } }), null);
      if (row.toUserId) await notifyUser(context, row.toUserId, `Float ${status.toLowerCase()}`, `Float reference ${row.referenceNo || row.id} was ${status.toLowerCase()}.`, status === "APPROVED" ? "SUCCESS" : "ERROR");
      await audit(context, action, "FLOAT", { floatId, status });
      return { message: `Float transaction ${status.toLowerCase()}.` };
    }

    case "LOCK_PERIOD": {
      const periodKey = required(body.periodKey, "Accounting month");
      if (!/^\d{4}-\d{2}$/.test(periodKey)) throw new PortalError("Accounting month must use YYYY-MM format.", 422);
      const reason = required(body.reason, "Lock reason");
      const startsAt = startOfDay(`${periodKey}-01`);
      const nextMonth = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth() + 1, 1) - 3 * 60 * 60 * 1000);
      const endsAt = new Date(nextMonth.getTime() - 1);
      const openDays = await prisma.financialDay.count({ where: { companyId: context.companyId, date: { gte: startsAt, lte: endsAt }, status: "OPEN" } });
      if (openDays > 0) throw new PortalError(`${openDays} financial day(s) are still open in ${periodKey}.`, 409);
      const activeHolds = await prisma.bankDeposit.count({ where: { companyId: context.companyId, depositDate: { gte: startsAt, lte: endsAt }, holdActive: true } });
      if (activeHolds > 0) throw new PortalError(`${activeHolds} bank hold(s) must be cleared before locking ${periodKey}.`, 409);
      await prisma.accountingPeriod.upsert({
        where: { companyId_periodKey: { companyId: context.companyId, periodKey } },
        update: { label: periodKey, startsAt, endsAt, status: "LOCKED", lockedById: context.accountantId, lockedAt: new Date(), unlockedAt: null, reason },
        create: { companyId: context.companyId, periodKey, label: periodKey, startsAt, endsAt, status: "LOCKED", lockedById: context.accountantId, lockedAt: new Date(), reason },
      });
      await audit(context, "LOCK_PERIOD", "ACCOUNTING_PERIOD", { periodKey, reason });
      return { message: `Accounting period ${periodKey} locked.` };
    }

    case "REQUEST_PERIOD_REOPEN": {
      const periodKey = required(body.periodKey, "Accounting month");
      const reason = required(body.reason, "Reopen reason");
      const period = await prisma.accountingPeriod.findFirst({ where: { companyId: context.companyId, periodKey, status: "LOCKED" } });
      if (!period) throw new PortalError("Locked accounting period was not found.", 404);
      await prisma.accountingPeriod.update({ where: { id: period.id }, data: { reason: `${text(period.reason)}\nREOPEN REQUEST: ${reason}`.trim() } });
      await notifyRole(context, "COMPANY_ADMIN", "Accounting period reopen request", `${context.accountant.name} requested reopening of ${periodKey}. Reason: ${reason}`, "WARNING");
      await audit(context, "REQUEST_PERIOD_REOPEN", "ACCOUNTING_PERIOD", { periodKey, reason });
      return { message: `Reopen request for ${periodKey} sent to Company Admin.` };
    }

    case "SAVE_ATTENDANCE":
      return { message: await saveAttendanceRows(context, body) };

    case "MARK_ATTENDANCE":
    case "ADJUST_ATTENDANCE": {
      const userId = required(body.userId, "User");
      const date = validDate(body.date, "Attendance date");
      const status = required(body.status, "Attendance status").toUpperCase();
      if (!["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY", "SUSPENDED"].includes(status)) throw new PortalError("Attendance status is invalid.", 422);
      await assertPeriodOpen(context.companyId, date);
      const user = await prisma.user.findFirst({ where: { id: userId, companyId: context.companyId }, select: { id: true, name: true } });
      if (!user) throw new PortalError("Company user was not found.", 404);
      await prisma.attendance.upsert({
        where: { userId_date: { userId, date } },
        update: { companyId: context.companyId, status, source: action === "ADJUST_ATTENDANCE" ? "ACCOUNTANT_ADJUSTMENT" : "ACCOUNTANT_MANUAL", notes: text(body.notes) || null, markedById: context.accountantId, verifiedById: context.accountantId, verifiedAt: new Date(), checkInAt: ["PRESENT", "LATE"].includes(status) ? new Date() : null },
        create: { companyId: context.companyId, userId, date, status, source: action === "ADJUST_ATTENDANCE" ? "ACCOUNTANT_ADJUSTMENT" : "ACCOUNTANT_MANUAL", notes: text(body.notes) || null, markedById: context.accountantId, verifiedById: context.accountantId, verifiedAt: new Date(), checkInAt: ["PRESENT", "LATE"].includes(status) ? new Date() : null },
      });
      await audit(context, action, "ATTENDANCE", { userId, date: dateKey(date), status, notes: body.notes });
      return { message: `${user.name} marked ${status.replaceAll("_", " ").toLowerCase()}.` };
    }

    case "SYNC_ATTENDANCE": {
      const date = validDate(body.date, "Attendance date");
      const start = date;
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      const [staff, activity] = await Promise.all([
        prisma.user.findMany({ where: { companyId: context.companyId, role: "STAFF", status: "ACTIVE" }, select: { id: true } }),
        prisma.floatTransaction.findMany({ where: { companyId: context.companyId, createdAt: { gte: start, lte: end } }, select: { fromUserId: true, toUserId: true } }),
      ]);
      const active = new Set(activity.flatMap((row: any) => [text(row.fromUserId), text(row.toUserId)]).filter(Boolean));
      await prisma.$transaction(staff.map((user: any) => prisma.attendance.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: { companyId: context.companyId, status: active.has(user.id) ? "PRESENT" : "ABSENT", source: "SYSTEM_ACTIVITY", notes: active.has(user.id) ? "Generated from financial activity." : "No qualifying operational activity found.", verifiedById: context.accountantId, verifiedAt: new Date() },
        create: { companyId: context.companyId, userId: user.id, date, status: active.has(user.id) ? "PRESENT" : "ABSENT", source: "SYSTEM_ACTIVITY", notes: active.has(user.id) ? "Generated from financial activity." : "No qualifying operational activity found.", verifiedById: context.accountantId, verifiedAt: new Date() },
      })));
      await audit(context, "SYNC_ATTENDANCE", "ATTENDANCE", { date: dateKey(date), staff: staff.length });
      return { message: `Attendance generated for ${staff.length} active STAFF users.` };
    }

    case "GENERATE_ATTENDANCE_ALERTS": {
      const date = validDate(body.date, "Attendance date");
      const [staff, records] = await Promise.all([
        prisma.user.findMany({ where: { companyId: context.companyId, role: "STAFF", status: "ACTIVE" }, select: { id: true, name: true } }),
        prisma.attendance.findMany({ where: { companyId: context.companyId, date }, select: { userId: true } }),
      ]);
      const marked = new Set(records.map((row: any) => text(row.userId)));
      const missing = staff.filter((row: any) => !marked.has(text(row.id)));
      for (const user of missing) await notifyUser(context, user.id, "Attendance not recorded", `Your attendance for ${dateKey(date)} has not been recorded. Contact the accountant.`, "WARNING");
      await notifyRole(context, "COMPANY_ADMIN", "Missing attendance alert", `${missing.length} STAFF attendance record(s) are missing for ${dateKey(date)}.`, "WARNING");
      await audit(context, "GENERATE_ATTENDANCE_ALERTS", "ATTENDANCE", { date: dateKey(date), missing: missing.length });
      return { message: `${missing.length} missing-attendance alert(s) generated.` };
    }

    case "MARK_NOTIFICATION_READ": {
      const notificationId = required(body.notificationId, "Notification");
      await prisma.notification.updateMany({ where: { id: notificationId, userId: context.accountantId, companyId: context.companyId }, data: { isRead: true } });
      return { message: "Notification marked as read." };
    }

    case "MARK_ALL_NOTIFICATIONS_READ": {
      await prisma.notification.updateMany({ where: { userId: context.accountantId, companyId: context.companyId, isRead: false }, data: { isRead: true } });
      return { message: "All accountant notifications marked as read." };
    }

    case "UPDATE_PROFILE_IMAGE": {
      const profileImageUrl = required(body.profileImageUrl, "Profile image URL");
      await prisma.user.update({ where: { id: context.accountantId }, data: { profileImageUrl } });
      await audit(context, "UPDATE_PROFILE_IMAGE", "PROFILE", { profileImageUrl });
      return { message: "Profile image updated." };
    }

    case "REVIEW_PROOF": {
      const proofId = required(body.proofId, "Proof submission");
      const decision = required(body.decision, "Decision").toUpperCase();
      if (!["VERIFIED", "REJECTED"].includes(decision)) throw new PortalError("Proof decision must be VERIFIED or REJECTED.", 422);
      const reason = required(body.reason, "Review reason");
      const proof = await prisma.staffProofSubmission.findFirst({ where: { id: proofId, companyId: context.companyId } });
      if (!proof) throw new PortalError("Proof submission was not found.", 404);
      await prisma.staffProofSubmission.update({ where: { id: proofId }, data: { status: decision, verificationNote: reason, verifiedById: context.accountantId, verifiedAt: new Date() } });
      await notifyUser(context, proof.staffId, `Proof ${decision.toLowerCase()}`, `${proof.referenceNo}: ${reason}`, decision === "VERIFIED" ? "SUCCESS" : "ERROR");
      await audit(context, "REVIEW_PROOF", "PROOF", { proofId, decision, reason });
      return { message: `Proof ${decision.toLowerCase()}.` };
    }

    case "REVIEW_PACKET": {
      const packetId = required(body.packetId, "Verification packet");
      const decision = required(body.decision, "Decision").toUpperCase();
      if (!["VERIFIED", "REJECTED"].includes(decision)) throw new PortalError("Packet decision must be VERIFIED or REJECTED.", 422);
      const reason = required(body.reason, "Review reason");
      const packet = await prisma.verificationPacket.findFirst({ where: { id: packetId, companyId: context.companyId } });
      if (!packet) throw new PortalError("Verification packet was not found.", 404);
      await prisma.verificationPacket.update({ where: { id: packetId }, data: { status: decision, reviewedByAccountantId: context.accountantId, reviewReason: reason, reviewedAt: new Date() } });
      if (packet.staffId) await notifyUser(context, packet.staffId, `Verification document ${decision.toLowerCase()}`, reason, decision === "VERIFIED" ? "SUCCESS" : "ERROR");
      await audit(context, "REVIEW_PACKET", "VERIFICATION", { packetId, decision, reason });
      return { message: `Verification packet ${decision.toLowerCase()}.` };
    }

    case "DECIDE_BANK_COMPARISON": {
      const comparisonId = required(body.comparisonId, "Bank comparison");
      const decision = text(body.decision).toUpperCase();
      return performAccountantAction(context, {
        action: decision === "APPROVE" ? "REVIEW_PACKET" : "REVIEW_PACKET",
        packetId: comparisonId,
        decision: decision === "APPROVE" ? "VERIFIED" : "REJECTED",
        reason: text(body.reason) || (decision === "APPROVE" ? "Bank comparison verified." : "Bank comparison rejected."),
      });
    }

    case "SAVE_REPORT_SNAPSHOT": {
      const id = randomUUID();
      await prisma.companySetting.create({
        data: {
          companyId: context.companyId,
          key: `accounting.reportSnapshot.${id}`,
          value: JSON.stringify({ id, reportName: body.reportName || "Accountant Report", periodLabel: body.periodLabel, filters: body.filters, payload: body.payload, savedById: context.accountantId, savedAt: new Date().toISOString() }),
        },
      });
      await audit(context, "SAVE_REPORT_SNAPSHOT", "REPORTS", { id, reportName: body.reportName });
      return { message: "Report snapshot saved to the company database." };
    }

    default:
      throw new PortalError(`Unsupported accountant action: ${action}.`, 422);
  }
}
