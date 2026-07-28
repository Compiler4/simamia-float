import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { endOfTanzaniaDay, startOfTanzaniaDay } from "@/lib/accountant-control/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown) => String(value ?? "").trim();
const hash = (value: string) => createHash("sha256").update(value).digest();

function secureHashMatch(secret: string, storedHex: string) {
  const supplied = hash(secret);
  const stored = Buffer.from(storedHex, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const serialNumber = text(body.serialNumber);
    const externalUserCode = text(body.externalUserCode);
    const secret = text(request.headers.get("x-device-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const session = text(body.session).toUpperCase();
    const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();

    if (!serialNumber || !externalUserCode || !secret || !["MORNING", "EVENING"].includes(session)) {
      return NextResponse.json({ success: false, message: "serialNumber, externalUserCode, device secret and MORNING/EVENING session are required." }, { status: 400 });
    }
    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json({ success: false, message: "Invalid attendance timestamp." }, { status: 400 });
    }

    const db = prisma as any;
    const device = await db.attendanceDevice.findFirst({ where: { serialNumber, status: "ACTIVE" } });
    if (!device || !secureHashMatch(secret, String(device.apiKeyHash))) {
      return NextResponse.json({ success: false, message: "Fingerprint device authentication failed." }, { status: 401 });
    }

    const enrolment = await db.attendanceDeviceEnrollment.findFirst({
      where: { deviceId: device.id, externalUserCode, isActive: true },
    });
    if (!enrolment) {
      return NextResponse.json({ success: false, message: "Fingerprint enrolment was not found." }, { status: 404 });
    }

    const staff = await db.user.findFirst({
      where: { id: enrolment.userId, companyId: device.companyId, role: "STAFF", status: "ACTIVE" },
    });
    if (!staff) {
      return NextResponse.json({ success: false, message: "The enrolled active STAFF user was not found." }, { status: 404 });
    }

    const day = startOfTanzaniaDay(occurredAt);
    const existing = await db.attendance.findFirst({
      where: { companyId: device.companyId, userId: staff.id, date: { gte: day, lte: endOfTanzaniaDay(occurredAt) } },
    });
    const morning = session === "MORNING";
    const patch = morning
      ? { morningStatus: "PRESENT", morningSource: `FINGERPRINT:${device.id}`, checkInAt: occurredAt }
      : { eveningStatus: "PRESENT", eveningSource: `FINGERPRINT:${device.id}`, checkOutAt: occurredAt };

    const attendance = existing
      ? await db.attendance.update({
          where: { id: existing.id },
          data: {
            ...patch,
            status: "PRESENT",
            source: "FINGERPRINT_DEVICE",
            verifiedById: device.registeredById,
            verifiedAt: new Date(),
          },
        })
      : await db.attendance.create({
          data: {
            companyId: device.companyId,
            userId: staff.id,
            date: day,
            status: "PRESENT",
            morningStatus: morning ? "PRESENT" : null,
            eveningStatus: morning ? null : "PRESENT",
            morningSource: morning ? `FINGERPRINT:${device.id}` : null,
            eveningSource: morning ? null : `FINGERPRINT:${device.id}`,
            checkInAt: morning ? occurredAt : null,
            checkOutAt: morning ? null : occurredAt,
            source: "FINGERPRINT_DEVICE",
            markedById: device.registeredById,
            verifiedById: device.registeredById,
            verifiedAt: new Date(),
          },
        });

    await db.attendanceDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return NextResponse.json({ success: true, message: `${session.toLowerCase()} fingerprint attendance recorded for ${staff.name}.`, attendance });
  } catch (error) {
    console.error("[FINGERPRINT_ATTENDANCE]", error);
    return NextResponse.json({ success: false, message: "Fingerprint attendance could not be recorded." }, { status: 500 });
  }
}
