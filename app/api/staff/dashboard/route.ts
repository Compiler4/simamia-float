import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { evaluateMissingReturn } from "@/lib/staff/attendance";
import { calculateStaffPerformance } from "@/lib/staff/performance";
import { requireStaff } from "@/lib/staff/permissions";
import { loadStaffAssignments } from "@/lib/staff/scopes";
import { dayBounds, reportBounds, tzDateKey } from "@/lib/staff/time";

export const dynamic = "force-dynamic";

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function plain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === "object" && typeof item.toNumber === "function") {
        return item.toNumber();
      }
      return item;
    }),
  );
}

function dateKey(value: unknown): string {
  return tzDateKey(new Date(String(value)));
}

function rating(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  return "Needs Improvement";
}

function safeJson(value: unknown) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Please sign in."],
    FORBIDDEN: [403, "Staff access is required."],
    STAFF_COMPANY_REQUIRED: [403, "Your staff account is not attached to a company."],
    INVALID_DATE: [400, "The selected report date is invalid."],
  };
  if (known[message]) {
    return NextResponse.json(
      { success: false, message: known[message][1] },
      { status: known[message][0] },
    );
  }
  const code = (error as any)?.code;
  console.error("[STAFF_DASHBOARD]", error);
  return NextResponse.json(
    {
      success: false,
      message:
        code === "P2021" || code === "P2022"
          ? "The database is not synchronized. Run npx prisma db push and npx prisma generate."
          : "The staff dashboard could not load from the database.",
      error: message,
    },
    { status: 500 },
  );
}

