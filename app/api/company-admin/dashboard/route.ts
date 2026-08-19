import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireCompanyAdmin,
  routeError,
  text,
  toNumber,
} from "@/lib/company-admin-server";

export const dynamic = "force-dynamic";

const defaultSettings = {
  sms: true,
  email: true,
  inApp: true,
  gpsAlerts: true,
  dayClosingLock: true,
  attendanceApproval: true,
  bankMismatchHold: true,
  lowCashAlert: true,
  accent: "TEAL",
  currency: "TZS",
  timezone: "Africa/Dar_es_Salaam",
  proofGraceMinutes: 30,
  visitRadiusMeters: 200,
  minimumPerformanceScore: 60,
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDays(count: number): Date[] {
  const result: Date[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    result.push(date);
  }
  return result;
}

function number(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function percentage(numerator: number, denominator: number, empty = 100): number {
  if (denominator <= 0) return empty;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function darEsSalaamPeriodStarts(now = new Date()) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + offsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const weekday = shifted.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  const fromDarMidnight = (value: number) => new Date(value - offsetMs);

  return {
    day: fromDarMidnight(Date.UTC(year, month, day)),
    week: fromDarMidnight(Date.UTC(year, month, day - daysFromMonday)),
    month: fromDarMidnight(Date.UTC(year, month, 1)),
    year: fromDarMidnight(Date.UTC(year, 0, 1)),
  };
}

export async function GET() {
  try {
    const sessionUser = await requireCompanyAdmin();
    const companyId = sessionUser.companyId as string;
    const db = prisma as any;

    const [
      company,
      usersRaw,
      branches,
      expensesRaw,
      bankRaw,
      attendanceRaw,
      notificationsRaw,
      gpsDevicesRaw,
      gpsPingsRaw,
      settingsRaw,
      activities,
      customers,
      servicesRaw,
      brokersRaw,
      documentsRaw,
      approvalsRaw,
      visitsRaw,
      floatTransactionsRaw,
      collectionsRaw,
      networkBalancesRaw,
      importedStatementsRaw,
      importedTransactionsRaw,
      reportSettingsRaw,
    ] = await Promise.all([
      db.company.findUnique({ where: { id: companyId } }),
      db.user.findMany({
        where: {
          companyId,
          AND: [
            { NOT: { role: { in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"] } } },
            { NOT: { status: "REMOVED" } },
          ],
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      db.branch.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
      db.companyExpense.findMany({
        where: { companyId },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        take: 3000,
      }),
      db.companyBankVerification.findMany({
        where: { companyId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }],
        take: 3000,
      }),
      db.companyAttendance.findMany({
        where: { companyId },
        orderBy: [{ attendanceDate: "desc" }, { userName: "asc" }],
        take: 30000,
      }),
      db.companyNotification.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.companyGpsDevice.findMany({
        where: { companyId },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      }),
      db.companyGpsPing.findMany({
        where: { companyId },
        orderBy: { capturedAt: "desc" },
        take: 5000,
      }),
      db.companyAdminSetting.findUnique({ where: { companyId } }),
      db.companyAuditEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
      db.serviceActivity.findMany({
        where: { companyId },
        include: {
          staff: true,
          broker: true,
          brokerCustomer: { include: { agentAccounts: true } },
          customer: true,
        },
        orderBy: [{ servedAt: "desc" }, { createdAt: "desc" }],
        take: 30000,
      }),
      db.brokerCustomer.findMany({
        where: { companyId },
        include: { agentAccounts: true },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      }),
      db.portalDocument.findMany({
        where: { companyId },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true, role: true, profileImageUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.approvalDecision.findMany({
        where: { companyId },
        orderBy: { decidedAt: "desc" },
        take: 5000,
      }),
      db.brokerServiceVisit.findMany({
        where: { companyId },
        include: {
          staff: true,
          brokerCustomer: { include: { agentAccounts: true } },
          device: true,
        },
        orderBy: { startedAt: "desc" },
        take: 10000,
      }),
      db.floatTransaction.findMany({
        where: { companyId },
        include: { fromUser: true, toUser: true, brokerCustomer: true },
        orderBy: { createdAt: "desc" },
        take: 30000,
      }),
      db.staffCollection.findMany({
        where: { companyId },
        include: { staff: true, broker: true, brokerCustomer: true },
        orderBy: { collectionDate: "desc" },
        take: 30000,
      }),
      db.networkBalance.findMany({
        where: { companyId },
        orderBy: [{ network: "asc" }, { simCardNumber: "asc" }],
      }),
      db.importedBankStatement.findMany({
        where: { companyId },
        orderBy: [{ periodEnd: "desc" }, { importedAt: "desc" }],
        take: 50,
      }),
      db.importedBankTransaction.findMany({
        where: { companyId },
        orderBy: { postingDate: "desc" },
        take: 10000,
      }),
      db.companySetting.findMany({
        where: {
          companyId,
          key: {
            in: [
              "company.logoUrl",
              "company.registrationNumber",
              "company.tin",
              "company.website",
            ],
          },
        },
      }),
    ]);

    const branchMap = new Map(
      branches.map((branch: any) => [text(branch.id), text(branch.name)]),
    );

    const users = usersRaw.map((user: any) => ({
      ...user,
      branchName: branchMap.get(text(user.branchId)) || "No branch",
      passwordHash: undefined,
      password: undefined,
    }));

    const documentsByBank = new Map<string, any[]>();
    const documentsByVisit = new Map<string, any[]>();
    for (const document of documentsRaw) {
      if (document.bankVerificationId) {
        const rows = documentsByBank.get(document.bankVerificationId) || [];
        rows.push(document);
        documentsByBank.set(document.bankVerificationId, rows);
      }
      if (document.serviceVisitId) {
        const rows = documentsByVisit.get(document.serviceVisitId) || [];
        rows.push(document);
        documentsByVisit.set(document.serviceVisitId, rows);
      }
    }

    const approvalsByItem = new Map<string, any[]>();
    for (const decision of approvalsRaw) {
      const key = `${decision.itemType}:${decision.itemId}`;
      const rows = approvalsByItem.get(key) || [];
      rows.push(decision);
      approvalsByItem.set(key, rows);
    }

    const expenses = expensesRaw.map((item: any) => ({
      ...item,
      amount: toNumber(item.amount),
      decisions: approvalsByItem.get(`EXPENSE:${item.id}`) || [],
      approvalDecisions: approvalsByItem.get(`EXPENSE:${item.id}`) || [],
      workflowStatus: (() => {
        const rows = approvalsByItem.get(`EXPENSE:${item.id}`) || [];
        const admin = rows.find((row: any) => row.reviewerRole === "COMPANY_ADMIN");
        const accountant = rows.find((row: any) => row.reviewerRole === "ACCOUNTANT");
        if (admin && accountant && admin.decision !== accountant.decision) return "CONFLICT";
        if (admin?.decision === "APPROVED" && accountant?.decision === "APPROVED") return "APPROVED";
        if (rows.some((row: any) => row.decision === "REJECTED")) return "REJECTED";
        if (rows.length) return "PARTIAL";
        return "PENDING";
      })(),
    }));

    const importedStatementByAccount = new Map<string, any>();
    for (const statement of importedStatementsRaw) {
      const key = text(statement.accountNumber).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (key && !importedStatementByAccount.has(key)) importedStatementByAccount.set(key, statement);
    }

    const bankVerifications = bankRaw.map((item: any) => {
      const statement = importedStatementByAccount.get(
        text(item.bankAccount).replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      );
      return ({
      ...item,
      bankName: text(statement?.bankName) || "UNSPECIFIED BANK",
      accountName: text(statement?.accountName) || "",
      amount: toNumber(item.amount),
      messages: Array.isArray(item.messages) ? item.messages : [],
      documents: documentsByBank.get(item.id) || [],
      decisions: approvalsByItem.get(`BANK_VERIFICATION:${item.id}`) || [],
      approvalDecisions: approvalsByItem.get(`BANK_VERIFICATION:${item.id}`) || [],
      workflowStatus: (() => {
        const rows = approvalsByItem.get(`BANK_VERIFICATION:${item.id}`) || [];
        const admin = rows.find((row: any) => row.reviewerRole === "COMPANY_ADMIN");
        const accountant = rows.find((row: any) => row.reviewerRole === "ACCOUNTANT");
        if (admin && accountant && admin.decision !== accountant.decision) return "CONFLICT";
        if (admin?.decision === "APPROVED" && accountant?.decision === "APPROVED") return "APPROVED";
        if (rows.some((row: any) => row.decision === "REJECTED")) return "REJECTED";
        if (rows.length) return "PARTIAL";
        return "PENDING";
      })(),
      missingProofFields: (() => {
        try {
          return item.proofMissingFields ? JSON.parse(item.proofMissingFields) : [];
        } catch {
          return [];
        }
      })(),
    });
    });

    const gpsDevices = gpsDevicesRaw.map((item: any) => ({
      ...item,
      lastLatitude: item.lastLatitude == null ? null : number(item.lastLatitude),
      lastLongitude: item.lastLongitude == null ? null : number(item.lastLongitude),
      gpsAccuracy: item.gpsAccuracy == null ? null : number(item.gpsAccuracy),
      speedKph: item.speedKph == null ? null : number(item.speedKph),
    }));

    const gpsPings = gpsPingsRaw.map((item: any) => ({
      ...item,
      latitude: number(item.latitude),
      longitude: number(item.longitude),
      accuracy: item.accuracy == null ? null : number(item.accuracy),
      speedKph: item.speedKph == null ? null : number(item.speedKph),
    }));

    const serviceActivities = servicesRaw.map((item: any) => ({
      ...item,
      amount: toNumber(item.amount),
    }));

    const brokers = brokersRaw.map((item: any) => ({
      ...item,
      latitude: item.latitude == null ? null : number(item.latitude),
      longitude: item.longitude == null ? null : number(item.longitude),
      agentAccounts: Array.isArray(item.agentAccounts) ? item.agentAccounts : [],
    }));

    const serviceVisits = visitsRaw.map((item: any) => ({
      ...item,
      floatAmount: toNumber(item.floatAmount),
      cashAmount: toNumber(item.cashAmount),
      companyIncome: toNumber(item.companyIncome),
      documents: documentsByVisit.get(item.id) || [],
    }));

    const floatTransactions = floatTransactionsRaw.map((item: any) => ({
      ...item,
      amount: toNumber(item.amount),
      returnedAmount: toNumber(item.returnedAmount),
    }));

    const staffCollections = collectionsRaw.map((item: any) => ({
      ...item,
      amount: toNumber(item.amount),
    }));

    const networkBalances = networkBalancesRaw.map((item: any) => ({
      ...item,
      floatBalance: toNumber(item.floatBalance),
      cashBalance: toNumber(item.cashBalance),
    }));

    const importedBankStatements = importedStatementsRaw.map((item: any) => ({
      ...item,
      availableBalance: toNumber(item.availableBalance),
      totalCredit: toNumber(item.totalCredit),
      totalDebit: toNumber(item.totalDebit),
      bookBalance: toNumber(item.bookBalance),
      clearedBalance: toNumber(item.clearedBalance),
    }));

    const importedBankTransactions = importedTransactionsRaw.map((item: any) => ({
      ...item,
      debit: toNumber(item.debit),
      credit: toNumber(item.credit),
      bookBalance: toNumber(item.bookBalance),
    }));

    const attendance = attendanceRaw.map((item: any) => ({ ...item }));
    const performanceUsers = users.filter((item: any) =>
      ["STAFF", "ACCOUNTANT"].includes(item.role),
    );
    const performanceBase = performanceUsers.map((employee: any) => {
      const attendanceRows = attendance.filter((row: any) => row.userId === employee.id);
      const present = attendanceRows.filter((row: any) => row.mark === "PRESENT").length;
      const late = attendanceRows.filter((row: any) => row.mark === "LATE").length;
      const absent = attendanceRows.filter((row: any) => row.mark === "ABSENT").length;
      const leave = attendanceRows.filter((row: any) => row.mark === "LEAVE").length;
      const holiday = attendanceRows.filter((row: any) => row.mark === "HOLIDAY").length;
      const working = present + late + absent;
      const attendanceRate = percentage(present + late, working, 0);

      const issued = floatTransactions
        .filter((row: any) => row.toUserId === employee.id)
        .reduce((sum: number, row: any) => sum + number(row.amount), 0);
      const returnedFromField = floatTransactions
        .filter((row: any) => row.toUserId === employee.id)
        .reduce((sum: number, row: any) => sum + number(row.returnedAmount), 0);
      const returnedTransactions = floatTransactions
        .filter((row: any) => row.fromUserId === employee.id && row.transactionType === "STAFF_RETURN_TO_ACCOUNTANT")
        .reduce((sum: number, row: any) => sum + number(row.amount), 0);
      const returned = Math.max(returnedFromField, returnedTransactions);
      const outstanding = Math.max(0, issued - returned);
      const returnRate = percentage(returned, issued, 100);

      const visits = serviceVisits.filter((row: any) => row.staffId === employee.id);
      const completedVisits = visits.filter((row: any) => row.status === "COMPLETED").length;
      const lateProof = visits.filter((row: any) => row.status === "LATE_PROOF").length;
      const proofComplianceRate = percentage(completedVisits, visits.length, 100);
      const companyIncome = visits.reduce(
        (sum: number, row: any) => sum + number(row.companyIncome),
        0,
      );
      const serviceValue = serviceActivities
        .filter((row: any) => row.staffId === employee.id)
        .reduce((sum: number, row: any) => sum + number(row.amount), 0);
      const collectionValue = staffCollections
        .filter((row: any) => row.staffId === employee.id)
        .reduce((sum: number, row: any) => sum + number(row.amount), 0);

      return {
        userId: employee.id,
        userName: employee.name,
        userRole: employee.role,
        profileImageUrl: employee.profileImageUrl,
        present,
        late,
        absent,
        leave,
        holiday,
        attendanceRate,
        totalFloatIssued: issued,
        totalFloatReturned: returned,
        outstandingBalance: outstanding,
        returnRate,
        visits: visits.length,
        completedVisits,
        lateProof,
        proofComplianceRate,
        companyIncome,
        serviceValue,
        collectionValue,
      };
    });

    const maximumIncome = Math.max(1, ...performanceBase.map((row: any) => row.companyIncome));
    const settings = settingsRaw || defaultSettings;
    const reportSettings = new Map(
      reportSettingsRaw.map((item: any) => [text(item.key), text(item.value)]),
    );
    const reportBrand = {
      logoUrl: reportSettings.get("company.logoUrl") || "",
      registrationNumber:
        reportSettings.get("company.registrationNumber") || "",
      tin: reportSettings.get("company.tin") || "",
      website: reportSettings.get("company.website") || "",
    };
    const performanceRows = performanceBase
      .map((row: any) => {
        const incomeScore = percentage(row.companyIncome, maximumIncome, 0);
        const score = Math.round(
          row.attendanceRate * 0.25 +
            row.returnRate * 0.3 +
            row.proofComplianceRate * 0.25 +
            incomeScore * 0.2,
        );
        return {
          ...row,
          incomeScore: round(incomeScore),
          score,
          rating:
            score >= 90
              ? "EXCELLENT"
              : score >= 75
                ? "GOOD"
                : score >= Number(settings.minimumPerformanceScore || 60)
                  ? "FAIR"
                  : "NEEDS_ATTENTION",
          needsAlert: score < Number(settings.minimumPerformanceScore || 60),
        };
      })
      .sort((a: any, b: any) => b.score - a.score);

    const totalExpenses = expenses.reduce(
      (sum: number, item: any) => sum + number(item.amount),
      0,
    );
    const approvedExpenses = expenses
      .filter((item: any) => item.status === "APPROVED")
      .reduce((sum: number, item: any) => sum + number(item.amount), 0);
    const totalDeposits = bankVerifications
      .filter((item: any) => item.status === "VERIFIED")
      .reduce((sum: number, item: any) => sum + number(item.amount), 0);
    const totalFloatIssued = floatTransactions.reduce(
      (sum: number, item: any) => sum + number(item.amount),
      0,
    );
    const totalFloatReturned = floatTransactions.reduce(
      (sum: number, item: any) => sum + number(item.returnedAmount),
      0,
    );
    const outstandingFloat = Math.max(0, totalFloatIssued - totalFloatReturned);
    const totalCompanyIncome = serviceVisits.reduce(
      (sum: number, item: any) => sum + number(item.companyIncome),
      0,
    );
    const periodStarts = darEsSalaamPeriodStarts();
    const incomeSince = (start: Date) =>
      serviceVisits
        .filter((item: any) => {
          const value = item.serviceProvidedAt || item.startedAt || item.createdAt;
          return value && new Date(value) >= start;
        })
        .reduce((sum: number, item: any) => sum + number(item.companyIncome), 0);
    const incomeToday = incomeSince(periodStarts.day);
    const incomeThisWeek = incomeSince(periodStarts.week);
    const incomeThisMonth = incomeSince(periodStarts.month);
    const incomeThisYear = incomeSince(periodStarts.year);

    const dates = lastDays(14);
    const attendanceIndex = new Map(
      attendance.map((item: any) => [
        `${text(item.userId)}:${isoDay(new Date(item.attendanceDate))}`,
        item,
      ]),
    );
    const attendanceSummary = performanceUsers.map((employee: any) => {
      const records = dates
        .map((date) => attendanceIndex.get(`${employee.id}:${isoDay(date)}`))
        .filter(Boolean) as any[];
      const attended = records.filter((record) =>
        ["PRESENT", "LATE"].includes(record.mark),
      ).length;
      const score = Math.round(percentage(attended, dates.length, 0));
      return {
        userId: employee.id,
        userName: employee.name,
        userRole: employee.role,
        profileImageUrl: employee.profileImageUrl,
        present: records.filter((row) => row.mark === "PRESENT").length,
        late: records.filter((row) => row.mark === "LATE").length,
        absent: records.filter((row) => row.mark === "ABSENT").length,
        leave: records.filter((row) => row.mark === "LEAVE").length,
        score,
        rating: score >= 90 ? "EXCELLENT" : score >= 75 ? "GOOD" : score >= 60 ? "FAIR" : "NEEDS_ATTENTION",
      };
    });

    const financialDays = lastDays(7).map((date) => {
      const key = isoDay(date);
      const cashIn = bankVerifications
        .filter(
          (item: any) =>
            item.status === "VERIFIED" &&
            isoDay(new Date(item.depositDate)) === key,
        )
        .reduce((sum: number, item: any) => sum + number(item.amount), 0);
      const cashOut = expenses
        .filter(
          (item: any) =>
            item.status === "APPROVED" &&
            isoDay(new Date(item.expenseDate)) === key,
        )
        .reduce((sum: number, item: any) => sum + number(item.amount), 0);
      const income = serviceVisits
        .filter(
          (item: any) =>
            item.serviceProvidedAt &&
            isoDay(new Date(item.serviceProvidedAt)) === key,
        )
        .reduce((sum: number, item: any) => sum + number(item.companyIncome), 0);
      return {
        id: key,
        date,
        openingBalance: 0,
        cashIn: cashIn + income,
        cashOut,
        closingBalance: cashIn + income - cashOut,
        status: "OPEN",
      };
    });

    const targetedNotifications = notificationsRaw.filter(
      (item: any) =>
        (!item.targetUserId && !item.targetRole) ||
        item.targetUserId === sessionUser.id ||
        item.targetRole === sessionUser.role,
    );

    return NextResponse.json({
      success: true,
      company: company || {
        id: companyId,
        name: sessionUser.companyName || "Company Portal",
      },
      users,
      branches,
      expenses,
      bankVerifications,
      attendance,
      attendanceSummary,
      performanceRows,
      notifications: targetedNotifications,
      allNotifications: notificationsRaw,
      gpsDevices,
      gpsPings,
      settings,
      reportBrand,
      activities,
      financialDays,
      customers,
      serviceActivities,
      brokers,
      documents: documentsRaw,
      approvalDecisions: approvalsRaw,
      serviceVisits,
      floatTransactions,
      staffCollections,
      networkBalances,
      importedBankStatements,
      importedBankTransactions,
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter((item: any) => item.status === "ACTIVE").length,
        totalBrokers: brokers.length,
        totalExpenses,
        approvedExpenses,
        pendingExpenses: expenses.filter((item: any) => item.status === "PENDING").length,
        rejectedExpenses: expenses.filter((item: any) => item.status === "REJECTED").length,
        totalDeposits,
        pendingBankVerifications: bankVerifications.filter((item: any) => item.status === "PENDING").length,
        bankMismatches: bankVerifications.filter((item: any) =>
          ["AMOUNT_MISMATCH", "MISSING_RECEIPT", "MISSING_BANK_RECORD", "REJECTED"].includes(item.status),
        ).length,
        insufficientProofs: bankVerifications.filter((item: any) => item.proofInspectionStatus === "INSUFFICIENT").length,
        netCash: totalDeposits + totalCompanyIncome - approvedExpenses,
        totalCompanyIncome,
        incomeToday,
        incomeThisWeek,
        incomeThisMonth,
        incomeThisYear,
        totalFloatIssued,
        totalFloatReturned,
        outstandingFloat,
        activeGpsDevices: gpsDevices.filter((item: any) => item.status === "ACTIVE").length,
        offlineGpsDevices: gpsDevices.filter((item: any) =>
          !item.lastSeenAt || Date.now() - new Date(item.lastSeenAt).getTime() > 10 * 60_000,
        ).length,
        unreadNotifications: targetedNotifications.filter((item: any) => !item.isRead).length,
        overdueProofs: serviceVisits.filter((item: any) => item.status === "LATE_PROOF").length,
        lowPerformers: performanceRows.filter((item: any) => item.needsAlert).length,
        lowPerformingStaff: performanceRows.filter((item: any) => item.needsAlert).length,
        totalServices: serviceActivities.length,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
