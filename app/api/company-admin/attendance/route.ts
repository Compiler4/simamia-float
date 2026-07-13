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

const marks = ["PRESENT", "LATE", "ABSENT", "LEAVE", "HOLIDAY"];

export async function POST(request: NextRequest) {
  try {
    const admin = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = admin.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const userId = text(body.userId);
    const mark = text(body.mark);
    const attendanceDate = normalizeDate(body.attendanceDate || new Date());

    if (!userId || !marks.includes(mark)) {
      throw new HttpError("User and valid attendance mark are required.", 422);
    }

    const target = await db.user.findFirst({
      where: {
        id: userId,
        companyId,
        NOT: {
          role: {
            in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"],
          },
        },
      },
    });

    if (!target) throw new HttpError("Company user not found.", 404);

    const attendance = await db.companyAttendance.upsert({
      where: {
        companyId_userId_attendanceDate: {
          companyId,
          userId,
          attendanceDate,
        },
      },
      update: {
        userName: text(target.name),
        userRole: text(target.role),
        mark,
        checkInAt: body.checkInAt ? new Date(body.checkInAt) : null,
        checkOutAt: body.checkOutAt ? new Date(body.checkOutAt) : null,
        source: text(body.source) || "MANUAL",
        note: text(body.note).trim() || null,
      },
      create: {
        companyId,
        userId,
        userName: text(target.name),
        userRole: text(target.role),
        attendanceDate,
        mark,
        checkInAt: body.checkInAt ? new Date(body.checkInAt) : null,
        checkOutAt: body.checkOutAt ? new Date(body.checkOutAt) : null,
        source: text(body.source) || "MANUAL",
        note: text(body.note).trim() || null,
      },
    });

    if (mark === "ABSENT" || mark === "LATE") {
      await createNotification({
        companyId,
        targetUserId: userId,
        title: "Attendance update",
        message: `${admin.name} marked your attendance as ${mark} for ${attendanceDate.toISOString().slice(0, 10)}.`,
        type: "ATTENDANCE",
        link: "/dashboard",
      });
    }

    await createAudit({
      companyId,
      actorId: admin.id,
      actorName: admin.name,
      actorRole: admin.role,
      action: "MARK_ATTENDANCE",
      module: "ATTENDANCE",
      details: `${text(target.name)}: ${mark} on ${attendanceDate.toISOString().slice(0, 10)}.`,
    });

    return NextResponse.json({ success: true, attendance });
  } catch (error) {
    return routeError(error);
  }
}