function buildDailySeries(input: {
  start: Date;
  end: Date;
  period: string;
  floats: any[];
  collections: any[];
  deposits: any[];
  services: any[];
  userId: string;
}) {
  const rows: Array<Record<string, any>> = [];
  const period = input.period.toUpperCase();

  if (period === "YEAR") {
    for (let month = 0; month < 12; month += 1) {
      const anchor = new Date(input.start);
      anchor.setUTCMonth(month);
      const year = new Date(input.start.getTime() + 3 * 3600000).getUTCFullYear();
      const inMonth = (value: unknown) => {
        const shifted = new Date(new Date(String(value)).getTime() + 3 * 3600000);
        return shifted.getUTCFullYear() === year && shifted.getUTCMonth() === month;
      };
      rows.push({
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("en-TZ", { month: "short", timeZone: "Africa/Dar_es_Salaam" }).format(anchor),
        received: input.floats
          .filter((item) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === input.userId && inMonth(item.createdAt))
          .reduce((sum, item) => sum + n(item.amount), 0),
        issued: input.floats
          .filter((item) => item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === input.userId && inMonth(item.createdAt))
          .reduce((sum, item) => sum + n(item.amount), 0),
        collections: input.collections.filter((item) => inMonth(item.collectionDate)).reduce((sum, item) => sum + n(item.amount), 0),
        deposited: input.deposits.filter((item) => inMonth(item.depositDate)).reduce((sum, item) => sum + n(item.amount), 0),
        visits: input.services.filter((item) => inMonth(item.servedAt)).length,
      });
    }
    return rows;
  }

  const cursor = new Date(input.start);
  let guard = 0;
  while (cursor <= input.end && guard < 370) {
    const key = dateKey(cursor);
    rows.push({
      key,
      label: new Intl.DateTimeFormat("en-TZ", {
        weekday: period === "WEEK" ? "short" : undefined,
        day: period === "MONTH" ? "2-digit" : undefined,
        month: period === "MONTH" ? "short" : undefined,
        hour: period === "DAY" ? undefined : undefined,
        timeZone: "Africa/Dar_es_Salaam",
      }).format(cursor),
      received: input.floats
        .filter((item) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === input.userId && dateKey(item.createdAt) === key)
        .reduce((sum, item) => sum + n(item.amount), 0),
      issued: input.floats
        .filter((item) => item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === input.userId && dateKey(item.createdAt) === key)
        .reduce((sum, item) => sum + n(item.amount), 0),
      collections: input.collections.filter((item) => dateKey(item.collectionDate) === key).reduce((sum, item) => sum + n(item.amount), 0),
      deposited:
        input.deposits.filter((item) => dateKey(item.depositDate) === key).reduce((sum, item) => sum + n(item.amount), 0) +
        input.floats
          .filter((item) => item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === input.userId && dateKey(item.createdAt) === key)
          .reduce((sum, item) => sum + n(item.returnedAmount ?? item.amount), 0),
      visits: input.services.filter((item) => dateKey(item.servedAt) === key).length,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }

  return rows;
}

function buildTodayHourlySeries(input: {
  floats: any[];
  collections: any[];
  deposits: any[];
  userId: string;
  inToday: (value: unknown) => boolean;
}) {
  const rows = Array.from({ length: 8 }, (_, index) => ({
    key: `hour-${index}`,
    label: `${String(index * 3).padStart(2, "0")}:00`,
    received: 0,
    issued: 0,
    collections: 0,
    deposited: 0,
  }));

  const bucket = (value: unknown) => {
    const date = new Date(String(value));
    const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return Math.min(7, Math.max(0, Math.floor(shifted.getUTCHours() / 3)));
  };

  for (const item of input.floats) {
    const value = item.returnedAt || item.issuedAt || item.createdAt;
    if (!input.inToday(value)) continue;
    const row = rows[bucket(value)];

    if (item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === input.userId) {
      row.received += n(item.amount);
    }

    if (item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === input.userId) {
      row.issued += n(item.amount);
    }

    if (item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === input.userId) {
      row.deposited += n(item.returnedAmount ?? item.amount);
    }
  }

  for (const item of input.collections) {
    if (!input.inToday(item.collectionDate)) continue;
    rows[bucket(item.collectionDate)].collections += n(item.amount);
  }

  for (const item of input.deposits) {
    if (!input.inToday(item.depositDate)) continue;
    rows[bucket(item.depositDate)].deposited += n(item.amount);
  }

  return rows;
}

export async function GET(request: Request) {
  try {
    const session = await requireStaff();
    const url = new URL(request.url);
    const requestedPeriod = (url.searchParams.get("period") || "DAY").toUpperCase();
    const period = ["DAY", "WEEK", "MONTH", "YEAR"].includes(requestedPeriod)
      ? requestedPeriod
      : "DAY";
    const anchor = url.searchParams.get("date") || tzDateKey();
    const report = reportBounds(period, anchor);
    const today = dayBounds(tzDateKey());

    await evaluateMissingReturn(session.companyId, session.id).catch(() => null);

    // This is the only source of brokers/customers available to this staff officer.
    const assignments = await loadStaffAssignments(session);
    const visibleDeviceOwnerIds = [session.id, ...assignments.brokerIds];

    const [
      staff,
      company,
      accountants,
      floats,
      collections,
      deposits,
      expenses,
      attendance,
      notifications,
      services,
      devices,
      visibleDevices,
      gpsAlerts,
      currentFinancialDay,
      latestPerformanceRecords,
    ] = await Promise.all([
      (db as any).user.findFirst({
        where: {
          id: session.id,
          companyId: session.companyId,
          role: "STAFF",
          status: "ACTIVE",
        },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          profileImageUrl: true,
          assignedRegion: true,
          branch: { select: { id: true, name: true, code: true, region: true } },
        },
      }),
      (db as any).company.findFirst({
        where: { id: session.companyId },
        select: { id: true, name: true, code: true },
      }),
      (db as any).user.findMany({
        where: {
          companyId: session.companyId,
          role: "ACCOUNTANT",
          status: "ACTIVE",
        },
        // Only fields needed to select an accountant during settlement.
        select: { id: true, name: true, email: true, profileImageUrl: true },
        orderBy: { name: "asc" },
      }),
      (db as any).floatTransaction.findMany({
        where: {
          companyId: session.companyId,
          OR: [{ fromUserId: session.id }, { toUserId: session.id }],
        },
        include: {
          fromUser: {
            select: {
              id: true, name: true, username: true, email: true,
              role: true, profileImageUrl: true,
            },
          },
          toUser: {
            select: {
              id: true, name: true, username: true, email: true,
              role: true, profileImageUrl: true,
            },
          },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      (db as any).staffCollection.findMany({
        where: { companyId: session.companyId, staffId: session.id },
        include: {
          broker: {
            select: {
              id: true, name: true, username: true, email: true,
              profileImageUrl: true, assignedRegion: true,
            },
          },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ collectionDate: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
      (db as any).bankDeposit.findMany({
        where: { companyId: session.companyId, staffId: session.id },
        include: {
          accountant: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
      (db as any).expense.findMany({
        where: { companyId: session.companyId, employeeId: session.id },
        include: {
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        take: 3000,
      }),
      (db as any).attendance.findMany({
        where: { companyId: session.companyId, userId: session.id },
        orderBy: { date: "desc" },
        take: 500,
      }),
      (db as any).notification.findMany({
        where: { companyId: session.companyId, userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      (db as any).serviceActivity.findMany({
        where: { companyId: session.companyId, staffId: session.id },
        include: {
          broker: {
            select: {
              id: true, name: true, username: true, email: true,
              profileImageUrl: true, assignedRegion: true,
            },
          },
          customer: {
            select: {
              id: true, name: true, email: true, phone: true,
              region: true, address: true,
            },
          },
        },
        orderBy: { servedAt: "desc" },
        take: 5000,
      }),
      (db as any).companyGpsDevice.findMany({
        where: { companyId: session.companyId, ownerUserId: session.id },
        include: { pings: { orderBy: { capturedAt: "desc" }, take: 1000 } },
        orderBy: { lastSeenAt: "desc" },
      }),
      (db as any).companyGpsDevice.findMany({
        where: {
          companyId: session.companyId,
          ownerUserId: { in: visibleDeviceOwnerIds },
        },
        include: {
          owner: {
            select: {
              id: true, name: true, username: true, email: true,
              role: true, profileImageUrl: true, assignedRegion: true,
            },
          },
        },
        orderBy: { lastSeenAt: "desc" },
        take: 500,
      }),
      (db as any).gpsAlert.findMany({
        where: { companyId: session.companyId, userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      (db as any).financialDay.findUnique({
        where: {
          companyId_date: {
            companyId: session.companyId,
            date: new Date(`${tzDateKey()}T12:00:00+03:00`),
          },
        },
      }),
      (db as any).performanceRecord.findMany({
        where: { companyId: session.companyId, userId: session.id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 24,
      }),
    ]);

    if (!staff || !company) throw new Error("STAFF_COMPANY_REQUIRED");

    const brokers = assignments.brokers;
    const customers = assignments.customers;
    const receivedStatuses = new Set(["CONFIRMED", "APPROVED", "RETURNED", "DEPOSITED"]);
    const activeStatuses = new Set(["ISSUED", "CONFIRMED", "RETURNED", "DEPOSITED", "APPROVED"]);

    const incoming = floats
      .filter((item: any) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === session.id && receivedStatuses.has(item.status))
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const issued = floats
      .filter((item: any) => item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === session.id && activeStatuses.has(item.status))
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const brokerReturns = floats
      .filter((item: any) => item.transactionType === "BROKER_RETURN_TO_STAFF" && item.toUserId === session.id && receivedStatuses.has(item.status))
      .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0);
    const collected = collections
      .filter((item: any) => item.status !== "REJECTED")
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const returned = floats
      .filter((item: any) => item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === session.id && item.status !== "REJECTED")
      .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0);
    const banked = deposits
      .filter((item: any) => item.status !== "DUPLICATE_DEPOSIT")
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const availableBalance = Math.max(0, incoming + brokerReturns + collected - issued - returned - banked);

    const inReport = (value: unknown) => {
      const date = new Date(String(value));
      return date >= report.start && date <= report.end;
    };
    const inToday = (value: unknown) => {
      const date = new Date(String(value));
      return date >= today.start && date <= today.end;
    };

    const reportFloats = floats.filter((item: any) => inReport(item.createdAt));
    const reportCollections = collections.filter((item: any) => inReport(item.collectionDate));
    const reportDeposits = deposits.filter((item: any) => inReport(item.depositDate));
    const reportExpenses = expenses.filter((item: any) => inReport(item.expenseDate));
    const reportServices = services.filter((item: any) => inReport(item.servedAt));

    const todayFloatReceived = floats
      .filter((item: any) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === session.id && inToday(item.createdAt))
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const todayIssued = floats
      .filter((item: any) => item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === session.id && inToday(item.createdAt))
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const todayCollections = collections
      .filter((item: any) => inToday(item.collectionDate))
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);
    const todayReturned = floats
      .filter((item: any) => item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === session.id && inToday(item.createdAt))
      .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0);
    const todayBanked = deposits
      .filter((item: any) => inToday(item.depositDate))
      .reduce((sum: number, item: any) => sum + n(item.amount), 0);

    const financialHold = deposits.find((item: any) => item.holdActive) || null;
    const [currentPerformance, dailyPerformance] = await Promise.all([
      calculateStaffPerformance({
        companyId: session.companyId,
        userId: session.id,
        period: period as any,
        anchor,
      }),
      calculateStaffPerformance({
        companyId: session.companyId,
        userId: session.id,
        period: "DAY",
        anchor: tzDateKey(),
      }),
    ]);

    // Rank is calculated, but no other staff identity or score is returned.
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const [activeStaffCount, higherStoredScores] = await Promise.all([
      (db as any).user.count({
        where: { companyId: session.companyId, role: "STAFF", status: "ACTIVE" },
      }),
      (db as any).performanceRecord.count({
        where: {
          companyId: session.companyId,
          month: currentMonth,
          year: currentYear,
          userId: { not: session.id },
          score: { gt: currentPerformance.score },
        },
      }),
    ]);
    const ranking = [{
      id: staff.id,
      name: staff.name,
      username: staff.username,
      email: staff.email,
      profileImageUrl: staff.profileImageUrl,
      score: currentPerformance.score,
      rating: rating(currentPerformance.score),
      rank: higherStoredScores + 1,
      totalStaff: activeStaffCount,
    }];

    // Current assignments are available for new work. Historical brokers linked to this
    // staff officer's own transactions remain visible in their personal reports only.
    const relatedBrokerMap = new Map<string, any>();
    for (const broker of brokers) relatedBrokerMap.set(String(broker.id), broker);
    for (const row of reportFloats) {
      if (row.transactionType === "STAFF_TO_BROKER" && row.fromUserId === session.id && row.toUser?.role === "BROKER") {
        relatedBrokerMap.set(String(row.toUser.id), row.toUser);
      }
    }
    for (const row of reportCollections) {
      if (row.broker) relatedBrokerMap.set(String(row.broker.id), row.broker);
    }
    for (const row of reportServices) {
      if (row.broker) relatedBrokerMap.set(String(row.broker.id), row.broker);
    }

    const brokerStats = Array.from(relatedBrokerMap.values())
      .map((broker: any) => {
        const issueRows = reportFloats.filter((item: any) => item.transactionType === "STAFF_TO_BROKER" && item.toUserId === broker.id);
        const brokerCollections = reportCollections.filter((item: any) => item.brokerId === broker.id);
        const brokerServices = reportServices.filter((item: any) => item.brokerId === broker.id);
        const device = visibleDevices.find((item: any) => item.ownerUserId === broker.id);
        return {
          broker,
          currentlyAssigned: assignments.brokerIds.includes(String(broker.id)),
          visits: new Set([
            ...issueRows.map((item: any) => dateKey(item.createdAt)),
            ...brokerCollections.map((item: any) => dateKey(item.collectionDate)),
          ]).size,
          timesServed: issueRows.length,
          totalFloat: issueRows.reduce((sum: number, item: any) => sum + n(item.amount), 0),
          totalCollections: brokerCollections.reduce((sum: number, item: any) => sum + n(item.amount), 0),
          customerTransactions: brokerServices.length,
          location: device
            ? {
                latitude: device.lastLatitude,
                longitude: device.lastLongitude,
                lastSeenAt: device.lastSeenAt,
                speedKph: device.speedKph,
              }
            : null,
        };
      })
      .filter((item: any) => item.timesServed || item.totalCollections || item.customerTransactions || item.location || item.currentlyAssigned);

    // Customer statistics are built only from service rows performed by this staff user.
    // This preserves their own history even after a customer is reassigned.
    const customerMap = new Map<string, any>();
    for (const service of reportServices) {
      if (!service.customer) continue;
      const current = customerMap.get(service.customer.id) || {
        customer: service.customer,
        visits: 0,
        amount: 0,
        latestLocation: null,
        lastServedAt: null,
      };
      current.visits += 1;
      current.amount += n(service.amount);
      current.lastServedAt = service.servedAt;
      if (service.latitude != null && service.longitude != null) {
        current.latestLocation = {
          latitude: service.latitude,
          longitude: service.longitude,
          name: service.locationName,
        };
      }
      customerMap.set(service.customer.id, current);
    }
    const customerStats = Array.from(customerMap.values()).sort((a, b) => b.visits - a.visits);

    const assignedTransactions = [
      ...floats.map((item: any) => ({
        id: `float-${item.id}`,
        sourceId: item.id,
        kind: "FLOAT",
        type: item.transactionType,
        reference: item.referenceNo || `FLT-${item.id.slice(-7).toUpperCase()}`,
        description: item.purpose || item.transactionType.replaceAll("_", " "),
        amount: n(item.returnedAmount ?? item.amount),
        status: item.status,
        date: item.returnedAt || item.issuedAt || item.createdAt,
        person: item.fromUserId === session.id ? item.toUser : item.fromUser,
        receiptUrl: item.receiptUrl,
        locked: ["APPROVED", "DEPOSITED", "REJECTED"].includes(item.status),
      })),
      ...collections.map((item: any) => ({
        id: `collection-${item.id}`,
        sourceId: item.id,
        kind: "COLLECTION",
        type: "BROKER_COLLECTION",
        reference: item.referenceNo,
        description: item.description || "Broker collection",
        amount: n(item.amount),
        status: item.status,
        date: item.collectionDate,
        person: item.broker,
        receiptUrl: item.receiptUrl,
        locked: ["VERIFIED", "DEPOSITED", "REJECTED"].includes(item.status),
      })),
      ...deposits.map((item: any) => ({
        id: `deposit-${item.id}`,
        sourceId: item.id,
        kind: "BANK_DEPOSIT",
        type: "BANK_DEPOSIT",
        reference: item.referenceNo || `BNK-${item.id.slice(-7).toUpperCase()}`,
        description: item.bankAccount || "Bank deposit",
        amount: n(item.amount),
        status: item.status,
        date: item.depositDate,
        person: item.accountant,
        receiptUrl: item.bankReceiptUrl || item.depositSlipUrl,
        locked: item.status === "VERIFIED",
      })),
      ...expenses.map((item: any) => ({
        id: `expense-${item.id}`,
        sourceId: item.id,
        kind: "EXPENSE",
        type: item.category,
        reference: `EXP-${item.id.slice(-7).toUpperCase()}`,
        description: item.description || item.category,
        amount: n(item.amount),
        status: item.status,
        date: item.expenseDate,
        person: item.reviewedBy,
        receiptUrl: item.receiptUrl,
        locked: ["APPROVED", "REJECTED"].includes(item.status),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dailyTransactions = assignedTransactions.filter((item: any) =>
      inToday(item.date),
    );
    const dailyDeposits = deposits.filter((item: any) =>
      inToday(item.depositDate),
    );
    const dailyFlowSeries = buildTodayHourlySeries({
      floats,
      collections,
      deposits,
      userId: session.id,
      inToday,
    });
    const todayAvailableBalance = Math.max(
      0,
      todayFloatReceived +
        todayCollections -
        todayIssued -
        todayReturned -
        todayBanked,
    );
    const todayBrokerIds = new Set<string>();
    const todayCustomerIds = new Set<string>();

    for (const item of floats) {
      if (
        item.transactionType === "STAFF_TO_BROKER" &&
        item.fromUserId === session.id &&
        inToday(item.createdAt) &&
        item.toUserId
      ) {
        todayBrokerIds.add(String(item.toUserId));
      }
    }

    for (const item of collections) {
      if (inToday(item.collectionDate) && item.brokerId) {
        todayBrokerIds.add(String(item.brokerId));
      }
    }

    for (const item of services) {
      if (!inToday(item.servedAt)) continue;
      if (item.brokerId) todayBrokerIds.add(String(item.brokerId));
      if (item.customerId) todayCustomerIds.add(String(item.customerId));
    }

    const series = buildDailySeries({
      start: report.start,
      end: report.end,
      period,
      floats,
      collections,
      deposits,
      services,
      userId: session.id,
    });

    const reportSummary = {
      label: report.label,
      period,
      totalFloatReceived: reportFloats
        .filter((item: any) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === session.id)
        .reduce((sum: number, item: any) => sum + n(item.amount), 0),
      totalFloatIssued: reportFloats
        .filter((item: any) => item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === session.id)
        .reduce((sum: number, item: any) => sum + n(item.amount), 0),
      totalCollections: reportCollections.reduce((sum: number, item: any) => sum + n(item.amount), 0),
      totalReturned: reportFloats
        .filter((item: any) => item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === session.id)
        .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0),
      totalBanked: reportDeposits.reduce((sum: number, item: any) => sum + n(item.amount), 0),
      totalExpenses: reportExpenses.reduce((sum: number, item: any) => sum + n(item.amount), 0),
      brokersServed: brokerStats.filter((item: any) => item.timesServed > 0).length,
      customersServed: customerStats.length,
      bankMismatches: reportDeposits.filter((item: any) => !["VERIFIED", "PENDING"].includes(item.status)).length,
      verifiedDeposits: reportDeposits.filter((item: any) => item.status === "VERIFIED").length,
      dailyReturn: reportFloats
        .filter((item: any) => item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === session.id)
        .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0),
    };

    return NextResponse.json(
      plain({
        success: true,
        staff,
        company,
        brokers,
        accountants,
        customers,
        assignments: {
          brokerCount: assignments.brokerIds.length,
          customerCount: assignments.customerIds.length,
        },
        floats,
        collections,
        deposits: deposits.map((item: any) => ({
          ...item,
          comparison: safeJson(item.comparisonJson),
        })),
        expenses,
        attendance,
        notifications,
        services,
        devices,
        liveLocations: visibleDevices.map((item: any) => ({
          id: item.id,
          owner: item.owner,
          name: item.name,
          status: item.status,
          latitude: item.lastLatitude,
          longitude: item.lastLongitude,
          speedKph: item.speedKph,
          accuracy: item.gpsAccuracy,
          batteryLevel: item.batteryLevel,
          lastSeenAt: item.lastSeenAt,
        })),
        gpsAlerts,
        currentFinancialDay,
        latestPerformanceRecords,
        currentPerformance,
        ranking,
        brokerStats,
        customerStats,
        assignedTransactions,
        dailyTransactions,
        dailyDeposits,
        dailyFlowSeries,
        dailyPerformance,
        reportSummary,
        reportRows: assignedTransactions.filter((item: any) => inReport(item.date)),
        flowSeries: series,
        financialHold,
        stats: {
          availableBalance: todayAvailableBalance,
          allTimeAvailableBalance: availableBalance,
          todayFloatReceived,
          todayIssued,
          todayCollections,
          todayReturned,
          todayBanked,
          pendingFloatReceipts: floats.filter((item: any) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === session.id && item.status === "ISSUED").length,
          pendingApprovals:
            collections.filter((item: any) => item.status === "PENDING" && inToday(item.collectionDate)).length +
            deposits.filter((item: any) => item.status === "PENDING" && inToday(item.depositDate)).length +
            expenses.filter((item: any) => item.status === "PENDING" && inToday(item.expenseDate)).length,
          unreadNotifications: notifications.filter((item: any) => !item.isRead).length,
          openGpsAlerts: gpsAlerts.filter((item: any) => item.status === "OPEN").length,
          performanceScore: dailyPerformance.score,
          attendanceRate: dailyPerformance.attendanceRate,
          depositAccuracy: dailyPerformance.depositAccuracyRate,
          gpsCompliance: dailyPerformance.gpsComplianceRate,
          outstandingBalance: dailyPerformance.outstandingBalance,
          brokersServed: todayBrokerIds.size,
          customersServed: todayCustomerIds.size,
          assignedBrokers: assignments.brokerIds.length,
          assignedCustomers: assignments.customerIds.length,
        },
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
