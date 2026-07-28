import { createHash, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonError, requiredText } from "@/lib/accountant-v3/http";
import { syncLegacyAttendance } from "@/lib/accountant-v3/legacy-attendance";
import { notifyUser } from "@/lib/accountant-v3/notifications";

export const dynamic = "force-dynamic";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = prisma as any;
    const token = requiredText(request.headers.get("x-device-token"), "Device token");
    const body = await request.json();
    const serialNumber = requiredText(body.serialNumber, "Device serial number");
    const templateKey = requiredText(body.templateKey, "Fingerprint template key");

    const device = await db.accountantFingerprintDevice.findFirst({
      where: { serialNumber, status: "ACTIVE" },
    });
    if (!device || !secureEqual(hashToken(token), String(device.accessTokenHash))) {
      return NextResponse.json(
        { success: false, message: "Fingerprint device authentication failed." },
        { status: 401 },
      );
    }

    const enrollment = await db.accountantFingerprintEnrollment.findFirst({
      where: {
        companyId: device.companyId,
        deviceId: device.id,
        templateKey,
      },
    });
    if (!enrollment) {
      return NextResponse.json(
        { success: false, message: "This fingerprint is not enrolled for the device." },
        { status: 404 },
      );
    }

    const staff = await db.user.findFirst({
      where: {
        id: enrollment.staffId,
        companyId: device.companyId,
        role: "STAFF",
        status: "ACTIVE",
      },
    });
    if (!staff) {
      return NextResponse.json(
        { success: false, message: "The enrolled user is not an active STAFF user." },
        { status: 403 },
      );
    }

    const now = new Date();
    const session = String(body.session ?? "").toUpperCase() || (localHour(now) < 13 ? "MORNING" : "EVENING");
    if (!["MORNING", "EVENING"].includes(session)) {
      throw new Error("Session must be MORNING or EVENING.");
    }

    const attendanceDate = new Date(`${localDateKey(now)}T00:00:00.000Z`);
    await db.$transaction([
      db.accountantAttendanceSessionRecord.upsert({
        where: {
          companyId_staffId_attendanceDate_session: {
            companyId: device.companyId,
            staffId: staff.id,
            attendanceDate,
            session,
          },
        },
        update: {
          mark: "PRESENT",
          source: "FINGERPRINT",
          checkedAt: now,
          checkedById: device.registeredById,
          deviceId: device.id,
          note: body.note ? String(body.note) : null,
        },
        create: {
          companyId: device.companyId,
          staffId: staff.id,
          attendanceDate,
          session,
          mark: "PRESENT",
          source: "FINGERPRINT",
          checkedAt: now,
          checkedById: device.registeredById,
          deviceId: device.id,
          note: body.note ? String(body.note) : null,
        },
      }),
      db.accountantFingerprintDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: now },
      }),
    ]);

    await syncLegacyAttendance({
      companyId: device.companyId,
      staffId: staff.id,
      attendanceDate,
      checkedById: device.registeredById,
    });

    await notifyUser({
      companyId: device.companyId,
      userId: staff.id,
      title: `${session.toLowerCase()} fingerprint attendance recorded`,
      message: `Your ${session.toLowerCase()} attendance was recorded by ${device.name}.`,
      type: "SUCCESS",
    });

    return NextResponse.json({
      success: true,
      message: `${staff.name ?? staff.email} was marked present for ${session.toLowerCase()}.`,
      staff: { id: staff.id, name: staff.name, email: staff.email },
      session,
      attendanceDate: attendanceDate.toISOString(),
    });
  } catch (error) {
    return jsonError(error, "Fingerprint attendance could not be recorded.");
  }
}
