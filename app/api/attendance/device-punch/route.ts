import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  asPortalError,
  PortalHttpError,
} from "@/lib/accountant-control/auth";
import {
  startOfTanzaniaDay,
} from "@/lib/accountant-control/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionFor(date: Date, requested: unknown) {
  const value = text(requested).toUpperCase();
  if (["MORNING", "EVENING"].includes(value)) return value;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Dar_es_Salaam",
    }).format(date),
  );
  return hour < 13 ? "MORNING" : "EVENING";
}

export async function POST(request: NextRequest) {
  try {
    const secret = text(request.headers.get("x-device-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    if (!secret) throw new PortalHttpError("Device key is required.", 401);

    const body = await request.json();
    const serialNumber = text(body.serialNumber);
    const externalUserCode = text(body.externalUserCode);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    if (!serialNumber || !externalUserCode || Number.isNaN(occurredAt.getTime())) {
      throw new PortalHttpError("Serial number, fingerprint user code and valid time are required.", 400);
    }

    const db = prisma as any;
    const device = await db.attendanceDevice.findFirst({
      where: { serialNumber, status: "ACTIVE" },
    });
    if (!device || !secureEqual(hashSecret(secret), String(device.apiKeyHash))) {
      throw new PortalHttpError("Fingerprint device authentication failed.", 401);
    }

    const enrolment = await db.attendanceDeviceEnrollment.findFirst({
      where: {
        companyId: device.companyId,
        deviceId: device.id,
        externalUserCode,
        isActive: true,
      },
    });

    const session = sessionFor(occurredAt, body.session);
    if (!enrolment) {
      await db.attendancePunch.create({
        data: {
          companyId: device.companyId,
          deviceId: device.id,
          externalUserCode,
          session,
          occurredAt,
          status: "REJECTED",
          message: "Fingerprint user code is not enrolled.",
          rawPayloadJson: JSON.stringify(body),
        },
      });
      throw new PortalHttpError("Fingerprint user code is not enrolled.", 404);
    }

    const user = await db.user.findFirst({
      where: { id: enrolment.userId, companyId: device.companyId, status: "ACTIVE" },
    });
    if (!user) throw new PortalHttpError("Enrolled company user is inactive or missing.", 404);

    const date = startOfTanzaniaDay(occurredAt);
    const lateHour = session === "MORNING" ? 9 : 18;
    const localHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Africa/Dar_es_Salaam",
      }).format(occurredAt),
    );
    const mark = localHour >= lateHour ? "LATE" : "PRESENT";

    await db.$transaction(async (tx: any) => {
      await tx.attendancePunch.create({
        data: {
          companyId: device.companyId,
          deviceId: device.id,
          enrollmentId: enrolment.id,
          userId: user.id,
          externalUserCode,
          session,
          occurredAt,
          status: "ACCEPTED",
          message: `${session.toLowerCase()} fingerprint accepted.`,
          rawPayloadJson: JSON.stringify(body),
        },
      });

      const data = session === "MORNING"
        ? {
            morningStatus: mark,
            morningSource: "FINGERPRINT_DEVICE",
            checkInAt: occurredAt,
          }
        : {
            eveningStatus: mark,
            eveningSource: "FINGERPRINT_DEVICE",
            checkOutAt: occurredAt,
          };

      const existing = await tx.attendance.findUnique({
        where: { userId_date: { userId: user.id, date } },
      });
      const morning = session === "MORNING" ? mark : existing?.morningStatus;
      const evening = session === "EVENING" ? mark : existing?.eveningStatus;
      const overall =
        morning === "ABSENT" && evening === "ABSENT"
          ? "ABSENT"
          : morning === "LATE" || evening === "LATE"
            ? "LATE"
            : morning || evening || "PRESENT";

      await tx.attendance.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: {
          ...data,
          companyId: device.companyId,
          status: overall,
          source: "FINGERPRINT_DEVICE",
          deviceId: device.id,
          verifiedAt: new Date(),
        },
        create: {
          companyId: device.companyId,
          userId: user.id,
          date,
          status: overall,
          source: "FINGERPRINT_DEVICE",
          deviceId: device.id,
          morningStatus: session === "MORNING" ? mark : null,
          eveningStatus: session === "EVENING" ? mark : null,
          morningSource: session === "MORNING" ? "FINGERPRINT_DEVICE" : null,
          eveningSource: session === "EVENING" ? "FINGERPRINT_DEVICE" : null,
          checkInAt: session === "MORNING" ? occurredAt : null,
          checkOutAt: session === "EVENING" ? occurredAt : null,
          verifiedAt: new Date(),
        },
      });

      await tx.attendanceDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    });

    return NextResponse.json({
      success: true,
      message: `${user.name} ${session.toLowerCase()} attendance recorded as ${mark.toLowerCase()}.`,
      userId: user.id,
      session,
      status: mark,
    });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
