import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  normalizeDate,
  requireCompanyMember,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const marks = new Set(["PRESENT", "LATE", "ABSENT", "LEAVE", "HOLIDAY"]);

async function saveOne(
  db: any,
  companyId: string,
  actor: any,
  body: Record<string, unknown>,
) {
  const userId = text(body.userId).trim();
  const mark = text(body.mark).toUpperCase();
  const attendanceDate = normalizeDate(body.attendanceDate || new Date());

  if (!userId || !marks.has(mark)) {
    throw new HttpError("User and a valid attendance mark are required.", 422);
  }

  const target = await db.user.findFirst({
    where: {
      id: userId,
      companyId,
      role: { in: ["STAFF", "ACCOUNTANT"] },
      status: "ACTIVE",
    },
  });

  if (!target) {
    throw new HttpError(
      "Attendance can only be marked for active Staff and Accountant users.",
      404,
    );
  }

  const attendance = await db.companyAttendance.upsert({
    where: {
      companyId_userId_attendanceDate: { companyId, userId, attendanceDate },
    },
    update: {
      userName: target.name,
      userRole: target.role,
      mark,
      checkInAt: body.checkInAt ? new Date(text(body.checkInAt)) : null,
      checkOutAt: body.checkOutAt ? new Date(text(body.checkOutAt)) : null,
      source: text(body.source).trim() || "MANUAL_JOURNAL",
      note: text(body.note).trim() || null,
    },
    create: {
      companyId,
      userId,
      userName: target.name,
      userRole: target.role,
      attendanceDate,
      mark,
      checkInAt: body.checkInAt ? new Date(text(body.checkInAt)) : null,
      checkOutAt: body.checkOutAt ? new Date(text(body.checkOutAt)) : null,
      source: text(body.source).trim() || "MANUAL_JOURNAL",
      note: text(body.note).trim() || null,
    },
  });

  if (mark === "ABSENT" || mark === "LATE") {
    await createNotification({
      companyId,
      targetUserId: userId,
      title: "Attendance journal updated",
      message: `${actor.name} marked you ${mark} for ${attendanceDate
        .toISOString()
        .slice(0, 10)}.`,
      type: "ATTENDANCE",
      link: "/dashboard",
    });
  }

  return attendance;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = actor.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const rows = Array.isArray(body.rows) ? body.rows : [body];
    if (!rows.length || rows.length > 500) {
      throw new HttpError("Submit between 1 and 500 attendance rows.", 422);
    }

    const saved = [];
    for (const row of rows) {
      saved.push(await saveOne(db, companyId, actor, row));
    }

    await createAudit({
      companyId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "MARK_ATTENDANCE",
      module: "ATTENDANCE",
      details: `Updated ${saved.length} attendance journal row(s).`,
    });

    return NextResponse.json({ success: true, attendance: saved });
  } catch (error) {
    return routeError(error);
  }
}
