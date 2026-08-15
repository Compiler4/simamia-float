import { dayBounds } from "@/lib/accountant/accounting";
import { prisma } from "@/lib/prisma";

const MONEY_TOLERANCE = 0.01;

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function s(value: unknown): string {
  return String(value ?? "").trim();
}

export type CloseDayBlocker = {
  id: string;
  kind: "BANK" | "STAFF_FUNDING" | "LEGACY_FLOAT" | "RETURN_REVIEW";
  referenceNo: string;
  staffId?: string | null;
  staffName?: string | null;
  status: string;
  issuedAmount?: number;
  returnedAmount?: number;
  outstandingAmount?: number;
  reason: string;
};

export type CloseDaySettlement = {
  canClose: boolean;
  date: string;
  bankBlockers: number;
  staffFundingBlockers: number;
  legacyFloatBlockers: number;
  pendingReturnReviews: number;
  issuedAmount: number;
  verifiedReturnedAmount: number;
  outstandingAmount: number;
  blockers: CloseDayBlocker[];
};

/**
 * Builds the financial-day settlement check used by both the API and UI.
 *
 * Rules:
 * - Bank deposits recorded during the day must be VERIFIED and hold-free.
 * - AccountantStaffFunding issued on or before the day must be fully returned
 *   and VERIFIED (CANCELLED rows are ignored).
 * - The older FloatTransaction workflow is reconciled per staff member so
 *   separate STAFF_RETURN_TO_ACCOUNTANT rows can settle older
 *   ACCOUNTANT_TO_STAFF issues.
 * - A return that is only RETURNED/PENDING is not counted as settled until the
 *   accountant approves/verifies it.
 */
