import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type SafeResult<T> = {
  data: T;
  error: string | null;
};

async function safeQuery<T>(
  fallback: T,
  callback: () => Promise<T>,
): Promise<SafeResult<T>> {
  try {
    return {
      data: await callback(),
      error: null,
    };
  } catch (error) {
    console.error("SAFE_DASHBOARD_QUERY_ERROR:", error);

    return {
      data: fallback,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not logged in.",
        },
        { status: 401 },
      );
    }

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Only Super Admin can access this dashboard.",
          currentRole: user.role,
        },
        { status: 403 },
      );
    }

    const db = prisma as any;

    const totalCompaniesResult = await safeQuery(0, () =>
      prisma.company.count(),
    );

    const activeCompaniesResult = await safeQuery(0, () =>
      prisma.company.count({
        where: {
          status: "ACTIVE",
        },
      }),
    );

    const suspendedCompaniesResult = await safeQuery(0, () =>
      prisma.company.count({
        where: {
          status: "SUSPENDED",
        },
      }),
    );

    const disabledCompaniesResult = await safeQuery(0, () =>
      prisma.company.count({
        where: {
          status: "DISABLED" as any,
        },
      }),
    );

    const totalUsersResult = await safeQuery(0, () => prisma.user.count());

    const totalCompanyAdminsResult = await safeQuery(0, () =>
      prisma.user.count({
        where: {
          role: "COMPANY_ADMIN" as any,
        },
      }),
    );

    const activeCompanyAdminsResult = await safeQuery(0, () =>
      prisma.user.count({
        where: {
          role: "COMPANY_ADMIN" as any,
          status: "ACTIVE" as any,
        },
      }),
    );

    const totalSubscriptionsResult = await safeQuery(0, () =>
      prisma.subscription.count(),
    );

    const activeSubscriptionsResult = await safeQuery(0, () =>
      prisma.subscription.count({
        where: {
          isActive: true,
        },
      }),
    );

    const totalAuditLogsResult = await safeQuery(0, () =>
      prisma.auditLog.count(),
    );

    const totalNotificationsResult = await safeQuery(0, () =>
      prisma.notification.count({
        where: {
          userId: user.id,
        },
      }),
    );

    const unreadNotificationsResult = await safeQuery(0, () =>
      prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      }),
    );

    const totalMessagesResult = await safeQuery(0, () =>
      db.message.count({
        where: {
          receiverId: user.id,
        },
      }),
    );

    const unreadMessagesResult = await safeQuery(0, () =>
      db.message.count({
        where: {
          receiverId: user.id,
          isRead: false,
        },
      }),
    );

    const companiesResult = await safeQuery<any[]>([], () =>
      prisma.company.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          users: {
            select: {
              id: true,
            },
          },
          branches: {
            select: {
              id: true,
            },
          },
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      }),
    );

    const subscriptionsResult = await safeQuery<any[]>([], () =>
      prisma.subscription.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
        },
      }),
    );

    const auditLogsResult = await safeQuery<any[]>([], () =>
      prisma.auditLog.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
        include: {
          user: {
            select: {
              name: true,
              role: true,
            },
          },
          company: {
            select: {
              name: true,
            },
          },
        },
      }),
    );

    const notificationsResult = await safeQuery<any[]>([], () =>
      prisma.notification.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
    );

    const messagesResult = await safeQuery<any[]>([], () =>
      db.message.findMany({
        where: {
          receiverId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          company: {
            select: {
              name: true,
            },
          },
        },
      }),
    );

    const usersResult = await safeQuery<any[]>([], () =>
      prisma.user.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    );

    const revenueTotal = subscriptionsResult.data.reduce(
      (sum: number, item: any) => sum + Number(item.amount),
      0,
    );

    const warnings = [
      totalCompaniesResult.error,
      activeCompaniesResult.error,
      suspendedCompaniesResult.error,
      disabledCompaniesResult.error,
      totalUsersResult.error,
      totalCompanyAdminsResult.error,
      activeCompanyAdminsResult.error,
      totalSubscriptionsResult.error,
      activeSubscriptionsResult.error,
      totalAuditLogsResult.error,
      totalNotificationsResult.error,
      unreadNotificationsResult.error,
      totalMessagesResult.error,
      unreadMessagesResult.error,
      companiesResult.error,
      subscriptionsResult.error,
      auditLogsResult.error,
      notificationsResult.error,
      messagesResult.error,
      usersResult.error,
    ].filter(Boolean);

    return NextResponse.json({
      success: true,
      message: "Dashboard data loaded.",
      warnings,
      stats: {
        totalCompanies: totalCompaniesResult.data,
        activeCompanies: activeCompaniesResult.data,
        suspendedCompanies: suspendedCompaniesResult.data,
        disabledCompanies: disabledCompaniesResult.data,
        totalUsers: totalUsersResult.data,
        totalCompanyAdmins: totalCompanyAdminsResult.data,
        activeCompanyAdmins: activeCompanyAdminsResult.data,
        totalSubscriptions: totalSubscriptionsResult.data,
        activeSubscriptions: activeSubscriptionsResult.data,
        totalAuditLogs: totalAuditLogsResult.data,
        totalNotifications: totalNotificationsResult.data,
        unreadNotifications: unreadNotificationsResult.data,
        totalMessages: totalMessagesResult.data,
        unreadMessages: unreadMessagesResult.data,
        revenueTotal,
      },
      companies: companiesResult.data.map((company: any) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        email: company.email,
        phone: company.phone,
        address: company.address,
        status: company.status,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        usersCount: company.users.length,
        branchesCount: company.branches.length,
        latestPlan: company.subscriptions[0]?.plan ?? "No Plan",
        latestAmount: company.subscriptions[0]
          ? Number(company.subscriptions[0].amount)
          : 0,
      })),
      subscriptions: subscriptionsResult.data.map((subscription: any) => ({
        id: subscription.id,
        plan: subscription.plan,
        amount: Number(subscription.amount),
        isActive: subscription.isActive,
        startsAt: subscription.startsAt,
        endsAt: subscription.endsAt,
        company: subscription.company,
      })),
      auditLogs: auditLogsResult.data,
      notifications: notificationsResult.data,
      messages: messagesResult.data,
      users: usersResult.data.map((item: any) => ({
        id: item.id,
        name: item.name,
        username: item.username,
        email: item.email,
        phone: item.phone,
        role: item.role,
        status: item.status,
        companyId: item.companyId,
        companyName: item.company?.name ?? "System",
        companyCode: item.company?.code ?? null,
        branchName: item.branch?.name ?? "No Branch",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (error) {
    console.error("SUPER_ADMIN_DASHBOARD_FATAL_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Dashboard API failed completely.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
