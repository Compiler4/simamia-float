import { prisma } from "@/lib/prisma";
import { getCompanyStaff } from "./users";

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum<T>(rows: T[], read: (row: T) => unknown) {
  return rows.reduce((total, row) => total + number(read(row)), 0);
}

function attendanceSessionCount(row: any, wanted: "PRESENT" | "ABSENT") {
  const values = [row.morningStatus, row.eveningStatus];
  if (wanted === "PRESENT") {
    return values.filter((value) => value === "PRESENT" || value === "LATE").length;
  }
  return values.filter((value) => value === "ABSENT").length;
}

export async function buildAccountantReport(input: {
  rawCompanyId: string | number;
  companyId: string;
  from: Date;
  toExclusive: Date;
  periodLabel: string;
}) {
  const staff = await getCompanyStaff(input.rawCompanyId);
  const staffIds = staff.map((row) => row.id);

  const [income, expenses, deposits, funding, attendance] = await Promise.all([
    prisma.accountantIncomeEntry.findMany({
      where: {
        companyId: input.companyId,
        staffId: { in: staffIds },
        status: "COMPLETED",
        transactionAt: { gte: input.from, lt: input.toExclusive },
      },
    }),
    prisma.accountantExpenseRequest.findMany({
      where: {
        companyId: input.companyId,
        staffId: { in: staffIds },
        status: "APPROVED",
        createdAt: { gte: input.from, lt: input.toExclusive },
      },
    }),
    prisma.accountantBankDeposit.findMany({
      where: {
        companyId: input.companyId,
        staffId: { in: staffIds },
        status: "VERIFIED",
        depositDate: { gte: input.from, lt: input.toExclusive },
      },
    }),
    prisma.accountantStaffFunding.findMany({
      where: {
        companyId: input.companyId,
        staffId: { in: staffIds },
        status: { in: ["ISSUED", "CONFIRMED", "RETURNED", "VERIFIED", "REJECTED"] },
        issuedAt: { gte: input.from, lt: input.toExclusive },
      },
    }),
    prisma.accountantAttendance.findMany({
      where: {
        companyId: input.companyId,
        userId: { in: staffIds },
        date: { gte: input.from, lt: input.toExclusive },
      },
    }),
  ]);

  const baseRows = staff.map((user) => {
    const userIncome = income.filter((row: any) => row.staffId === user.id);
    const userExpenses = expenses.filter((row: any) => row.staffId === user.id);
    const userDeposits = deposits.filter((row: any) => row.staffId === user.id);
    const userFunding = funding.filter((row: any) => row.staffId === user.id);
    const userAttendance = attendance.filter((row: any) => row.userId === user.id);

    const attendancePresent = userAttendance.reduce(
      (total: number, row: any) => total + attendanceSessionCount(row, "PRESENT"),
      0,
    );
    const attendanceAbsent = userAttendance.reduce(
      (total: number, row: any) => total + attendanceSessionCount(row, "ABSENT"),
      0,
    );
    const marked = attendancePresent + attendanceAbsent;
    const attendanceRate = marked > 0 ? Math.round((attendancePresent / marked) * 100) : 0;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      income: sum(userIncome, (row: any) => row.amount),
      approvedExpenses: sum(userExpenses, (row: any) => row.amount),
      verifiedDeposits: sum(userDeposits, (row: any) => row.amount),
      floatIssued: sum(userFunding, (row: any) => row.floatAmount),
      cashIssued: sum(userFunding, (row: any) => row.cashAmount),
      attendancePresent,
      attendanceAbsent,
      attendanceRate,
      transactions: userIncome.length,
      performanceScore: 0,
    };
  });

  const maxIncome = Math.max(0, ...baseRows.map((row) => row.income));
  const maxTransactions = Math.max(0, ...baseRows.map((row) => row.transactions));

  const rows = baseRows.map((row) => ({
    ...row,
    performanceScore: Math.round(
      row.attendanceRate * 0.5 +
      (maxIncome > 0 ? (row.income / maxIncome) * 100 * 0.3 : 0) +
      (maxTransactions > 0 ? (row.transactions / maxTransactions) * 100 * 0.2 : 0),
    ),
  }));

  const mostPresent = [...rows].sort((a, b) =>
    b.attendancePresent - a.attendancePresent || b.attendanceRate - a.attendanceRate,
  )[0] ?? null;
  const mostAbsent = [...rows].sort((a, b) =>
    b.attendanceAbsent - a.attendanceAbsent || a.attendanceRate - b.attendanceRate,
  )[0] ?? null;

  return {
    summary: {
      period: input.periodLabel,
      users: rows.length,
      totalIncome: sum(rows, (row) => row.income),
      totalExpenses: sum(rows, (row) => row.approvedExpenses),
      netIncome: sum(rows, (row) => row.income - row.approvedExpenses),
      totalDeposits: sum(rows, (row) => row.verifiedDeposits),
      totalFloat: sum(rows, (row) => row.floatIssued),
      totalCash: sum(rows, (row) => row.cashIssued),
      mostPresent,
      mostAbsent,
    },
    rows,
  };
}
