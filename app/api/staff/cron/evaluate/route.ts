import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { evaluateMissingReturn } from "@/lib/staff/attendance";
import { sendNotice, sendNoticeToRoles } from "@/lib/staff/notify";
import { tzDateKey } from "@/lib/staff/time";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

async function createOfflineAlert(companyId: string, user: any, device: any) {
  const dedupeKey = `EMPLOYEE_OFFLINE:${user.id}:${tzDateKey()}`;
  const existing = await (db as any).gpsAlert.findUnique({
    where: { companyId_dedupeKey: { companyId, dedupeKey } },
  });
  await (db as any).gpsAlert.upsert({
    where: { companyId_dedupeKey: { companyId, dedupeKey } },
    create: {
      companyId,
      userId: user.id,
      deviceId: device?.id || null,
      type: "EMPLOYEE_OFFLINE",
      title: "Employee offline",
      message: `${user.name} has not sent a GPS update within the permitted interval.`,
      dedupeKey,
      status: "OPEN",
    },
    update: { status: "OPEN", resolvedAt: null, deviceId: device?.id || existing?.deviceId },
  });
  if (!existing || existing.status === "RESOLVED") {
    await Promise.all([
      sendNotice({
        companyId,
        userId: user.id,
        title: "GPS offline warning",
        message: "Your device has stopped sending live GPS updates.",
        type: "WARNING",
      }),
      sendNoticeToRoles({
        companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT", "GPS_MANAGER"],
        title: "Employee offline",
        message: `${user.name} has stopped sending live GPS updates.`,
        type: "WARNING",
      }),
    ]);
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  const now = new Date();
  const offlineMinutes = Number(process.env.STAFF_OFFLINE_MINUTES || 15);
  const threshold = new Date(now.getTime() - offlineMinutes * 60000);
  const staffUsers = await (db as any).user.findMany({
    where: { role: "STAFF", status: "ACTIVE", companyId: { not: null } },
    select: { id: true, name: true, companyId: true },
  });

  let attendanceEvaluated = 0;
  let offlineAlerts = 0;
  let outstandingReminders = 0;

  for (const user of staffUsers) {
    if (!user.companyId) continue;
    const absent = await evaluateMissingReturn(user.companyId, user.id, now);
    if (absent) {
      attendanceEvaluated += 1;
      await sendNotice({
        companyId: user.companyId,
        userId: user.id,
        title: "Attendance warning",
        message: "No money or float return was recorded before today’s cutoff time.",
        type: "WARNING",
      });
      await sendNoticeToRoles({
        companyId: user.companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
        title: "Attendance warning",
        message: `${user.name} did not return collections before the configured cutoff.`,
        type: "WARNING",
      });
    }

    const device = await (db as any).companyGpsDevice.findFirst({
      where: { companyId: user.companyId, ownerUserId: user.id },
      orderBy: { lastSeenAt: "desc" },
    });
    if (!device?.lastSeenAt || new Date(device.lastSeenAt) < threshold) {
      await createOfflineAlert(user.companyId, user, device);
      offlineAlerts += 1;
      if (device) {
        await (db as any).companyGpsDevice.update({ where: { id: device.id }, data: { status: "INACTIVE" } });
      }
    }

    const outstanding = await (db as any).floatTransaction.aggregate({
      where: {
        companyId: user.companyId,
        fromUserId: user.id,
        transactionType: "STAFF_TO_BROKER",
        status: { in: ["ISSUED", "CONFIRMED"] },
      },
      _sum: { amount: true },
    });
    const outstandingAmount = Number(outstanding._sum.amount || 0);
    if (outstandingAmount > 0) {
      await sendNotice({
        companyId: user.companyId,
        userId: user.id,
        title: "Outstanding float reminder",
        message: `TZS ${outstandingAmount.toLocaleString()} remains outstanding with brokers.`,
        type: "WARNING",
      });
      outstandingReminders += 1;
    }
  }

  return NextResponse.json({
    success: true,
    evaluatedAt: now,
    staffEvaluated: staffUsers.length,
    attendanceEvaluated,
    offlineAlerts,
    outstandingReminders,
  });
}
