import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  dayBounds,
  ensureAttendanceMissingNotifications,
  ensureDefaultChartOfAccounts,
} from "@/lib/accountant/accounting";
import { requireAccountant } from "@/lib/accountant/permissions";

export const dynamic = "force-dynamic";

const mismatchStatuses = [
  "AMOUNT_MISMATCH",
  "MISSING_RECEIPT",
  "DUPLICATE_DEPOSIT",
  "MISSING_BANK_RECORD",
];

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function dateKey(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(value: unknown): string {
  return dateKey(value).slice(0, 7);
}

function requiredDelegate(name: string): any {
  const delegate = (db as any)[name];
  if (!delegate) throw new Error(`PRISMA_MODEL_MISSING:${name}`);
  return delegate;
}

function optionalDelegate(name: string): any | null {
  return (db as any)[name] ?? null;
}

async function optionalFindMany(name: string, args: any): Promise<any[]> {
  const delegate = optionalDelegate(name);
  if (!delegate?.findMany) return [];
  return delegate.findMany(args);
}

function accountType(code: string, chartType?: string): string {
  if (chartType) return chartType;
  if (code.startsWith("1")) return "ASSET";
  if (code.startsWith("2")) return "LIABILITY";
  if (code.startsWith("3")) return "EQUITY";
  if (code.startsWith("4")) return "REVENUE";
  if (code.startsWith("5")) return "EXPENSE";
  return "ASSET";
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message === "UNAUTHENTICATED") {
    return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Accountant access is required." }, { status: 403 });
  }
  console.error("[ACCOUNTANT_DASHBOARD]", error);
  return NextResponse.json(
    {
      success: false,
      message: message.startsWith("PRISMA_MODEL_MISSING")
        ? `${message}. Replace prisma/schema.prisma with the supplied complete schema, then run prisma db push and prisma generate.`
        : "Accountant dashboard could not load from the database.",
      error: message,
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const session = await requireAccountant();
    const companyId = session.companyId;
    const now = new Date();
    const { start: todayStart, end: todayEnd } = dayBounds(now);

    const companyDelegate = requiredDelegate("company");
    const userDelegate = requiredDelegate("user");
    const financialDayDelegate = requiredDelegate("financialDay");
    const expenseDelegate = requiredDelegate("expense");
    const bankDepositDelegate = requiredDelegate("bankDeposit");
    const floatDelegate = requiredDelegate("floatTransaction");
    const attendanceDelegate = requiredDelegate("attendance");
    const notificationDelegate = requiredDelegate("notification");
    const periodDelegate = requiredDelegate("accountingPeriod");
    const cashBookDelegate = requiredDelegate("cashBookEntry");
    const journalEntryDelegate = requiredDelegate("journalEntry");
    const manualReceiptDelegate = requiredDelegate("manualReceipt");

    const chartOfAccounts = await ensureDefaultChartOfAccounts(companyId);

    const [
      company,
      accountant,
      financialDays,
      users,
      branches,
      expenses,
      deposits,
      floats,
      attendance,
      notifications,
      periods,
      auditLogs,
      cashBookEntries,
      journalEntries,
      manualReceipts,
      serviceActivities,
      openingBalances,
    ] = await Promise.all([
      companyDelegate.findUnique({ where: { id: companyId } }),
      userDelegate.findUnique({ where: { id: session.id } }),
      financialDayDelegate.findMany({
        where: { companyId },
        include: { openedBy: true, closedBy: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 500,
      }),
      userDelegate.findMany({
        where: { companyId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          branchId: true,
          profileImageUrl: true,
          approvalLimit: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),
      optionalFindMany("branch", { where: { companyId }, orderBy: { name: "asc" } }),
      expenseDelegate.findMany({
        where: { companyId },
        include: { employee: true, reviewedBy: true, createdBy: true },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
      bankDepositDelegate.findMany({
        where: { companyId },
        include: { staff: true, accountant: true, holdClearedBy: true },
        orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
      floatDelegate.findMany({
        where: { companyId },
        include: { fromUser: true, toUser: true, approvedBy: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      attendanceDelegate.findMany({
        where: { companyId },
        include: { user: true, adjustedBy: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 10000,
      }),
      notificationDelegate.findMany({
        where: { companyId, userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      periodDelegate.findMany({
        where: { companyId },
        include: { lockedBy: true, reopenRequests: true },
        orderBy: { startsAt: "desc" },
        take: 120,
      }),
      optionalFindMany("auditLog", {
        where: { companyId },
        include: { actor: true, user: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      cashBookDelegate.findMany({
        where: { companyId },
        include: {
          postedBy: true,
          journalEntry: { include: { postedBy: true, lines: true } },
        },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: 20000,
      }),
      journalEntryDelegate.findMany({
        where: { companyId, status: "POSTED" },
        include: { lines: true, postedBy: true },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: 20000,
      }),
      manualReceiptDelegate.findMany({
        where: { companyId },
        include: { sourceUser: true, postedBy: true },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
      optionalFindMany("serviceActivity", {
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      optionalFindMany("openingBalance", {
        where: { companyId },
        include: { account: true, postedBy: true },
        orderBy: [{ asOfDate: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
    ]);

    await ensureAttendanceMissingNotifications(companyId, now);

    const currentDay = financialDays.find((item: any) => item.status === "OPEN") ?? null;
    const approvedExpenses = expenses.filter((item: any) => item.status === "APPROVED");
    const verifiedDeposits = deposits.filter((item: any) => item.status === "VERIFIED");
    const unresolved = deposits.filter((item: any) => mismatchStatuses.includes(String(item.status)));

    const chartMap = new Map<string, any>(chartOfAccounts.map((item: any) => [String(item.code), item]));
    const ledgerMap = new Map<string, any>();
    for (const entry of journalEntries) {
      for (const line of entry.lines ?? []) {
        const code = String(line.accountCode || "0000");
        const key = `${code}:${String(line.accountName || code)}`;
        const existing = ledgerMap.get(key) ?? {
          accountCode: code,
          account: String(line.accountName || code),
          type: accountType(code, chartMap.get(code)?.type),
          debit: 0,
          credit: 0,
          balance: 0,
        };
        existing.debit += num(line.debit);
        existing.credit += num(line.credit);
        existing.balance = existing.debit - existing.credit;
        ledgerMap.set(key, existing);
      }
    }
    const ledger = Array.from(ledgerMap.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const trialRows = ledger.map((row: any) => ({
      accountCode: row.accountCode,
      account: row.account,
      debit: row.balance > 0 ? row.balance : 0,
      credit: row.balance < 0 ? Math.abs(row.balance) : 0,
      balance: row.balance,
    }));
    const totalDebit = trialRows.reduce((sum: number, row: any) => sum + row.debit, 0);
    const totalCredit = trialRows.reduce((sum: number, row: any) => sum + row.credit, 0);

    const cashBook = cashBookEntries.map((item: any) => ({
      id: item.id,
      date: item.transactionDate,
      reference: item.reference,
      description: item.description,
      account: item.account,
      debit: num(item.debit),
      credit: num(item.credit),
      balance: num(item.runningBalance),
      type: item.type,
      sourceType: item.journalEntry?.sourceType,
      sourceId: item.journalEntry?.sourceId,
      postedBy: item.postedBy,
    }));

    const latestCash = cashBookEntries[0];
    const totalBalance = num(latestCash?.runningBalance ?? currentDay?.closingBalance ?? 0);
    const outstandingFloat = floats
      .filter((item: any) => ["PENDING", "ISSUED", "CONFIRMED", "RETURNED"].includes(String(item.status)))
      .reduce((sum: number, item: any) => sum + Math.max(0, num(item.amount) - num(item.returnedAmount)), 0);

    const revenueLines = ledger.filter((row: any) => row.type === "REVENUE");
    const expenseLines = ledger.filter((row: any) => row.type === "EXPENSE");
    const totalRevenue = revenueLines.reduce((sum: number, row: any) => sum + row.credit - row.debit, 0);
    const totalExpenses = expenseLines.reduce((sum: number, row: any) => sum + row.debit - row.credit, 0);

    const todayEntries = journalEntries.filter(
      (item: any) => new Date(item.transactionDate) >= todayStart && new Date(item.transactionDate) <= todayEnd,
    );
    const todayRevenue = todayEntries.reduce(
      (sum: number, entry: any) =>
        sum + (entry.lines ?? [])
          .filter((line: any) => accountType(String(line.accountCode), chartMap.get(String(line.accountCode))?.type) === "REVENUE")
          .reduce((lineSum: number, line: any) => lineSum + num(line.credit) - num(line.debit), 0),
      0,
    );
    const todayExpenses = todayEntries.reduce(
      (sum: number, entry: any) =>
        sum + (entry.lines ?? [])
          .filter((line: any) => accountType(String(line.accountCode), chartMap.get(String(line.accountCode))?.type) === "EXPENSE")
          .reduce((lineSum: number, line: any) => lineSum + num(line.debit) - num(line.credit), 0),
      0,
    );
    const todayCashBook = cashBook.filter(
      (item: any) => new Date(item.date) >= todayStart && new Date(item.date) <= todayEnd,
    );
    const todayCashIn = todayCashBook.reduce((sum: number, item: any) => sum + item.debit, 0);
    const todayCashOut = todayCashBook.reduce((sum: number, item: any) => sum + item.credit, 0);

    const dailyBuckets = Array.from({ length: 8 }, (_, index) => {
      const fromHour = index * 3;
      const toHour = fromHour + 3;
      const rows = todayCashBook.filter((item: any) => {
        const hour = new Date(item.date).getHours();
        return hour >= fromHour && hour < toHour;
      });
      return {
        key: `${dateKey(now)}-${fromHour}`,
        label: `${String(fromHour).padStart(2, "0")}:00`,
        income: rows.reduce((sum: number, item: any) => sum + item.debit, 0),
        expense: rows.reduce((sum: number, item: any) => sum + item.credit, 0),
        deposit: rows.filter((item: any) => item.type === "BANK_DEPOSIT").reduce((sum: number, item: any) => sum + item.debit, 0),
      };
    });

    const todaySpending = new Map<string, number>();
    for (const expense of approvedExpenses.filter(
      (item: any) => new Date(item.expenseDate ?? item.createdAt) >= todayStart && new Date(item.expenseDate ?? item.createdAt) <= todayEnd,
    )) {
      const category = String(expense.category || "OTHER");
      todaySpending.set(category, (todaySpending.get(category) ?? 0) + num(expense.amount));
    }
    const spendingBreakdown = Array.from(todaySpending.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);

    const expenseById = new Map<string, any>(expenses.map((item: any) => [String(item.id), item] as [string, any]));
    const depositById = new Map<string, any>(deposits.map((item: any) => [String(item.id), item] as [string, any]));
    const floatById = new Map<string, any>(floats.map((item: any) => [String(item.id), item] as [string, any]));
    const receiptById = new Map<string, any>(manualReceipts.map((item: any) => [String(item.id), item] as [string, any]));

    const recentTransactions = todayCashBook.slice(0, 30).map((item: any) => {
      let person = item.postedBy ?? null;
      if (item.sourceType === "EXPENSE") person = expenseById.get(String(item.sourceId))?.employee ?? person;
      if (item.sourceType === "BANK_DEPOSIT") person = depositById.get(String(item.sourceId))?.staff ?? person;
      if (["FLOAT_RETURN", "FLOAT_VERIFICATION"].includes(String(item.sourceType))) {
        const row = floatById.get(String(item.sourceId));
        person = row?.toUser ?? row?.fromUser ?? person;
      }
      if (item.sourceType === "MANUAL_RECEIPT") person = receiptById.get(String(item.sourceId))?.sourceUser ?? person;
      return {
        ...item,
        user: person
          ? {
              id: person.id,
              name: person.name,
              username: person.username,
              email: person.email,
              profileImageUrl: person.profileImageUrl,
            }
          : null,
      };
    });

    const assetRows = ledger
      .filter((row: any) => row.type === "ASSET")
      .map((row: any) => ({ code: row.accountCode, name: row.account, amount: row.debit - row.credit }));
    const liabilityRows = ledger
      .filter((row: any) => row.type === "LIABILITY")
      .map((row: any) => ({ code: row.accountCode, name: row.account, amount: row.credit - row.debit }));
    const baseEquityRows = ledger
      .filter((row: any) => row.type === "EQUITY")
      .map((row: any) => ({ code: row.accountCode, name: row.account, amount: row.credit - row.debit }));
    const currentEarnings = totalRevenue - totalExpenses;
    const equityRows = [...baseEquityRows, { code: "3999", name: "Current Earnings", amount: currentEarnings }];
    const totalAssets = assetRows.reduce((sum: number, row: any) => sum + row.amount, 0);
    const totalLiabilities = liabilityRows.reduce((sum: number, row: any) => sum + row.amount, 0);
    const totalEquity = equityRows.reduce((sum: number, row: any) => sum + row.amount, 0);

    const profitAndLossTransactions = journalEntries
      .map((entry: any) => {
        const revenue = (entry.lines ?? [])
          .filter((line: any) => accountType(String(line.accountCode), chartMap.get(String(line.accountCode))?.type) === "REVENUE")
          .reduce((sum: number, line: any) => sum + num(line.credit) - num(line.debit), 0);
        const expense = (entry.lines ?? [])
          .filter((line: any) => accountType(String(line.accountCode), chartMap.get(String(line.accountCode))?.type) === "EXPENSE")
          .reduce((sum: number, line: any) => sum + num(line.debit) - num(line.credit), 0);
        return {
          id: entry.id,
          date: entry.transactionDate,
          reference: entry.reference,
          description: entry.description,
          sourceType: entry.sourceType,
          revenue,
          expense,
          net: revenue - expense,
          postedBy: entry.postedBy,
        };
      })
      .filter((row: any) => row.revenue !== 0 || row.expense !== 0);

    const cashFlowRows = cashBook.map((item: any) => ({
      id: item.id,
      date: item.date,
      reference: item.reference,
      description: item.description,
      inflow: item.debit,
      outflow: item.credit,
      net: item.debit - item.credit,
      balance: item.balance,
      type: item.type,
    }));
    const cashFlowSeries = Array.from({ length: 30 }, (_, offset) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (29 - offset));
      const key = dateKey(date);
      const rows = cashFlowRows.filter((item: any) => dateKey(item.date) === key);
      return {
        key,
        label: date.toLocaleDateString("en-TZ", { day: "2-digit", month: "short" }),
        inflow: rows.reduce((sum: number, item: any) => sum + item.inflow, 0),
        outflow: rows.reduce((sum: number, item: any) => sum + item.outflow, 0),
        net: rows.reduce((sum: number, item: any) => sum + item.net, 0),
      };
    });

    return NextResponse.json(
      serializable({
        success: true,
        accountant,
        company,
        stats: {
          totalBalance,
          dailyIncome: todayRevenue,
          dailyExpenses: todayExpenses,
          dailyNetProfit: todayRevenue - todayExpenses,
          dailyCashIn: todayCashIn,
          dailyCashOut: todayCashOut,
          pendingExpenses: expenses.filter((item: any) => item.status === "PENDING").length,
          pendingDeposits: deposits.filter((item: any) => item.status === "PENDING").length,
          unresolvedMismatches: unresolved.length,
          pendingFloats: floats.filter((item: any) => ["PENDING", "ISSUED", "CONFIRMED", "RETURNED"].includes(String(item.status))).length,
          outstandingFloat,
        },
        currentDay,
        financialDays,
        users,
        branches,
        expenses,
        deposits,
        floats,
        attendance,
        notifications,
        serviceActivities,
        periods,
        auditLogs,
        monthlySeries: dailyBuckets,
        spendingBreakdown,
        cashBook,
        manualReceipts,
        ledger,
        chartOfAccounts,
        openingBalances,
        trialBalance: {
          rows: trialRows,
          totalDebit,
          totalCredit,
          balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        },
        statements: {
          balanceSheet: {
            asOf: now,
            assets: assetRows,
            liabilities: liabilityRows,
            equity: equityRows,
            totalAssets,
            totalLiabilities,
            totalEquity,
            liabilitiesAndEquity: totalLiabilities + totalEquity,
            difference: totalAssets - totalLiabilities - totalEquity,
            balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01,
          },
          profitAndLoss: {
            revenue: totalRevenue,
            expenses: totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            transactions: profitAndLossTransactions,
          },
          cashFlow: {
            openingCash: cashFlowRows.length ? cashFlowRows[cashFlowRows.length - 1].balance - cashFlowRows[cashFlowRows.length - 1].net : 0,
            operatingInflow: cashFlowRows.reduce((sum: number, item: any) => sum + item.inflow, 0),
            operatingOutflow: cashFlowRows.reduce((sum: number, item: any) => sum + item.outflow, 0),
            netCashFlow: cashFlowRows.reduce((sum: number, item: any) => sum + item.net, 0),
            closingCash: totalBalance,
            rows: cashFlowRows,
            series: cashFlowSeries,
          },
        },
        recentTransactions,
        financialHolds: unresolved,
        features: {
          accountingPeriods: true,
        },
        settings: {
          accountantExpenseApprovalLimit: num(
            accountant?.approvalLimit ?? company?.accountantExpenseApprovalLimit ?? 0,
          ),
        },
      }),
      { status: 200 },
    );
  } catch (error) {
    return apiError(error);
  }
}
