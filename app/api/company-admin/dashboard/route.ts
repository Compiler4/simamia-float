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
};

async function safeQuery<T>(label: string, task: () => Promise<T>, fallback: T) {
  try {
    return await task();
  } catch (error) {
    console.warn(`Dashboard query failed: ${label}`, error);
    return fallback;
  }
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastDays(count: number) {
  const result: Date[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    result.push(date);
  }
  return result;
}

export async function GET() {
  try {
    const sessionUser = await requireCompanyAdmin();
    const companyId = sessionUser.companyId as string;
    const db = prisma as any;

    const [
      companyRaw,
      usersRaw,
      branchesRaw,
      expensesRaw,
      bankRaw,
      attendanceRaw,
      notificationsRaw,
      gpsDevicesRaw,
      gpsPingsRaw,
      settingsRaw,
      auditRaw,
      customersRaw,
      serviceActivitiesRaw,
    ] = await Promise.all([
      safeQuery(
        "company",
        () => db.company.findUnique({ where: { id: companyId } }),
        null,
      ),
      safeQuery(
        "users",
        () =>
          db.user.findMany({
            where: {
              companyId,
              NOT: {
                role: {
                  in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"],
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
        [],
      ),
      safeQuery(
        "branches",
        () =>
          db.branch.findMany({
            where: { companyId },
            orderBy: { name: "asc" },
          }),
        [],
      ),
      safeQuery(
        "expenses",
        () =>
          db.companyExpense.findMany({
            where: { companyId },
            orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
            take: 500,
          }),
        [],
      ),
      safeQuery(
        "bankVerifications",
        () =>
          db.companyBankVerification.findMany({
            where: { companyId },
            include: {
              messages: {
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }],
            take: 500,
          }),
        [],
      ),
      safeQuery(
        "attendance",
        () =>
          db.companyAttendance.findMany({
            where: { companyId },
            orderBy: [{ attendanceDate: "desc" }, { userName: "asc" }],
            take: 20000,
          }),
        [],
      ),
      safeQuery(
        "notifications",
        () =>
          db.companyNotification.findMany({
            where: {
              companyId,
              OR: [
                { targetUserId: sessionUser.id },
                { targetRole: "COMPANY_ADMIN" },
                { targetUserId: null, targetRole: null },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        [],
      ),
      safeQuery(
        "gpsDevices",
        () =>
          db.companyGpsDevice.findMany({
            where: { companyId },
            orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          }),
        [],
      ),
      safeQuery(
        "gpsPings",
        () =>
          db.companyGpsPing.findMany({
            where: { companyId },
            orderBy: { capturedAt: "desc" },
            take: 500,
          }),
        [],
      ),
      safeQuery(
        "settings",
        () =>
          db.companyAdminSetting.findUnique({
            where: { companyId },
          }),
        null,
      ),
      safeQuery(
        "audit",
        () =>
          db.companyAuditEvent.findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        [],
      ),
      safeQuery(
        "customers",
        () =>
          db.customer.findMany({
            where: { companyId },
            orderBy: { name: "asc" },
            take: 10000,
          }),
        [],
      ),
      safeQuery(
        "serviceActivities",
        () =>
          db.serviceActivity.findMany({
            where: { companyId },
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                  region: true,
                  address: true,
                  status: true,
                },
              },
              staff: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  email: true,
                  phone: true,
                  role: true,
                  branchId: true,
                  status: true,
                },
              },
              broker: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
            orderBy: [{ servedAt: "desc" }, { createdAt: "desc" }],
            take: 20000,
          }),
        [],
      ),
    ]);

    const branches = branchesRaw.map((branch: any) => ({
      id: text(branch.id),
      name: text(branch.name) || "Unnamed branch",
      code: text(branch.code),
      region: text(branch.region),
      address: text(branch.address),
      status: text(branch.status) || "ACTIVE",
    }));

    const branchMap = new Map(
      branches.map((branch: any) => [branch.id, branch.name]),
    );

    const users = usersRaw.map((item: any) => ({
      id: text(item.id),
      name: text(item.name) || "Unnamed user",
      username: text(item.username),
      email: text(item.email),
      phone: text(item.phone),
      role: text(item.role),
      status: text(item.status) || "ACTIVE",
      branchId: text(item.branchId),
      branchName:
        text(item.branchName) ||
        branchMap.get(text(item.branchId)) ||
        "No branch",
      createdAt: item.createdAt,
    }));

    const expenses = expensesRaw.map((item: any) => ({
      ...item,
      amount: toNumber(item.amount),
    }));

    const bankVerifications = bankRaw.map((item: any) => ({
      ...item,
      amount: toNumber(item.amount),
      messages: Array.isArray(item.messages) ? item.messages : [],
    }));

    const attendance = attendanceRaw.map((item: any) => ({
      ...item,
      attendanceDate: item.attendanceDate,
    }));

    const notifications = notificationsRaw.map((item: any) => ({
      ...item,
      isRead: Boolean(item.isRead),
    }));

    const gpsDevices = gpsDevicesRaw.map((item: any) => ({
      ...item,
      lastLatitude:
        item.lastLatitude === null ? null : toNumber(item.lastLatitude),
      lastLongitude:
        item.lastLongitude === null ? null : toNumber(item.lastLongitude),
      gpsAccuracy:
        item.gpsAccuracy === null ? null : toNumber(item.gpsAccuracy),
      speedKph: item.speedKph === null ? null : toNumber(item.speedKph),
      batteryLevel:
        item.batteryLevel === null ? null : Number(item.batteryLevel),
    }));

    const gpsPings = gpsPingsRaw.map((item: any) => ({
      ...item,
      latitude: toNumber(item.latitude),
      longitude: toNumber(item.longitude),
      accuracy: item.accuracy === null ? null : toNumber(item.accuracy),
      speedKph: item.speedKph === null ? null : toNumber(item.speedKph),
    }));


const customers = customersRaw.map((item: any) => ({
  id: text(item.id),
  name: text(item.name) || "Unnamed customer",
  phone: text(item.phone),
  email: text(item.email),
  region: text(item.region),
  address: text(item.address),
  status: text(item.status) || "ACTIVE",
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
}));

const serviceActivities = serviceActivitiesRaw.map((item: any) => ({
  id: text(item.id),
  companyId: text(item.companyId),
  staffId: text(item.staffId),
  brokerId: text(item.brokerId),
  customerId: text(item.customerId),
  serviceType: text(item.serviceType) || "Service",
  amount: toNumber(item.amount),
  status: text(item.status) || "COMPLETED",
  servedAt: item.servedAt,
  notes: text(item.notes),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  customer: item.customer
    ? {
        ...item.customer,
        id: text(item.customer.id),
        name: text(item.customer.name),
        phone: text(item.customer.phone),
        email: text(item.customer.email),
        region: text(item.customer.region),
        address: text(item.customer.address),
        status: text(item.customer.status),
      }
    : null,
  staff: item.staff
    ? {
        ...item.staff,
        id: text(item.staff.id),
        name: text(item.staff.name),
        username: text(item.staff.username),
        email: text(item.staff.email),
        phone: text(item.staff.phone),
        role: text(item.staff.role),
        branchId: text(item.staff.branchId),
        branchName:
          branchMap.get(text(item.staff.branchId)) || "No branch",
        status: text(item.staff.status),
      }
    : null,
  broker: item.broker
    ? {
        ...item.broker,
        id: text(item.broker.id),
        name: text(item.broker.name),
        username: text(item.broker.username),
        email: text(item.broker.email),
        phone: text(item.broker.phone),
        role: text(item.broker.role),
      }
    : null,
}));

    const totalExpenses = expenses.reduce(
      (sum: number, item: any) => sum + toNumber(item.amount),
      0,
    );
    const approvedExpenses = expenses
      .filter((item: any) => item.status === "APPROVED")
      .reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);
    const totalDeposits = bankVerifications
      .filter((item: any) => item.status === "VERIFIED")
      .reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);

    const dates = lastDays(14);
    const attendanceIndex = new Map(
      attendance.map((item: any) => [
        `${text(item.userId)}:${isoDay(new Date(item.attendanceDate))}`,
        item,
      ]),
    );

    const attendanceSummary = users.map((user: any) => {
      const records = dates
        .map((date) => attendanceIndex.get(`${user.id}:${isoDay(date)}`))
        .filter(Boolean);
      const present = records.filter(
        (record: any) =>
          record.mark === "PRESENT" || record.mark === "LATE",
      ).length;
      const score = dates.length ? Math.round((present / dates.length) * 100) : 0;

      return {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        present,
        absent: records.filter((record: any) => record.mark === "ABSENT").length,
        late: records.filter((record: any) => record.mark === "LATE").length,
        leave: records.filter((record: any) => record.mark === "LEAVE").length,
        score,
        rating:
          score >= 90
            ? "Excellent"
            : score >= 75
              ? "Good"
              : score >= 60
                ? "Fair"
                : "Needs attention",
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
        .reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);

      const cashOut = expenses
        .filter(
          (item: any) =>
            item.status === "APPROVED" &&
            isoDay(new Date(item.expenseDate)) === key,
        )
        .reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);

      return {
        id: key,
        date,
        openingBalance: 0,
        cashIn,
        cashOut,
        closingBalance: cashIn - cashOut,
        status: "OPEN",
      };
    });

    const company = {
      id: companyId,
      name:
        text(companyRaw?.name) ||
        text(sessionUser.companyName) ||
        "Company Portal",
      code: text(companyRaw?.code),
      email: text(companyRaw?.email),
      phone: text(companyRaw?.phone),
      address: text(companyRaw?.address),
      status: text(companyRaw?.status) || "ACTIVE",
    };

    const unreadNotifications = notifications.filter(
      (item: any) => !item.isRead,
    ).length;
    const activeGpsDevices = gpsDevices.filter(
      (item: any) => item.status === "ACTIVE",
    ).length;
    const offlineGpsDevices = gpsDevices.filter((item: any) => {
      if (!item.lastSeenAt) return true;
      return Date.now() - new Date(item.lastSeenAt).getTime() > 10 * 60 * 1000;
    }).length;

    return NextResponse.json({
      success: true,
      company,
      users,
      branches,
      expenses,
      bankVerifications,
      attendance,
      attendanceSummary,
      notifications,
      gpsDevices,
      gpsPings,
      settings: settingsRaw ?? defaultSettings,
      activities: auditRaw,
      financialDays,
      customers,
      serviceActivities,
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter((item: any) => item.status === "ACTIVE").length,
        suspendedUsers: users.filter(
          (item: any) => item.status === "SUSPENDED",
        ).length,
        totalBranches: branches.length,
        totalExpenses,
        approvedExpenses,
        pendingExpenses: expenses.filter(
          (item: any) => item.status === "PENDING",
        ).length,
        rejectedExpenses: expenses.filter(
          (item: any) => item.status === "REJECTED",
        ).length,
        totalDeposits,
        pendingBankVerifications: bankVerifications.filter(
          (item: any) => item.status === "PENDING",
        ).length,
        bankMismatches: bankVerifications.filter(
          (item: any) =>
            !["PENDING", "VERIFIED"].includes(text(item.status)),
        ).length,
        totalNotifications: notifications.length,
        unreadNotifications,
        activeGpsDevices,
        offlineGpsDevices,
        gpsAlerts: offlineGpsDevices,
        netCash: totalDeposits - approvedExpenses,
        totalCustomers: customers.length,
        totalServiceActivities: serviceActivities.length,
        serviceRevenue: serviceActivities.reduce(
          (sum: number, item: any) => sum + toNumber(item.amount),
          0,
        ),
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