export async function getCloseDaySettlement(
  companyId: string,
  dayDate: unknown,
): Promise<CloseDaySettlement> {
  const { start, end } = dayBounds(dayDate);

  const [users, bankDeposits, staffFundings, legacyTransactions] =
    await Promise.all([
      prisma.user.findMany({
        where: { companyId },
        select: { id: true, name: true, email: true },
      }),
      prisma.bankDeposit.findMany({
        where: {
          companyId,
          depositDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          staffId: true,
          referenceNo: true,
          status: true,
          holdActive: true,
          mismatchReason: true,
          amount: true,
        },
        orderBy: { depositDate: "asc" },
      }),
      prisma.accountantStaffFunding.findMany({
        where: {
          companyId,
          issuedAt: { lte: end },
          status: { not: "CANCELLED" },
        },
        orderBy: { issuedAt: "asc" },
      }),
      prisma.floatTransaction.findMany({
        where: {
          companyId,
          createdAt: { lte: end },
          transactionType: {
            in: ["ACCOUNTANT_TO_STAFF", "STAFF_RETURN_TO_ACCOUNTANT"],
          },
        },
        select: {
          id: true,
          fromUserId: true,
          toUserId: true,
          transactionType: true,
          referenceNo: true,
          amount: true,
          returnedAmount: true,
          status: true,
          issuedAt: true,
          returnedAt: true,
          approvedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const userById = new Map(
    users.map((user) => [
      s(user.id),
      {
        name: s(user.name) || s(user.email) || "Staff user",
      },
    ]),
  );

  const blockers: CloseDayBlocker[] = [];

  // Only deposits belonging to this financial day block this day's closure.
  for (const deposit of bankDeposits) {
    const status = s(deposit.status).toUpperCase();
    if (status === "VERIFIED" && !deposit.holdActive) continue;

    blockers.push({
      id: s(deposit.id),
      kind: "BANK",
      referenceNo: s(deposit.referenceNo) || s(deposit.id),
      staffId: s(deposit.staffId) || null,
      staffName: userById.get(s(deposit.staffId))?.name ?? null,
      status,
      issuedAmount: n(deposit.amount),
      returnedAmount: 0,
      outstandingAmount: n(deposit.amount),
      reason: deposit.holdActive
        ? s(deposit.mismatchReason) || "A financial hold is still active."
        : status === "PENDING"
          ? "Bank deposit is still waiting for verification."
          : s(deposit.mismatchReason) || `Bank deposit is ${status.replaceAll("_", " ").toLowerCase()}.`,
    });
  }

  let issuedAmount = 0;
  let verifiedReturnedAmount = 0;

  // New accountant funding workflow. A return only settles the balance after
  // the accountant verifies it. This prevents a receipt upload by itself from
  // making the day look balanced.
  for (const funding of staffFundings) {
    const totalIssued = Math.max(
      0,
      n(funding.totalAmount) || n(funding.floatAmount) + n(funding.cashAmount),
    );
    const status = s(funding.status).toUpperCase();
    const returned = Math.min(totalIssued, Math.max(0, n(funding.returnedAmount)));
    const verifiedReturned = status === "VERIFIED" ? returned : 0;
    const outstanding = Math.max(0, totalIssued - verifiedReturned);

    issuedAmount += totalIssued;
    verifiedReturnedAmount += verifiedReturned;

    if (outstanding <= MONEY_TOLERANCE && status === "VERIFIED") continue;

    const staffName = userById.get(s(funding.staffId))?.name ?? "Staff user";
    let reason = `TZS ${outstanding.toLocaleString("en-TZ")} is still outstanding.`;

    if (status === "RETURNED") {
      reason = "The staff return was submitted but is still waiting for accountant verification.";
    } else if (status === "REJECTED") {
      reason = "The submitted return was rejected and must be corrected before closing.";
    } else if (status === "ISSUED" || status === "CONFIRMED") {
      reason = `${staffName} has not completed and verified the full return for this funding.`;
    }

    blockers.push({
      id: s(funding.id),
      kind: status === "RETURNED" ? "RETURN_REVIEW" : "STAFF_FUNDING",
      referenceNo: s(funding.referenceNo) || s(funding.id),
      staffId: s(funding.staffId) || null,
      staffName,
      status,
      issuedAmount: totalIssued,
      returnedAmount: status === "VERIFIED" ? verifiedReturned : returned,
      outstandingAmount: outstanding,
      reason,
    });
  }

  // Legacy FloatTransaction workflow. We reconcile it per staff member because
  // older versions created a separate STAFF_RETURN_TO_ACCOUNTANT transaction
  // rather than updating the original issue row.
  const legacyByStaff = new Map<
    string,
    {
      issued: number;
      returned: number;
      references: string[];
      pendingReturns: Array<{
        id: string;
        referenceNo: string;
        status: string;
        amount: number;
      }>;
    }
  >();

  function legacyBucket(staffId: string) {
    const existing = legacyByStaff.get(staffId);
    if (existing) return existing;
    const created = {
      issued: 0,
      returned: 0,
      references: [] as string[],
      pendingReturns: [] as Array<{
        id: string;
        referenceNo: string;
        status: string;
        amount: number;
      }>,
    };
    legacyByStaff.set(staffId, created);
    return created;
  }

  for (const row of legacyTransactions) {
    const type = s(row.transactionType).toUpperCase();
    const status = s(row.status).toUpperCase();

    if (type === "ACCOUNTANT_TO_STAFF") {
      if (status === "REJECTED") continue;
      const staffId = s(row.toUserId);
      if (!staffId) continue;
      const bucket = legacyBucket(staffId);
      const amount = Math.max(0, n(row.amount));
      bucket.issued += amount;
      bucket.references.push(s(row.referenceNo) || s(row.id));

      // Some older records stored the return on the original issue row.
      if (["APPROVED", "DEPOSITED"].includes(status)) {
        bucket.returned += Math.min(amount, Math.max(0, n(row.returnedAmount)));
      }
      continue;
    }

    if (type === "STAFF_RETURN_TO_ACCOUNTANT") {
      const staffId = s(row.fromUserId);
      if (!staffId) continue;
      const bucket = legacyBucket(staffId);
      const amount = Math.max(0, n(row.returnedAmount) || n(row.amount));
      const referenceNo = s(row.referenceNo) || s(row.id);

      if (["APPROVED", "DEPOSITED"].includes(status)) {
        bucket.returned += amount;
      } else if (["RETURNED", "PENDING", "ISSUED", "CONFIRMED"].includes(status)) {
        bucket.pendingReturns.push({
          id: s(row.id),
          referenceNo,
          status,
          amount,
        });
      }
    }
  }

  for (const [staffId, position] of legacyByStaff) {
    const outstanding = Math.max(0, position.issued - position.returned);
    issuedAmount += position.issued;
    verifiedReturnedAmount += Math.min(position.issued, position.returned);

    if (position.pendingReturns.length > 0) {
      for (const pending of position.pendingReturns) {
        blockers.push({
          id: pending.id,
          kind: "RETURN_REVIEW",
          referenceNo: pending.referenceNo,
          staffId,
          staffName: userById.get(staffId)?.name ?? "Staff user",
          status: pending.status,
          issuedAmount: 0,
          returnedAmount: pending.amount,
          outstandingAmount: outstanding,
          reason: "This returned amount is waiting for accountant verification.",
        });
      }
    }

    if (outstanding > MONEY_TOLERANCE) {
      blockers.push({
        id: `legacy-${staffId}`,
        kind: "LEGACY_FLOAT",
        referenceNo: position.references.slice(-3).join(", ") || staffId,
        staffId,
        staffName: userById.get(staffId)?.name ?? "Staff user",
        status: "OUTSTANDING",
        issuedAmount: position.issued,
        returnedAmount: Math.min(position.issued, position.returned),
        outstandingAmount: outstanding,
        reason: `TZS ${outstanding.toLocaleString("en-TZ")} from older staff float transactions is still outstanding.`,
      });
    }
  }

  const bankBlockers = blockers.filter((row) => row.kind === "BANK").length;
  const staffFundingBlockers = blockers.filter((row) => row.kind === "STAFF_FUNDING").length;
  const legacyFloatBlockers = blockers.filter((row) => row.kind === "LEGACY_FLOAT").length;
  const pendingReturnReviews = blockers.filter((row) => row.kind === "RETURN_REVIEW").length;
  const outstandingAmount = Math.max(0, issuedAmount - verifiedReturnedAmount);

  return {
    canClose: blockers.length === 0 && outstandingAmount <= MONEY_TOLERANCE,
    date: start.toISOString().slice(0, 10),
    bankBlockers,
    staffFundingBlockers,
    legacyFloatBlockers,
    pendingReturnReviews,
    issuedAmount,
    verifiedReturnedAmount,
    outstandingAmount,
    blockers,
  };
}

export type FinancialDayPreview = {
  cashIn: number;
  cashOut: number;
  closingBalance: number;
};

/**
 * Calculates the financial-day operating balance shown before close.
 * Staff-return receipts are excluded from operating income because they settle
 * a receivable; they are validated separately by getCloseDaySettlement().
 */
export async function getFinancialDayPreview(
  companyId: string,
  dayDate: unknown,
  openingBalance: unknown,
): Promise<FinancialDayPreview> {
  const { start, end } = dayBounds(dayDate);
  const [services, expenses, manualReceiptSettings] = await Promise.all([
    prisma.serviceActivity.findMany({
      where: {
        companyId,
        status: "COMPLETED",
        servedAt: { gte: start, lte: end },
      },
      select: { amount: true },
    }),
    prisma.expense.findMany({
      where: {
        companyId,
        status: "APPROVED",
        expenseDate: { gte: start, lte: end },
      },
      select: { amount: true },
    }),
    prisma.companySetting.findMany({
      where: {
        companyId,
        key: { startsWith: "accounting.manualReceipt." },
      },
      select: { value: true },
    }),
  ]);

  const manualReceipts = manualReceiptSettings
    .map((row) => {
      try {
        return JSON.parse(row.value) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .filter((row) => {
      const time = new Date(String(row.transactionDate ?? "")).getTime();
      return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
    });

  const serviceIncome = services.reduce((sum, row) => sum + n(row.amount), 0);
  const otherCashReceipts = manualReceipts
    .filter((row) => s(row.classification).toUpperCase() !== "STAFF_RETURN")
    .reduce((sum, row) => sum + n(row.amount), 0);
  const cashIn = serviceIncome + otherCashReceipts;
  const cashOut = expenses.reduce((sum, row) => sum + n(row.amount), 0);
  const closingBalance = n(openingBalance) + cashIn - cashOut;

  return { cashIn, cashOut, closingBalance };
}
