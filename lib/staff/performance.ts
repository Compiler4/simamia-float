import { db } from "@/lib/db";
import { reportBounds } from "./time";

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 100;
}

export function performanceRating(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  return "Needs Improvement";
}

export async function calculateStaffPerformance(input: {
  companyId: string;
  userId: string;
  period?: "DAY" | "WEEK" | "MONTH" | "YEAR";
  anchor?: string;
}) {
  const { start, end } = reportBounds(input.period || "MONTH", input.anchor);
  const [floats, collections, deposits, attendance, pings, services, expenses] = await Promise.all([
    (db as any).floatTransaction.findMany({
      where: {
        companyId: input.companyId,
        OR: [{ fromUserId: input.userId }, { toUserId: input.userId }],
        createdAt: { gte: start, lte: end },
      },
    }),
    (db as any).staffCollection.findMany({
      where: { companyId: input.companyId, staffId: input.userId, collectionDate: { gte: start, lte: end } },
    }),
    (db as any).bankDeposit.findMany({
      where: { companyId: input.companyId, staffId: input.userId, depositDate: { gte: start, lte: end } },
    }),
    (db as any).attendance.findMany({
      where: { companyId: input.companyId, userId: input.userId, date: { gte: start, lte: end } },
    }),
    (db as any).companyGpsPing.findMany({
      where: {
        companyId: input.companyId,
        capturedAt: { gte: start, lte: end },
        device: { ownerUserId: input.userId },
      },
      take: 10000,
    }),
    (db as any).serviceActivity.findMany({
      where: { companyId: input.companyId, staffId: input.userId, servedAt: { gte: start, lte: end } },
    }),
    (db as any).expense.findMany({
      where: { companyId: input.companyId, employeeId: input.userId, expenseDate: { gte: start, lte: end } },
    }),
  ]);

  const issuedRows = floats.filter(
    (row: any) => row.transactionType === "STAFF_TO_BROKER" && row.fromUserId === input.userId && row.status !== "REJECTED",
  );
  const incomingRows = floats.filter(
    (row: any) => row.transactionType === "ACCOUNTANT_TO_STAFF" && row.toUserId === input.userId && row.status !== "REJECTED",
  );
  const returnedRows = floats.filter(
    (row: any) => row.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && row.fromUserId === input.userId && row.status !== "REJECTED",
  );
  const totalFloatIssued = issuedRows.reduce((sum: number, row: any) => sum + n(row.amount), 0);
  const totalFloatReceived = incomingRows.reduce((sum: number, row: any) => sum + n(row.amount), 0);
  const totalCollections = collections.filter((row: any) => row.status !== "REJECTED").reduce((sum: number, row: any) => sum + n(row.amount), 0);
  const totalReturned = returnedRows.reduce((sum: number, row: any) => sum + n(row.returnedAmount ?? row.amount), 0);
  const totalBanked = deposits.filter((row: any) => row.status !== "DUPLICATE_DEPOSIT").reduce((sum: number, row: any) => sum + n(row.amount), 0);
  const outstandingBalance = Math.max(0, totalFloatReceived + totalCollections - totalFloatIssued - totalReturned - totalBanked);

  const returnMinutes = returnedRows
    .map((row: any) => {
      const incoming = incomingRows.find((candidate: any) => new Date(candidate.createdAt) <= new Date(row.createdAt));
      if (!incoming) return null;
      return Math.max(0, (new Date(row.createdAt).getTime() - new Date(incoming.createdAt).getTime()) / 60000);
    })
    .filter((value: number | null): value is number => value != null);
  const averageReturnMinutes = returnMinutes.length
    ? returnMinutes.reduce((sum: number, value: number) => sum + value, 0) / returnMinutes.length
    : 0;

  const verifiedDeposits = deposits.filter((row: any) => row.status === "VERIFIED").length;
  const depositAccuracyRate = pct(verifiedDeposits, deposits.length);
  const bankMismatches = deposits.filter((row: any) => row.status !== "VERIFIED" && row.status !== "PENDING").length;
  const present = attendance.filter((row: any) => ["PRESENT", "LATE"].includes(row.status)).length;
  const attendanceRate = pct(present, attendance.length);
  const gpsComplianceRate = pings.length ? 100 : 0;
  const approvedExpenses = expenses.filter((row: any) => row.status === "APPROVED").length;
  const rejectedExpenses = expenses.filter((row: any) => row.status === "REJECTED").length;
  const approvalComplianceRate = pct(approvedExpenses, approvedExpenses + rejectedExpenses);
  const customerVisits = new Set(services.filter((row: any) => row.customerId).map((row: any) => row.customerId)).size;
  const brokerVisits = new Set([
    ...issuedRows.map((row: any) => row.toUserId).filter(Boolean),
    ...collections.map((row: any) => row.brokerId).filter(Boolean),
  ]).size;
  const transactionsCompleted =
    issuedRows.length +
    collections.filter((row: any) => row.status !== "REJECTED").length +
    returnedRows.length +
    verifiedDeposits;

  const returnScore = averageReturnMinutes === 0 ? 70 : Math.max(0, 100 - Math.max(0, averageReturnMinutes - 480) / 6);
  const mismatchScore = deposits.length ? Math.max(0, 100 - (bankMismatches / deposits.length) * 100) : 100;
  const outstandingScore = totalFloatReceived + totalCollections > 0
    ? Math.max(0, 100 - (outstandingBalance / (totalFloatReceived + totalCollections)) * 100)
    : 100;
  const score = Math.round(
    attendanceRate * 0.2 +
      depositAccuracyRate * 0.2 +
      gpsComplianceRate * 0.15 +
      returnScore * 0.15 +
      mismatchScore * 0.1 +
      outstandingScore * 0.1 +
      approvalComplianceRate * 0.1,
  );

  return {
    totalFloatIssued,
    totalFloatReceived,
    totalCollections,
    totalReturned,
    totalBanked,
    outstandingBalance,
    averageReturnMinutes,
    depositAccuracyRate,
    bankMismatches,
    attendanceRate,
    gpsComplianceRate,
    customerVisits,
    brokerVisits,
    transactionsCompleted,
    approvalComplianceRate,
    score: Math.max(0, Math.min(100, score)),
    rating: performanceRating(score),
    start,
    end,
  };
}
