import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  requireCompanyAdmin,
  routeError,
  toNumber,
} from "@/lib/company-admin-server";

function rate(value: number, total: number, empty = 100) {
  return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : empty;
}

export async function POST() {
  try {
    const admin = await requireCompanyAdmin();
    const companyId = admin.companyId as string;
    const db = prisma as any;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [settings, users, attendance, floats, visits] = await Promise.all([
      db.companyAdminSetting.findUnique({ where: { companyId } }),
      db.user.findMany({
        where: {
          companyId,
          role: { in: ["STAFF", "ACCOUNTANT"] },
          status: "ACTIVE",
        },
        select: { id: true, name: true, role: true },
      }),
      db.companyAttendance.findMany({
        where: { companyId, attendanceDate: { gte: monthStart, lt: nextMonth } },
      }),
      db.floatTransaction.findMany({
        where: { companyId, createdAt: { gte: monthStart, lt: nextMonth } },
      }),
      db.brokerServiceVisit.findMany({
        where: { companyId, startedAt: { gte: monthStart, lt: nextMonth } },
      }),
    ]);

    const threshold = Number(settings?.minimumPerformanceScore || 60);
    const rawRows = users.map((user: any) => {
      const attendanceRows = attendance.filter((row: any) => row.userId === user.id);
      const present = attendanceRows.filter((row: any) => ["PRESENT", "LATE"].includes(row.mark)).length;
      const working = attendanceRows.filter((row: any) => ["PRESENT", "LATE", "ABSENT"].includes(row.mark)).length;
      const attendanceRate = rate(present, working, 0);

      const issued = floats
        .filter((row: any) => row.toUserId === user.id)
        .reduce((sum: number, row: any) => sum + toNumber(row.amount), 0);
      const returnedDirect = floats
        .filter((row: any) => row.toUserId === user.id)
        .reduce((sum: number, row: any) => sum + toNumber(row.returnedAmount), 0);
      const returnedTransactions = floats
        .filter((row: any) => row.fromUserId === user.id && row.transactionType === "STAFF_RETURN_TO_ACCOUNTANT")
        .reduce((sum: number, row: any) => sum + toNumber(row.amount), 0);
      const returned = Math.max(returnedDirect, returnedTransactions);
      const returnRate = rate(returned, issued, 100);

      const userVisits = visits.filter((row: any) => row.staffId === user.id);
      const compliant = userVisits.filter((row: any) => row.status === "COMPLETED").length;
      const proofRate = rate(compliant, userVisits.length, 100);
      const income = userVisits.reduce((sum: number, row: any) => sum + toNumber(row.companyIncome), 0);

      return { user, attendanceRate, returnRate, proofRate, income };
    });

    const maximumIncome = Math.max(1, ...rawRows.map((row: any) => row.income));
    const lowRows = rawRows
      .map((row: any) => ({
        ...row,
        score: Math.round(
          row.attendanceRate * 0.25 +
            row.returnRate * 0.3 +
            row.proofRate * 0.25 +
            rate(row.income, maximumIncome, 0) * 0.2,
        ),
      }))
      .filter((row: any) => row.score < threshold);

    let created = 0;
    for (const row of lowRows) {
      const existing = await db.companyNotification.findFirst({
        where: {
          companyId,
          targetUserId: row.user.id,
          type: "PERFORMANCE",
          createdAt: { gte: monthStart, lt: nextMonth },
          message: { contains: `score of ${row.score}%` },
        },
      });
      if (existing) continue;

      await Promise.all([
        createNotification({
          companyId,
          targetUserId: row.user.id,
          title: "Performance target not reached",
          message: `${row.user.name}, your current performance score of ${row.score}% is below the ${threshold}% target. Review attendance, float returns, proof timing and company income.`,
          type: "PERFORMANCE",
          link: "/dashboard",
        }),
        createNotification({
          companyId,
          targetRole: "COMPANY_ADMIN",
          title: "Staff performance alert",
          message: `${row.user.name} (${row.user.role}) has a score of ${row.score}% against the ${threshold}% target.`,
          type: "PERFORMANCE",
          link: "/admin/dashboard?section=performance",
        }),
      ]);
      created += 1;
    }

    if (created) {
      await createAudit({
        companyId,
        actorId: admin.id,
        actorName: admin.name,
        actorRole: admin.role,
        action: "CREATE_PERFORMANCE_ALERTS",
        module: "PERFORMANCE",
        details: `Created ${created} low-performance alert(s).`,
      });
    }

    return NextResponse.json({
      success: true,
      checked: users.length,
      belowTarget: lowRows.length,
      created,
      threshold,
    });
  } catch (error) {
    return routeError(error);
  }
}
