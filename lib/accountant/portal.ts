import { createHash } from "node:crypto";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type AccountantContext = {
  session: any;
  accountant: any;
  company: any;
  companyId: string;
  accountantId: string;
};

export type DateRange = {
  period: "DAY" | "WEEK" | "MONTH" | "YEAR" | "CUSTOM";
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  anchor: string;
  label: string;
};

const prisma = db as any;
const TZ_OFFSET = "+03:00";

export function number(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function dateKey(value: unknown = new Date()): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

export function startOfDay(key: string): Date {
  return new Date(`${key}T00:00:00.000${TZ_OFFSET}`);
}

export function endOfDay(key: string): Date {
  return new Date(`${key}T23:59:59.999${TZ_OFFSET}`);
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function monthStart(anchor: Date): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1) - 3 * 60 * 60 * 1000);
}

function monthEnd(anchor: Date): Date {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1) - 3 * 60 * 60 * 1000 - 1);
}

export function parseRange(searchParams: URLSearchParams): DateRange {
  const rawPeriod = text(searchParams.get("period") || "MONTH").toUpperCase();
  const period = (["DAY", "WEEK", "MONTH", "YEAR", "CUSTOM"].includes(rawPeriod)
    ? rawPeriod
    : "MONTH") as DateRange["period"];
  const anchor = searchParams.get("anchor") || dateKey();
  const anchorDate = startOfDay(anchor);

  let start = startOfDay(anchor);
  let end = endOfDay(anchor);

  if (period === "WEEK") {
    const weekday = (anchorDate.getUTCDay() + 6) % 7;
    start = addDays(anchorDate, -weekday);
    end = new Date(addDays(start, 7).getTime() - 1);
  } else if (period === "MONTH") {
    start = monthStart(anchorDate);
    end = monthEnd(anchorDate);
  } else if (period === "YEAR") {
    start = new Date(Date.UTC(anchorDate.getUTCFullYear(), 0, 1) - 3 * 60 * 60 * 1000);
    end = new Date(Date.UTC(anchorDate.getUTCFullYear() + 1, 0, 1) - 3 * 60 * 60 * 1000 - 1);
  } else if (period === "CUSTOM") {
    const from = searchParams.get("from") || anchor;
    const to = searchParams.get("to") || from;
    start = startOfDay(from);
    end = endOfDay(to);
  }

  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const label = startKey === endKey ? startKey : `${startKey} – ${endKey}`;
  return { period, start, end, startKey, endKey, anchor, label };
}

export async function requireAccountant(): Promise<AccountantContext> {
  const session = (await getCurrentUser()) as any;
  if (!session) throw new PortalError("AUTH_REQUIRED", 401);
  if (text(session.role).toUpperCase() !== "ACCOUNTANT") {
    throw new PortalError("ACCOUNTANT_ROLE_REQUIRED", 403);
  }
  if (!session.companyId) throw new PortalError("ACCOUNTANT_COMPANY_REQUIRED", 403);

  const accountant = await prisma.user.findUnique({
    where: { id: text(session.id) },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      profileImageUrl: true,
      assignedRegion: true,
      nidaNumber: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!accountant) throw new PortalError("ACCOUNTANT_NOT_FOUND", 404);
  if (text(accountant.companyId) !== text(session.companyId)) {
    throw new PortalError("ACCOUNTANT_COMPANY_MISMATCH", 403);
  }

  const company = await prisma.company.findUnique({
    where: { id: text(session.companyId) },
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      address: true,
      status: true,
    },
  });
  if (!company) throw new PortalError("COMPANY_NOT_FOUND", 404);

  return {
    session,
    accountant,
    company,
    companyId: text(session.companyId),
    accountantId: text(session.id),
  };
}

export class PortalError extends Error {
  status: number;
  details?: string;
  constructor(message: string, status = 400, details?: string) {
    super(message);
    this.name = "PortalError";
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error: unknown): Response {
  const portalError = error instanceof PortalError ? error : null;
  const message = portalError?.message || (error instanceof Error ? error.message : "Accountant request failed.");
  console.error("[ACCOUNTANT PORTAL]", error);
  return Response.json(
    {
      success: false,
      message,
      details: portalError?.details,
    },
    { status: portalError?.status || 500 },
  );
}

export async function safeQuery<T = any>(label: string, task: () => Promise<any>, fallback: any): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.warn(`[ACCOUNTANT OPTIONAL QUERY: ${label}]`, error);
    return fallback;
  }
}

export async function getSettings(companyId: string): Promise<Record<string, string>> {
  const rows = await safeQuery(
    "companySetting.findMany",
    () => prisma.companySetting.findMany({ where: { companyId }, select: { key: true, value: true } }),
    [],
  );
  return Object.fromEntries(rows.map((row: any) => [text(row.key), text(row.value)]));
}

