import "server-only";

import { prisma } from "@/lib/prisma";

import type { PortalUser } from "./guard";
import { isWithin, resolveRange } from "./range";

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function matchesSearch(search: string, values: unknown[]) {
  if (!search) return true;
  return values
    .map((value) => text(value))
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function recordDate(row: any) {
  return (
    row.attendanceDate ??
    row.occurredAt ??
    row.expenseDate ??
    row.depositDate ??
    row.serviceDate ??
    row.issuedAt ??
    row.createdAt ??
    row.updatedAt
  );
}

async function safeFindMany(delegate: any, args: any = {}) {
  if (typeof delegate?.findMany !== "function") return [];
  try {
    return await delegate.findMany(args);
  } catch (error) {
    console.error("ACCOUNTANT_V3_SAFE_QUERY_FAILED", error);
    return [];
  }
}


function localDateKey(value: unknown) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function staffIdFrom(row: any) {
  return text(
    row.staffId ??
      row.employeeId ??
      row.userId ??
      row.requestedById ??
      row.assignedToId ??
      row.ownerUserId,
  );
}

function isApprovedExpense(row: any) {
  const status = text(row.status ?? row.approvalStatus).toUpperCase();
  return status === "APPROVED";
}

function incomeFromActivity(row: any) {
  return number(
    row.amount ??
      row.serviceAmount ??
      row.collectedAmount ??
      row.totalAmount ??
      row.income,
  );
}

function floatAmount(row: any) {
  return number(row.amount ?? row.floatAmount ?? row.assignedAmount ?? row.totalAmount);
}

function attendanceMarkScore(mark: string) {
  if (mark === "PRESENT") return 1;
  if (mark === "LATE") return 0.75;
  if (mark === "EXCUSED") return 0.5;
  return 0;
}

export async function buildAccountantControlCenterData(
  user: PortalUser,
  params: URLSearchParams,
) {
  const db = prisma as any;
  const range = resolveRange(params);
  const search = text(params.get("search")).trim().toLowerCase();

  const [staffRows, expensesRaw, decisions, moneyEntries, attendance, devices, enrollments, packets, bankComparisons, serviceRaw, floatRaw, notifications] =
    await Promise.all([
      safeFindMany(db.user, {
        where: {
          companyId: user.companyId,
          role: "STAFF",
          status: "ACTIVE",
        },
        orderBy: { name: "asc" },
      }),
      safeFindMany(db.expense, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      safeFindMany(db.accountantExpenseDecision, {
        where: { companyId: user.companyId },
        orderBy: { decidedAt: "desc" },
      }),
      safeFindMany(db.accountantStaffMoneyEntry, {
        where: {
          companyId: user.companyId,
          occurredAt: { gte: range.start, lte: range.end },
        },
        orderBy: { occurredAt: "desc" },
      }),
      safeFindMany(db.accountantAttendanceSessionRecord, {
        where: {
          companyId: user.companyId,
          attendanceDate: { gte: range.start, lte: range.end },
        },
        orderBy: [{ attendanceDate: "desc" }, { session: "asc" }],
      }),
      safeFindMany(db.accountantFingerprintDevice, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
      }),
      safeFindMany(db.accountantFingerprintEnrollment, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
      }),
      safeFindMany(db.accountantVerificationPacket, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      safeFindMany(db.accountantBankComparison, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      safeFindMany(db.serviceActivity, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      safeFindMany(db.floatTransaction, {
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      safeFindMany(db.notification, {
        where: { companyId: user.companyId, userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

  const staff = staffRows
    .map((item: any) => ({
      id: text(item.id),
      name: text(item.name ?? item.username ?? item.email ?? "Staff"),
      username: text(item.username),
      email: text(item.email),
      phone: text(item.phone),
      assignedRegion: text(item.assignedRegion),
      profileImageUrl: text(item.profileImageUrl),
      branchId: text(item.branchId),
    }))
    .filter((item: any) => {
      if (!search) return true;
      return [item.name, item.username, item.email, item.phone, item.assignedRegion]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });

  const staffMap = new Map<string, any>(
    staffRows.map((item: any) => [text(item.id), item] as [string, any]),
  );
  const visibleStaffIds = new Set(staff.map((item: any) => text(item.id)));

  const expenses = expensesRaw
    .filter((row: any) =>
      isWithin(recordDate(row), range.start, range.end) &&
      staffMap.has(staffIdFrom(row)),
    )
    .map((row: any) => {
      const expenseId = text(row.id);
      const relatedDecisions = decisions.filter(
        (item: any) => text(item.expenseId) === expenseId,
      );
      const accountantDecision = relatedDecisions.find(
        (item: any) => item.actorRole === "ACCOUNTANT",
      );
      const adminDecision = relatedDecisions.find(
        (item: any) => item.actorRole === "COMPANY_ADMIN",
      );
      const staffId = staffIdFrom(row);
      const staffRecord = staffMap.get(staffId);
      return {
        ...row,
        id: expenseId,
        amount: number(row.amount),
        staffId,
        staffName: text(staffRecord?.name ?? staffRecord?.username ?? staffRecord?.email ?? "Unknown staff"),
        accountantDecision: accountantDecision?.decision ?? "PENDING",
        accountantReason: text(accountantDecision?.reason),
        adminDecision: adminDecision?.decision ?? "PENDING",
        adminReason: text(adminDecision?.reason),
        finalStatus: text(row.status ?? row.approvalStatus ?? "PENDING").toUpperCase(),
        date: recordDate(row),
      };
    })
    .filter((row: any) =>
      matchesSearch(search, [
        row.staffName,
        row.category,
        row.type,
        row.description,
        row.purpose,
        row.reference,
        row.referenceNo,
        row.finalStatus,
      ]),
    );

  const filteredPackets = packets.filter((row: any) => {
    if (!isWithin(recordDate(row), range.start, range.end)) return false;
    const staffRecord = staffMap.get(text(row.staffId));
    return matchesSearch(search, [
      staffRecord?.name,
      staffRecord?.username,
      staffRecord?.email,
      staffRecord?.phone,
      row.kind,
      row.status,
      row.staffMessage,
      row.adminReferenceMessage,
      row.decisionReason,
    ]);
  });
  const filteredBank = bankComparisons.filter((row: any) => {
    if (!isWithin(recordDate(row), range.start, range.end)) return false;
    const staffRecord = staffMap.get(text(row.staffId));
    return matchesSearch(search, [
      staffRecord?.name,
      staffRecord?.username,
      staffRecord?.email,
      row.staffReference,
      row.adminReference,
      row.staffBankAccount,
      row.adminBankAccount,
      row.accountantDecision,
      row.mismatchReason,
    ]);
  });
  const filteredService = serviceRaw.filter((row: any) =>
    isWithin(recordDate(row), range.start, range.end) &&
    (!search || visibleStaffIds.has(staffIdFrom(row))),
  );
  const filteredFloats = floatRaw.filter((row: any) =>
    isWithin(recordDate(row), range.start, range.end) &&
    (!search || visibleStaffIds.has(staffIdFrom(row))),
  );
  const filteredMoneyEntries = moneyEntries.filter(
    (row: any) => !search || visibleStaffIds.has(text(row.staffId)),
  );
  const filteredAttendance = attendance.filter(
    (row: any) => !search || visibleStaffIds.has(text(row.staffId)),
  );

  const moneyByStaff = new Map<string, any>();

  function emptyMoneySummary(staffId: string) {
    return {
      staffId,
      manualFloatAllocated: 0,
      manualFloatReturned: 0,
      systemFloatAllocated: 0,
      systemFloatReturned: 0,
      systemFloatOutstanding: 0,
      floatAllocated: 0,
      cashAllocated: 0,
      cashReceived: 0,
      cashReturned: 0,
      returned: 0,
      netAvailable: 0,
      entries: 0,
      systemFloatTransactions: 0,
    };
  }

  function moneyFor(staffId: string) {
    const current = moneyByStaff.get(staffId) ?? emptyMoneySummary(staffId);
    moneyByStaff.set(staffId, current);
    return current;
  }

  for (const item of filteredMoneyEntries) {
    const staffId = text(item.staffId);
    if (!staffId || !staffMap.has(staffId)) continue;
    const current = moneyFor(staffId);
    const amount = number(item.amount);
    const kind = text(item.kind).toUpperCase();
    const direction = text(item.direction).toUpperCase();

    if (kind === "FLOAT") {
      if (["ALLOCATE", "RECEIVE", "ADJUSTMENT"].includes(direction)) {
        current.manualFloatAllocated += amount;
      }
      if (direction === "RETURN") current.manualFloatReturned += amount;
    }

    if (kind === "CASH") {
      if (direction === "ALLOCATE") current.cashAllocated += amount;
      if (["RECEIVE", "ADJUSTMENT"].includes(direction)) current.cashReceived += amount;
      if (direction === "RETURN") current.cashReturned += amount;
    }

    current.entries += 1;
  }

  for (const item of filteredFloats) {
    const staffId = staffIdFrom(item);
    if (!staffId || !staffMap.has(staffId)) continue;

    const status = text(item.status ?? item.floatStatus).toUpperCase();
    if (["REJECTED", "CANCELLED", "CANCELED", "DECLINED", "VOID"].includes(status)) {
      continue;
    }

    const current = moneyFor(staffId);
    const amount = floatAmount(item);
    const explicitReturned = number(
      item.returnedAmount ??
        item.amountReturned ??
        item.returnAmount ??
        item.settledAmount,
    );
    const fullyReturned = [
      "RETURNED",
      "VERIFIED",
      "SETTLED",
      "COMPLETED",
      "DEPOSITED",
      "CLOSED",
    ].includes(status);
    const returnedAmount = Math.max(
      0,
      Math.min(amount, explicitReturned > 0 ? explicitReturned : fullyReturned ? amount : 0),
    );

    current.systemFloatAllocated += amount;
    current.systemFloatReturned += returnedAmount;
    current.systemFloatOutstanding += Math.max(0, amount - returnedAmount);
    current.systemFloatTransactions += 1;
  }

  for (const current of moneyByStaff.values()) {
    current.floatAllocated = current.manualFloatAllocated + current.systemFloatAllocated;
    current.returned =
      current.manualFloatReturned + current.systemFloatReturned + current.cashReturned;
    current.netAvailable =
      current.manualFloatAllocated -
      current.manualFloatReturned +
      current.systemFloatAllocated -
      current.systemFloatReturned +
      current.cashAllocated +
      current.cashReceived -
      current.cashReturned;
  }

  const attendanceByStaff = new Map<string, any>();
  for (const staffItem of staffRows.filter((item: any) => visibleStaffIds.has(text(item.id)))) {
    attendanceByStaff.set(text(staffItem.id), {
      staffId: text(staffItem.id),
      staffName: text(staffItem.name ?? staffItem.username ?? staffItem.email),
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      morning: 0,
      evening: 0,
      sessions: 0,
      score: 0,
      attendanceRate: 0,
    });
  }

  for (const item of filteredAttendance) {
    const current = attendanceByStaff.get(text(item.staffId));
    if (!current) continue;
    const mark = text(item.mark).toUpperCase();
    if (mark === "PRESENT") current.present += 1;
    if (mark === "ABSENT") current.absent += 1;
    if (mark === "LATE") current.late += 1;
    if (mark === "EXCUSED") current.excused += 1;
    if (item.session === "MORNING") current.morning += 1;
    if (item.session === "EVENING") current.evening += 1;
    current.sessions += 1;
    current.score += attendanceMarkScore(mark);
  }

  const attendanceAnalytics = Array.from(attendanceByStaff.values()).map((row: any) => ({
    ...row,
    attendanceRate: row.sessions ? Math.round((row.score / row.sessions) * 100) : 0,
  }));

  const measuredAttendance = attendanceAnalytics.filter((row: any) => row.sessions > 0);
  const mostPresent = [...measuredAttendance].sort(
    (a, b) => b.attendanceRate - a.attendanceRate || b.present - a.present,
  )[0] ?? null;
  const mostAbsent = [...measuredAttendance].sort(
    (a, b) => b.absent - a.absent || a.attendanceRate - b.attendanceRate,
  )[0] ?? null;

  const moneySummary = staffRows
    .filter((staffItem: any) => visibleStaffIds.has(text(staffItem.id)))
    .map((staffItem: any) => {
      const staffId = text(staffItem.id);
      const totals = moneyByStaff.get(staffId) ?? emptyMoneySummary(staffId);
      return {
        ...totals,
        staffName: text(staffItem.name ?? staffItem.username ?? staffItem.email),
        email: text(staffItem.email),
      };
    });

  const serviceIncome = filteredService.reduce(
    (total: number, row: any) => total + incomeFromActivity(row),
    0,
  );
  const staffCashReceived = filteredMoneyEntries
    .filter(
      (row: any) =>
        text(row.kind).toUpperCase() === "CASH" &&
        ["RECEIVE", "ADJUSTMENT"].includes(text(row.direction).toUpperCase()),
    )
    .reduce((total: number, row: any) => total + number(row.amount), 0);
  const approvedExpenses = expenses
    .filter(isApprovedExpense)
    .reduce((total: number, row: any) => total + number(row.amount), 0);
  const systemAllocatedFloat = moneySummary.reduce(
    (total: number, row: any) => total + number(row.systemFloatAllocated),
    0,
  );
  const manualAllocatedFloat = moneySummary.reduce(
    (total: number, row: any) => total + number(row.manualFloatAllocated),
    0,
  );
  const allocatedFloat = systemAllocatedFloat + manualAllocatedFloat;
  const allocatedCash = moneySummary.reduce(
    (total: number, row: any) =>
      total + number(row.cashAllocated) + number(row.cashReceived),
    0,
  );
  const combinedStaffFunds = moneySummary.reduce(
    (total: number, row: any) => total + number(row.netAvailable),
    0,
  );

  // Staff cash/float transfers are working capital, not revenue. Company income
  // is generated from completed service activities across all users.
  const totalIncome = serviceIncome;
  const netIncome = totalIncome - approvedExpenses;
  const totalFloat = systemAllocatedFloat;

  const performance = attendanceAnalytics.map((item: any) => {
    const staffId = item.staffId;
    const services = filteredService.filter((row: any) => staffIdFrom(row) === staffId);
    const floats = filteredFloats.filter((row: any) => staffIdFrom(row) === staffId);
    const money = moneyByStaff.get(staffId) ?? { netAvailable: 0 };
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(item.attendanceRate * 0.55 + Math.min(25, services.length * 2.5) + Math.min(20, floats.length * 2)),
      ),
    );
    return {
      staffId,
      staffName: item.staffName,
      attendanceRate: item.attendanceRate,
      serviceCount: services.length,
      floatTransactions: floats.length,
      netAvailable: money.netAvailable,
      score,
      rating:
        score >= 90
          ? "Excellent"
          : score >= 80
            ? "Very Good"
            : score >= 70
              ? "Good"
              : score >= 60
                ? "Fair"
                : "Needs Improvement",
    };
  });

  const attendanceMap = filteredAttendance.map((row: any) => ({
    ...row,
    dateKey: localDateKey(row.attendanceDate),
    staffName: text(staffMap.get(text(row.staffId))?.name ?? staffMap.get(text(row.staffId))?.email ?? "Unknown staff"),
  }));

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    period: {
      name: range.period,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      startKey: range.startKey,
      endKey: range.endKey,
      anchor: range.anchor,
    },
    accountant: user,
    staff,
    expenses,
    moneyEntries: filteredMoneyEntries.map((row: any) => ({
      ...row,
      amount: number(row.amount),
      staffName: text(staffMap.get(text(row.staffId))?.name ?? staffMap.get(text(row.staffId))?.email ?? "Unknown staff"),
    })),
    moneySummary,
    attendance: attendanceMap,
    attendanceAnalytics,
    mostPresent,
    mostAbsent,
    devices,
    enrollments,
    verificationPackets: filteredPackets.map((row: any) => ({
      ...row,
      staffName: text(staffMap.get(text(row.staffId))?.name ?? staffMap.get(text(row.staffId))?.email ?? "Unknown staff"),
    })),
    bankComparisons: filteredBank.map((row: any) => ({
      ...row,
      staffName: text(staffMap.get(text(row.staffId))?.name ?? staffMap.get(text(row.staffId))?.email ?? "Unknown staff"),
      staffAmount: number(row.staffAmount),
      adminAmount: number(row.adminAmount),
    })),
    notifications,
    performance,
    summary: {
      staffCount: staff.length,
      expenseRequests: expenses.length,
      pendingExpenses: expenses.filter((row: any) => row.finalStatus === "PENDING").length,
      approvedExpenses: expenses.filter((row: any) => row.finalStatus === "APPROVED").length,
      rejectedExpenses: expenses.filter((row: any) => row.finalStatus === "REJECTED").length,
      approvedExpenseAmount: approvedExpenses,
      serviceIncome,
      staffCashReceived,
      manualCashReceived: staffCashReceived,
      totalIncome,
      netIncome,
      totalFloat,
      systemAllocatedFloat,
      manualAllocatedFloat,
      allocatedFloat,
      allocatedCash,
      grossStaffFundsIssued: allocatedFloat + allocatedCash,
      combinedStaffFunds,
      attendanceSessions: filteredAttendance.length,
      presentSessions: filteredAttendance.filter((row: any) => row.mark === "PRESENT").length,
      absentSessions: filteredAttendance.filter((row: any) => row.mark === "ABSENT").length,
      pendingVerification: filteredPackets.filter((row: any) =>
        ["WAITING_ADMIN_REFERENCE", "READY_FOR_ACCOUNTANT"].includes(row.status),
      ).length,
      pendingBankCases: filteredBank.filter((row: any) => row.accountantDecision === "PENDING").length,
      unreadNotifications: notifications.filter((row: any) => !row.isRead).length,
    },
  };
}