export function getApprovalLimit(settings: Record<string, string>): number {
  return number(
    settings.accountantExpenseApprovalLimit ||
      settings.ACCOUNTANT_EXPENSE_APPROVAL_LIMIT ||
      settings.expenseApprovalLimit ||
      0,
  );
}

export async function audit(
  context: AccountantContext,
  action: string,
  module: string,
  details?: unknown,
): Promise<void> {
  const detailText = typeof details === "string" ? details : JSON.stringify(details ?? {});
  await safeQuery(
    "auditLog.create",
    () =>
      prisma.auditLog.create({
        data: {
          companyId: context.companyId,
          userId: context.accountantId,
          action,
          module,
          details: detailText,
        },
      }),
    null,
  );
  await safeQuery(
    "companyAuditEvent.create",
    () =>
      prisma.companyAuditEvent.create({
        data: {
          companyId: context.companyId,
          actorId: context.accountantId,
          actorName: text(context.accountant.name || context.accountant.email),
          actorRole: "ACCOUNTANT",
          action,
          module,
          details: detailText,
        },
      }),
    null,
  );
}

export async function notifyUser(
  context: AccountantContext,
  userId: string,
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
): Promise<void> {
  await safeQuery(
    "notification.create",
    () =>
      prisma.notification.create({
        data: {
          companyId: context.companyId,
          userId,
          title,
          message,
          type,
        },
      }),
    null,
  );
}

export async function notifyRole(
  context: AccountantContext,
  role: string,
  title: string,
  message: string,
  type = "INFO",
): Promise<void> {
  await safeQuery(
    "companyNotification.create",
    () =>
      prisma.companyNotification.create({
        data: {
          companyId: context.companyId,
          targetRole: role,
          title,
          message,
          type,
          isRead: false,
        },
      }),
    null,
  );
}

export async function assertPeriodOpen(companyId: string, value: unknown): Promise<void> {
  const key = dateKey(value);
  if (!key) return;
  const periodKey = key.slice(0, 7);
  const locked = await safeQuery(
    "accountingPeriod.findFirst",
    () => prisma.accountingPeriod.findFirst({ where: { companyId, periodKey, status: "LOCKED" } }),
    null,
  );
  if (locked) throw new PortalError(`Accounting period ${periodKey} is locked.`, 409);
}

function parseStoredJson(value: unknown): any | null {
  try {
    return JSON.parse(text(value));
  } catch {
    return null;
  }
}

export const chartOfAccounts = [
  { id: "coa-1000", code: "1000", name: "Cash on Hand", type: "ASSET", normalBalance: "DEBIT" },
  { id: "coa-1010", code: "1010", name: "Bank", type: "ASSET", normalBalance: "DEBIT" },
  { id: "coa-1100", code: "1100", name: "Staff Float Receivable", type: "ASSET", normalBalance: "DEBIT" },
  { id: "coa-2000", code: "2000", name: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT" },
  { id: "coa-3000", code: "3000", name: "Opening Balance Equity", type: "EQUITY", normalBalance: "CREDIT" },
  { id: "coa-3100", code: "3100", name: "Retained Earnings", type: "EQUITY", normalBalance: "CREDIT" },
  { id: "coa-4000", code: "4000", name: "Service Revenue", type: "REVENUE", normalBalance: "CREDIT" },
  { id: "coa-4100", code: "4100", name: "Other Income", type: "REVENUE", normalBalance: "CREDIT" },
  { id: "coa-5000", code: "5000", name: "Operating Expenses", type: "EXPENSE", normalBalance: "DEBIT" },
];

type JournalLine = {
  id: string;
  date: Date;
  reference: string;
  description: string;
  account: string;
  code: string;
  type: string;
  debit: number;
  credit: number;
  user?: any;
  postedBy?: any;
};

function createJournal(input: {
  openingBalances: any[];
  services: any[];
  expenses: any[];
  deposits: any[];
  floats: any[];
  funding: any[];
  manualReceipts: any[];
}): JournalLine[] {
  const lines: JournalLine[] = [];
  const pushPair = (
    id: string,
    date: Date,
    reference: string,
    description: string,
    debit: { account: string; code: string; type: string; amount: number },
    credit: { account: string; code: string; type: string; amount: number },
    user?: any,
    postedBy?: any,
  ) => {
    const amount = Math.max(0, number(debit.amount || credit.amount));
    if (!amount) return;
    lines.push({ id: `${id}-d`, date, reference, description, account: debit.account, code: debit.code, type: debit.type, debit: amount, credit: 0, user, postedBy });
    lines.push({ id: `${id}-c`, date, reference, description, account: credit.account, code: credit.code, type: credit.type, debit: 0, credit: amount, user, postedBy });
  };

  for (const row of input.openingBalances) {
    const amount = number(row.amount);
    if (!amount) continue;
    const account = row.accountName || "Cash on Hand";
    const code = row.accountCode || "1000";
    const side = text(row.side || "DEBIT").toUpperCase();
    const debit = side === "DEBIT" ? { account, code, type: row.accountType || "ASSET", amount } : { account: "Opening Balance Equity", code: "3000", type: "EQUITY", amount };
    const credit = side === "CREDIT" ? { account, code, type: row.accountType || "EQUITY", amount } : { account: "Opening Balance Equity", code: "3000", type: "EQUITY", amount };
    pushPair(row.id, new Date(row.asOfDate), row.referenceNo || `OB-${code}`, `Opening balance · ${account}`, debit, credit, row.postedBy, row.postedBy);
  }

  for (const row of input.services) {
    if (text(row.status).toUpperCase() !== "COMPLETED") continue;
    pushPair(
      `service-${row.id}`,
      new Date(row.servedAt || row.createdAt),
      row.id,
      row.serviceType || "Completed service",
      { account: "Cash on Hand", code: "1000", type: "ASSET", amount: number(row.amount) },
      { account: "Service Revenue", code: "4000", type: "REVENUE", amount: number(row.amount) },
      row.staff,
      row.staff,
    );
  }

  for (const row of input.expenses) {
    if (text(row.status).toUpperCase() !== "APPROVED") continue;
    const expenseName = `${text(row.category || "Operating").replaceAll("_", " ")} Expense`;
    pushPair(
      `expense-${row.id}`,
      new Date(row.expenseDate || row.createdAt),
      row.id,
      row.description || expenseName,
      { account: expenseName, code: "5000", type: "EXPENSE", amount: number(row.amount) },
      { account: "Cash on Hand", code: "1000", type: "ASSET", amount: number(row.amount) },
      row.employee,
      row.reviewedBy,
    );
  }

  for (const row of input.deposits) {
    if (text(row.status).toUpperCase() !== "VERIFIED") continue;
    pushPair(
      `deposit-${row.id}`,
      new Date(row.depositDate || row.createdAt),
      row.referenceNo || row.id,
      "Verified bank deposit",
      { account: "Bank", code: "1010", type: "ASSET", amount: number(row.amount) },
      { account: "Cash on Hand", code: "1000", type: "ASSET", amount: number(row.amount) },
      row.staff,
      row.accountant,
    );
  }

  const fundingByFloat = new Map(input.funding.map((row) => [text(row.floatTransactionId), row]));
  for (const row of input.floats) {
    const status = text(row.status).toUpperCase();
    const funding = fundingByFloat.get(text(row.id));
    const totalIssued = funding ? number(funding.floatAmount) + number(funding.cashAmount) : number(row.amount);
    if (["ISSUED", "CONFIRMED", "RETURNED", "DEPOSITED", "APPROVED"].includes(status)) {
      pushPair(
        `float-issued-${row.id}`,
        new Date(row.issuedAt || row.createdAt),
        row.referenceNo || row.id,
        row.purpose || "Staff float issued",
        { account: "Staff Float Receivable", code: "1100", type: "ASSET", amount: totalIssued },
        { account: "Cash on Hand", code: "1000", type: "ASSET", amount: totalIssued },
        row.toUser,
        row.fromUser,
      );
    }
    const returned = number(row.returnedAmount);
    if (returned > 0 && ["RETURNED", "DEPOSITED", "APPROVED"].includes(status)) {
      pushPair(
        `float-return-${row.id}`,
        new Date(row.returnedAt || row.approvedAt || row.updatedAt),
        `${row.referenceNo || row.id}-RETURN`,
        "Staff float returned",
        { account: "Cash on Hand", code: "1000", type: "ASSET", amount: returned },
        { account: "Staff Float Receivable", code: "1100", type: "ASSET", amount: returned },
        row.toUser,
        row.approvedBy,
      );
    }
  }

  for (const row of input.manualReceipts) {
    pushPair(
      `manual-${row.id}`,
      new Date(row.transactionDate || row.createdAt),
      row.referenceNo || row.id,
      row.description || row.classification || "Manual receipt",
      { account: "Cash on Hand", code: "1000", type: "ASSET", amount: number(row.amount) },
      { account: row.classification === "STAFF_RETURN" ? "Staff Float Receivable" : "Other Income", code: row.classification === "STAFF_RETURN" ? "1100" : "4100", type: row.classification === "STAFF_RETURN" ? "ASSET" : "REVENUE", amount: number(row.amount) },
      row.sourceUser,
      row.postedBy,
    );
  }

  return lines.sort((left, right) => left.date.getTime() - right.date.getTime());
}

function ledgerFromJournal(journal: JournalLine[]) {
  const map = new Map<string, any>();
  for (const line of journal) {
    const existing = map.get(line.account) || {
      account: line.account,
      code: line.code,
      type: line.type,
      debit: 0,
      credit: 0,
      balance: 0,
    };
    existing.debit += number(line.debit);
    existing.credit += number(line.credit);
    existing.balance = existing.debit - existing.credit;
    map.set(line.account, existing);
  }
  return Array.from(map.values()).sort((a, b) => text(a.code).localeCompare(text(b.code)));
}

function buildStatements(ledger: any[], journal: JournalLine[], asOf: Date) {
  const accountRows = ledger.map((row) => ({
    code: row.code,
    name: row.account,
    amount: Math.abs(number(row.balance)),
    balance: number(row.balance),
    type: row.type,
  }));
  const assets = accountRows
    .filter((row) => row.type === "ASSET" && row.balance >= 0)
    .map((row) => ({ ...row, amount: Math.abs(row.balance) }));
  const liabilities = accountRows
    .filter((row) => row.type === "LIABILITY")
    .map((row) => ({ ...row, amount: Math.abs(row.balance) }));
  const revenues = accountRows
    .filter((row) => row.type === "REVENUE")
    .map((row) => ({ ...row, amount: Math.abs(row.balance) }));
  const expenses = accountRows
    .filter((row) => row.type === "EXPENSE")
    .map((row) => ({ ...row, amount: Math.abs(row.balance) }));
  const totalRevenue = revenues.reduce((sum, row) => sum + number(row.amount), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + number(row.amount), 0);
  const netIncome = totalRevenue - totalExpenses;
  const equityBase = accountRows
    .filter((row) => row.type === "EQUITY")
    .map((row) => ({ ...row, amount: Math.abs(row.balance) }));
  const equity = [
    ...equityBase,
    {
      code: "3100",
      name: "Current Period Earnings",
      amount: netIncome,
      balance: -netIncome,
      type: "EQUITY",
    },
  ];
  const totalAssets = assets.reduce((sum, row) => sum + number(row.amount), 0);
  const totalLiabilities = liabilities.reduce((sum, row) => sum + number(row.amount), 0);
  const totalEquity = equity.reduce((sum, row) => sum + number(row.amount), 0);

  let runningCash = 0;
  const cashRows = journal
    .filter((line) => line.account === "Cash on Hand")
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((line) => {
      const inflow = number(line.debit);
      const outflow = number(line.credit);
      const net = inflow - outflow;
      runningCash += net;
      return {
        id: line.id,
        date: line.date,
        reference: line.reference,
        description: line.description,
        inflow,
        outflow,
        net,
        balance: runningCash,
      };
    });

  const daily = new Map<string, any>();
  for (const row of cashRows) {
    const key = dateKey(row.date);
    const current = daily.get(key) || {
      key,
      label: key.slice(5),
      inflow: 0,
      outflow: 0,
      net: 0,
    };
    current.inflow += number(row.inflow);
    current.outflow += number(row.outflow);
    current.net = current.inflow - current.outflow;
    daily.set(key, current);
  }
  const series = Array.from(daily.values()).sort((a, b) =>
    text(a.key).localeCompare(text(b.key)),
  );
  const operatingInflow = cashRows.reduce(
    (sum, row) => sum + number(row.inflow),
    0,
  );
  const operatingOutflow = cashRows.reduce(
    (sum, row) => sum + number(row.outflow),
    0,
  );
  const openingCash = 0;
  const netCashFlow = operatingInflow - operatingOutflow;
  const closingCash = openingCash + netCashFlow;

  const profitTransactions = journal
    .filter((row) => ["REVENUE", "EXPENSE"].includes(row.type))
    .map((row) => {
      const revenue = row.type === "REVENUE" ? number(row.credit) : 0;
      const expense = row.type === "EXPENSE" ? number(row.debit) : 0;
      return {
        id: row.id,
        date: row.date,
        reference: row.reference,
        description: row.description,
        sourceType: row.type,
        revenue,
        expense,
        net: revenue - expense,
        postedBy: row.postedBy,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    balanceSheet: {
      asOf,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      liabilitiesAndEquity: totalLiabilities + totalEquity,
      difference: totalAssets - totalLiabilities - totalEquity,
      balanced:
        Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01,
    },
    profitAndLoss: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: netIncome,
      transactions: profitTransactions,
    },
    cashFlow: {
      openingCash,
      operatingInflow,
      operatingOutflow,
      closingCash,
      netCashFlow,
      series,
      rows: cashRows.slice().reverse(),
    },
  };
}

function attendanceAnalysis(staff: any[], attendance: any[]) {
  const progress = staff.map((user) => {
    const rows = attendance.filter((row) => text(row.userId) === text(user.id));
    let present = 0;
    let absent = 0;
    let late = 0;
    let marked = 0;
    for (const row of rows) {
      for (const status of [row.morningStatus, row.eveningStatus]) {
        if (!status) continue;
        marked += 1;
        if (status === "PRESENT") present += 1;
        else if (status === "LATE") {
          present += 1;
          late += 1;
        } else if (status === "ABSENT") absent += 1;
      }
      if (!row.morningStatus && !row.eveningStatus && row.status) {
        marked += 1;
        if (row.status === "PRESENT") present += 1;
        else if (row.status === "LATE") {
          present += 1;
          late += 1;
        } else if (row.status === "ABSENT") absent += 1;
      }
    }
    const rate = marked ? Math.round((present / marked) * 100) : 0;
    return { user, staffId: user.id, staffName: user.name, present, absent, late, marked, rate, attendanceRate: rate };
  });
  const mostPresent = [...progress].sort((a, b) => b.rate - a.rate || b.present - a.present)[0] || null;
  const mostAbsent = [...progress].sort((a, b) => b.absent - a.absent || a.rate - b.rate)[0] || null;
  const morningPresent = attendance.filter((row) => ["PRESENT", "LATE"].includes(text(row.morningStatus))).length;
  const morningAbsent = attendance.filter((row) => text(row.morningStatus) === "ABSENT").length;
  const eveningPresent = attendance.filter((row) => ["PRESENT", "LATE"].includes(text(row.eveningStatus))).length;
  const eveningAbsent = attendance.filter((row) => text(row.eveningStatus) === "ABSENT").length;
  return {
    progress,
    summary: { morningPresent, morningAbsent, eveningPresent, eveningAbsent, mostPresent, mostAbsent },
    mostPresent,
    mostAbsent,
  };
}

function mapFunding(fundingReceipts: any[], floats: any[]) {
  if (fundingReceipts.length) {
    return fundingReceipts.map((row) => ({
      ...row,
      totalAmount: number(row.floatAmount) + number(row.cashAmount),
      issuedAt: row.issuedAt || row.createdAt,
    }));
  }
  return floats
    .filter((row) => text(row.transactionType) === "ACCOUNTANT_TO_STAFF")
    .map((row) => ({
      id: row.id,
      companyId: row.companyId,
      staffId: row.toUserId,
      accountantId: row.fromUserId,
      referenceNo: row.referenceNo,
      floatAmount: number(row.amount),
      cashAmount: 0,
      totalAmount: number(row.amount),
      note: row.notes,
      status: row.status,
      issuedAt: row.issuedAt || row.createdAt,
      staff: row.toUser,
      accountant: row.fromUser,
      floatTransactionId: row.id,
    }));
}

export async function buildPortalData(context: AccountantContext, range?: DateRange) {
  const selectedRange = range || parseRange(new URLSearchParams());
  const dateWhere = { gte: selectedRange.start, lte: selectedRange.end };
  const companyId = context.companyId;

  const [
    settingsRows,
    adminSetting,
    users,
    branches,
    financialDays,
    expensesRaw,
    decisions,
    depositsRaw,
    floats,
    attendance,
    notifications,
    serviceActivities,
    periods,
    auditLogs,
    fundingReceipts,
    proofs,
    packets,
    devices,
    enrolments,
    performanceRecords,
  ] = await Promise.all([
    safeQuery("companySetting.findMany", () => prisma.companySetting.findMany({ where: { companyId } }), []),
    safeQuery("companyAdminSetting.findUnique", () => prisma.companyAdminSetting.findUnique({ where: { companyId } }), null),
    safeQuery("user.findMany", () => prisma.user.findMany({ where: { companyId }, select: { id: true, companyId: true, branchId: true, name: true, username: true, email: true, phone: true, role: true, status: true, profileImageUrl: true, assignedRegion: true, nidaNumber: true, createdAt: true, updatedAt: true, branch: { select: { id: true, name: true, code: true, region: true } } }, orderBy: { name: "asc" } }), []),
    safeQuery("branch.findMany", () => prisma.branch.findMany({ where: { companyId }, orderBy: { name: "asc" } }), []),
    safeQuery("financialDay.findMany", () => prisma.financialDay.findMany({ where: { companyId }, include: { openedBy: { select: { id: true, name: true, email: true } }, closedBy: { select: { id: true, name: true, email: true } } }, orderBy: { date: "desc" }, take: 370 }), []),
    safeQuery("expense.findMany", () => prisma.expense.findMany({ where: { companyId }, include: { employee: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true, assignedRegion: true } }, reviewedBy: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { expenseDate: "desc" }, take: 1000 }), []),
    safeQuery("approvalDecision.findMany", () => prisma.approvalDecision.findMany({ where: { companyId, itemType: "EXPENSE" }, orderBy: { decidedAt: "desc" } }), []),
    safeQuery("bankDeposit.findMany", () => prisma.bankDeposit.findMany({ where: { companyId }, include: { staff: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true, assignedRegion: true } }, accountant: { select: { id: true, name: true, email: true } }, holdClearedBy: { select: { id: true, name: true, email: true } } }, orderBy: { depositDate: "desc" }, take: 1000 }), []),
    safeQuery("floatTransaction.findMany", () => prisma.floatTransaction.findMany({ where: { companyId }, include: { fromUser: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true } }, toUser: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true } }, approvedBy: { select: { id: true, name: true, email: true } }, fundingReceipt: true }, orderBy: { createdAt: "desc" }, take: 1500 }), []),
    safeQuery("attendance.findMany", () => prisma.attendance.findMany({ where: { companyId, date: dateWhere }, include: { user: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true, assignedRegion: true } } }, orderBy: { date: "desc" } }), []),
    safeQuery("notification.findMany", () => prisma.notification.findMany({ where: { companyId, userId: context.accountantId }, orderBy: { createdAt: "desc" }, take: 250 }), []),
    safeQuery("serviceActivity.findMany", () => prisma.serviceActivity.findMany({ where: { companyId }, include: { staff: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true } }, broker: { select: { id: true, name: true, email: true } } }, orderBy: { servedAt: "desc" }, take: 2000 }), []),
    safeQuery("accountingPeriod.findMany", () => prisma.accountingPeriod.findMany({ where: { companyId }, include: { lockedBy: { select: { id: true, name: true, email: true } } }, orderBy: { startsAt: "desc" }, take: 60 }), []),
    safeQuery("auditLog.findMany", () => prisma.auditLog.findMany({ where: { companyId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 300 }), []),
    safeQuery("staffFundingReceipt.findMany", () => prisma.staffFundingReceipt.findMany({ where: { companyId }, include: { staff: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true, assignedRegion: true } }, accountant: { select: { id: true, name: true, email: true } }, networkLine: true }, orderBy: { issuedAt: "desc" }, take: 1500 }), []),
    safeQuery("staffProofSubmission.findMany", () => prisma.staffProofSubmission.findMany({ where: { companyId }, include: { staff: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true } }, verifiedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
    safeQuery("verificationPacket.findMany", () => prisma.verificationPacket.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
    safeQuery("attendanceDevice.findMany", () => prisma.attendanceDevice.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }), []),
    safeQuery("attendanceDeviceEnrollment.findMany", () => prisma.attendanceDeviceEnrollment.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }), []),
    safeQuery("performanceRecord.findMany", () => prisma.performanceRecord.findMany({ where: { companyId }, include: { user: { select: { id: true, name: true, email: true, role: true, profileImageUrl: true } } }, orderBy: [{ year: "desc" }, { month: "desc" }] }), []),
  ]);

  const settings = Object.fromEntries(settingsRows.map((row: any) => [text(row.key), text(row.value)]));
  if (adminSetting) Object.assign(settings, adminSetting);
  const approvalLimit = getApprovalLimit(settings);

  const expenses = expensesRaw.map((row: any) => ({
    ...row,
    decisions: decisions.filter((decision: any) => text(decision.itemId) === text(row.id)),
  }));
  const packetsByTarget = new Map<string, any[]>();
  for (const packet of packets) {
    const list = packetsByTarget.get(text(packet.targetId)) || [];
    list.push({ ...packet, adminMessage: packet.message });
    packetsByTarget.set(text(packet.targetId), list);
  }
  const deposits = depositsRaw.map((row: any) => ({ ...row, packets: packetsByTarget.get(text(row.id)) || [] }));
  const staff = users.filter((row: any) => text(row.role).toUpperCase() === "STAFF" && text(row.status).toUpperCase() === "ACTIVE");
  const funding = mapFunding(fundingReceipts, floats);

  const openingBalances = settingsRows
    .filter((row: any) => text(row.key).startsWith("accounting.openingBalance."))
    .map((row: any) => parseStoredJson(row.value))
    .filter(Boolean)
    .map((row: any) => ({
      ...row,
      account: {
        code: row.accountCode,
        name: row.accountName,
        type: row.accountType,
      },
      debit: text(row.side).toUpperCase() === "DEBIT" ? number(row.amount) : 0,
      credit: text(row.side).toUpperCase() === "CREDIT" ? number(row.amount) : 0,
    }))
    .sort((a: any, b: any) => new Date(b.asOfDate).getTime() - new Date(a.asOfDate).getTime());
  const manualReceipts = settingsRows
    .filter((row: any) => text(row.key).startsWith("accounting.manualReceipt."))
    .map((row: any) => parseStoredJson(row.value))
    .filter(Boolean)
    .map((row: any) => ({ ...row, sourceUser: users.find((user: any) => text(user.id) === text(row.sourceUserId)), postedBy: context.accountant }))
    .sort((a: any, b: any) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

  const journal = createJournal({ openingBalances, services: serviceActivities, expenses, deposits, floats, funding, manualReceipts });
  const ledger = ledgerFromJournal(journal);
  const trialRows = ledger.map((row: any) => ({ account: `${row.code} · ${row.account}`, balance: number(row.balance), debit: number(row.debit), credit: number(row.credit) }));
  const totalDebit = ledger.reduce((sum: number, row: any) => sum + number(row.debit), 0);
  const totalCredit = ledger.reduce((sum: number, row: any) => sum + number(row.credit), 0);
  const statements = buildStatements(ledger, journal, selectedRange.end);

  let running = 0;
  const cashBook = journal
    .filter((line) => line.account === "Cash on Hand" || line.account === "Bank")
    .map((line) => {
      running += number(line.debit) - number(line.credit);
      return {
        id: line.id,
        date: line.date,
        reference: line.reference,
        description: line.description,
        account: line.account,
        debit: line.debit,
        credit: line.credit,
        balance: running,
        user: line.user,
        postedBy: line.postedBy,
      };
    })
    .reverse();

  const currentDay = financialDays.find((row: any) => text(row.status) === "OPEN") || null;
  const inRange = (value: unknown) => {
    const time = new Date(String(value)).getTime();
    return Number.isFinite(time) && time >= selectedRange.start.getTime() && time <= selectedRange.end.getTime();
  };
  const rangeServices = serviceActivities.filter((row: any) => inRange(row.servedAt || row.createdAt) && text(row.status).toUpperCase() === "COMPLETED");
  const rangeExpenses = expenses.filter((row: any) => inRange(row.expenseDate || row.createdAt));
  const approvedExpenses = rangeExpenses.filter((row: any) => text(row.status).toUpperCase() === "APPROVED");
  const rangeDeposits = deposits.filter((row: any) => inRange(row.depositDate || row.createdAt));
  const rangeFunding = funding.filter((row: any) => inRange(row.issuedAt || row.createdAt));
  const totalIncome = rangeServices.reduce((sum: number, row: any) => sum + number(row.amount), 0) + manualReceipts.filter((row: any) => inRange(row.transactionDate)).reduce((sum: number, row: any) => sum + (row.classification === "STAFF_RETURN" ? 0 : number(row.amount)), 0);
  const totalExpenses = approvedExpenses.reduce((sum: number, row: any) => sum + number(row.amount), 0);
  const totalDeposits = rangeDeposits.filter((row: any) => text(row.status) === "VERIFIED").reduce((sum: number, row: any) => sum + number(row.amount), 0);
  const totalFloat = rangeFunding.reduce((sum: number, row: any) => sum + number(row.floatAmount), 0);
  const totalCash = rangeFunding.reduce((sum: number, row: any) => sum + number(row.cashAmount), 0);
  const outstandingFloat = floats.filter((row: any) => ["PENDING", "ISSUED", "CONFIRMED"].includes(text(row.status))).reduce((sum: number, row: any) => sum + Math.max(0, number(row.amount) - number(row.returnedAmount)), 0);
  const totalBalance = number(currentDay?.openingBalance) + totalIncome - totalExpenses;

  const attendanceData = attendanceAnalysis(staff, attendance);
  const fundingTotals = staff.map((user: any) => {
    const rows = funding.filter((row: any) => text(row.staffId) === text(user.id));
    const float = rows.reduce((sum: number, row: any) => sum + number(row.floatAmount), 0);
    const cash = rows.reduce((sum: number, row: any) => sum + number(row.cashAmount), 0);
    return { staff: user, count: rows.length, float, cash, combined: float + cash };
  });

  const monthlySeries: any[] = [];
  for (let index = 7; index >= 0; index -= 1) {
    const date = addDays(startOfDay(dateKey()), -index);
    const key = dateKey(date);
    const dayServices = serviceActivities.filter((row: any) => dateKey(row.servedAt || row.createdAt) === key && text(row.status).toUpperCase() === "COMPLETED");
    const dayExpenses = expenses.filter((row: any) => dateKey(row.expenseDate || row.createdAt) === key && text(row.status).toUpperCase() === "APPROVED");
    const dayDeposits = deposits.filter((row: any) => dateKey(row.depositDate || row.createdAt) === key && text(row.status).toUpperCase() === "VERIFIED");
    monthlySeries.push({
      key,
      label: key.slice(5),
      income: dayServices.reduce((sum: number, row: any) => sum + number(row.amount), 0),
      expense: dayExpenses.reduce((sum: number, row: any) => sum + number(row.amount), 0),
      deposit: dayDeposits.reduce((sum: number, row: any) => sum + number(row.amount), 0),
    });
  }

  const categoryMap = new Map<string, number>();
  for (const row of approvedExpenses) {
    const category = text(row.category || "OTHER").replaceAll("_", " ");
    categoryMap.set(category, number(categoryMap.get(category)) + number(row.amount));
  }
  const spendingBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

  const recentTransactions = cashBook.slice(0, 12).map((row: any) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    debit: row.debit,
    credit: row.credit,
    user: row.user || row.postedBy || context.accountant,
  }));
  const financialHolds = deposits.filter((row: any) => Boolean(row.holdActive));

  const performance = staff.map((user: any) => {
    const attendanceRow = attendanceData.progress.find((row: any) => text(row.staffId) === text(user.id));
    const services = rangeServices.filter((row: any) => text(row.staffId) === text(user.id));
    const staffFunding = funding.filter((row: any) => text(row.staffId) === text(user.id));
    const record = performanceRecords.find((row: any) => text(row.userId) === text(user.id));
    const score = record ? number(record.score) : Math.min(100, Math.round(number(attendanceRow?.rate) * 0.5 + Math.min(50, services.length * 5)));
    return {
      staffId: user.id,
      userId: user.id,
      staffName: user.name,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      attendanceRate: attendanceRow?.rate || 0,
      attendancePresent: attendanceRow?.present || 0,
      attendanceAbsent: attendanceRow?.absent || 0,
      serviceCount: services.length,
      floatTransactions: staffFunding.length,
      transactions: services.length + staffFunding.length,
      income: services.reduce((sum: number, row: any) => sum + number(row.amount), 0),
      verifiedDeposits: rangeDeposits.filter((row: any) => text(row.staffId) === text(user.id) && text(row.status) === "VERIFIED").reduce((sum: number, row: any) => sum + number(row.amount), 0),
      approvedExpenses: approvedExpenses.filter((row: any) => text(row.employeeId) === text(user.id)).reduce((sum: number, row: any) => sum + number(row.amount), 0),
      floatIssued: staffFunding.reduce((sum: number, row: any) => sum + number(row.floatAmount), 0),
      cashIssued: staffFunding.reduce((sum: number, row: any) => sum + number(row.cashAmount), 0),
      performanceScore: score,
      score,
      rating: record?.rating || (score >= 85 ? "EXCELLENT" : score >= 70 ? "GOOD" : score >= 50 ? "FAIR" : "NEEDS IMPROVEMENT"),
    };
  });

  const enrolmentsWithUsers = enrolments.map((row: any) => ({ ...row, user: users.find((user: any) => text(user.id) === text(row.userId)) }));

  const stats = {
    totalBalance,
    dailyIncome: monthlySeries.at(-1)?.income || 0,
    dailyExpenses: monthlySeries.at(-1)?.expense || 0,
    dailyNetProfit: (monthlySeries.at(-1)?.income || 0) - (monthlySeries.at(-1)?.expense || 0),
    pendingExpenses: expenses.filter((row: any) => text(row.status) === "PENDING").length,
    pendingFloats: floats.filter((row: any) => ["PENDING", "ISSUED", "CONFIRMED", "RETURNED"].includes(text(row.status))).length,
    outstandingFloat,
    unresolvedMismatches: deposits.filter((row: any) => text(row.status) !== "VERIFIED" || row.holdActive).length,
    unreadNotifications: notifications.filter((row: any) => !row.isRead).length,
  };

  const reportSummary = {
    period: selectedRange.label,
    users: staff.length,
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    totalDeposits,
    totalFloat,
    totalCash,
  };

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    range: { ...selectedRange, name: selectedRange.period },
    period: { name: selectedRange.period, label: selectedRange.label, start: selectedRange.start, end: selectedRange.end, startKey: selectedRange.startKey, endKey: selectedRange.endKey, anchor: selectedRange.anchor },
    accountant: { ...context.accountant, approvalLimit },
    company: context.company,
    settings,
    stats,
    currentDay,
    financialDays,
    users,
    staff,
    branches,
    expenses,
    deposits,
    floats,
    funding,
    fundingTotals,
    attendance,
    attendanceProgress: attendanceData.progress,
    attendanceSummary: attendanceData.summary,
    attendanceAnalytics: attendanceData.progress,
    mostPresent: attendanceData.mostPresent,
    mostAbsent: attendanceData.mostAbsent,
    notifications,
    serviceActivities,
    periods,
    auditLogs,
    monthlySeries,
    spendingBreakdown,
    cashBook,
    manualReceipts,
    chartOfAccounts,
    openingBalances,
    ledger,
    trialBalance: { rows: trialRows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 },
    statements,
    recentTransactions,
    financialHolds,
    proofs,
    packets: packets.map((row: any) => ({ ...row, adminMessage: row.message })),
    devices,
    enrolments: enrolmentsWithUsers,
    performance,
    reportSummary,
    summary: {
      totalIncome,
      approvedExpenseAmount: totalExpenses,
      netIncome: totalIncome - totalExpenses,
      combinedStaffFunds: totalFloat + totalCash,
      pendingExpenses: expenses.filter((row: any) => text(row.status) === "PENDING").length,
      pendingVerification: proofs.filter((row: any) => text(row.status) === "PENDING").length + packets.filter((row: any) => text(row.status) === "PENDING").length,
      expenseRequests: expenses.length,
      approvedExpenses: expenses.filter((row: any) => text(row.status) === "APPROVED").length,
      rejectedExpenses: expenses.filter((row: any) => text(row.status) === "REJECTED").length,
      pendingBankCases: deposits.filter((row: any) => text(row.status) !== "VERIFIED").length,
      unreadNotifications: notifications.filter((row: any) => !row.isRead).length,
    },
    features: { accountingPeriods: true, fingerprintDevices: true },
  };
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
