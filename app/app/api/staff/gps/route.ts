import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStaffGpsSchedule } from "@/lib/staff/gps-schedule";
import { requireStaffSession } from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  const status =
    message === "UNAUTHENTICATED"
      ? 401
      : message === "FORBIDDEN" || message === "STAFF_COMPANY_REQUIRED"
        ? 403
        : 500;

  console.error("[STAFF_GPS]", error);

  return NextResponse.json(
    {
      success: false,
      message:
        status === 401
          ? "Please sign in again."
          : status === 403
            ? "Staff access is required."
            : code === "P2021" || code === "P2022"
              ? "The Staff GPS database is not synchronized."
              : "The Staff GPS location could not be saved.",
      code: code || undefined,
      details: process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status },
  );
}

export async function GET() {
  try {
    await requireStaffSession();
    const schedule = getStaffGpsSchedule(new Date());

    return NextResponse.json({
      success: true,
      schedule,
      serverNow: new Date().toISOString(),
      message: schedule.isSharingWindow
        ? `Automatic Staff GPS is active from ${schedule.startTime} until ${schedule.stopTime}.`
        : `Automatic Staff GPS is stopped until ${schedule.startTime}.`,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireStaffSession();
    const schedule = getStaffGpsSchedule(new Date());
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const event = clean(body.event).toUpperCase();

    // Control events are acknowledgements from the browser tracker. They are
    // accepted without creating fake 0,0 coordinates.
    if (event) {
      return NextResponse.json({
        success: true,
        sharingAllowed: schedule.isSharingWindow,
        schedule,
        message:
          event === "PERMISSION_DENIED"
            ? "Location permission is required before automatic GPS can share a real position."
            : event === "SCHEDULE_STOP"
              ? `GPS schedule stopped at ${schedule.stopTime}.`
              : "GPS control event recorded.",
      });
    }

    if (!schedule.isSharingWindow) {
      return NextResponse.json({
        success: true,
        sharingAllowed: false,
        schedule,
        message: `GPS sharing is outside the configured work window. It will resume at ${schedule.startTime}.`,
      });
    }

    const latitude = optionalNumber(body.latitude);
    const longitude = optionalNumber(body.longitude);
    const accuracy = optionalNumber(body.accuracy);
    const speedMps = optionalNumber(body.speed);
    const explicitSpeedKph = optionalNumber(body.speedKph);
    const speedKph =
      explicitSpeedKph !== null
        ? explicitSpeedKph
        : speedMps !== null
          ? speedMps * 3.6
          : null;
    const batteryLevelRaw = optionalNumber(body.batteryLevel);
    const batteryLevel =
      batteryLevelRaw === null
        ? null
        : Math.max(0, Math.min(100, Math.round(batteryLevelRaw)));

    if (
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A real non-zero latitude and longitude are required.",
        },
        { status: 422 },
      );
    }

    const capturedAt = body.capturedAt ? new Date(String(body.capturedAt)) : new Date();
    if (Number.isNaN(capturedAt.getTime())) {
      return NextResponse.json(
        { success: false, message: "The GPS capture time is invalid." },
        { status: 422 },
      );
    }

    const deviceToken = clean(body.deviceToken);
    if (!deviceToken) {
      return NextResponse.json(
        { success: false, message: "The Staff device token is required." },
        { status: 422 },
      );
    }

    const db = prisma as any;
    const companyId = String(session.companyId);
    const staffId = String(session.id);
    const deviceName = clean(body.deviceName) || "Staff browser device";

    let device = await db.companyGpsDevice.findFirst({
      where: {
        companyId,
        ownerUserId: staffId,
        deviceToken,
      },
    });

    if (!device) {
      const tokenOwner = await db.companyGpsDevice.findFirst({
        where: { deviceToken },
      });

      if (tokenOwner && String(tokenOwner.ownerUserId) !== staffId) {
        return NextResponse.json(
          {
            success: false,
            message: "This GPS device token belongs to another user. Clear this site's local storage and enable GPS again.",
          },
          { status: 403 },
        );
      }

      device = await db.companyGpsDevice.create({
        data: {
          companyId,
          ownerUserId: staffId,
          ownerName: session.name,
          name: deviceName,
          deviceToken,
          status: "ACTIVE",
          lastSeenAt: capturedAt,
          lastLatitude: latitude,
          lastLongitude: longitude,
          gpsAccuracy: accuracy,
          speedKph,
          batteryLevel,
        },
      });
    } else {
      device = await db.companyGpsDevice.update({
        where: { id: device.id },
        data: {
          name: deviceName,
          status: "ACTIVE",
          ownerName: session.name,
          lastSeenAt: capturedAt,
          lastLatitude: latitude,
          lastLongitude: longitude,
          gpsAccuracy: accuracy,
          speedKph,
          batteryLevel,
        },
      });
    }

    const ping = await db.companyGpsPing.create({
      data: {
        deviceId: device.id,
        companyId,
        latitude,
        longitude,
        accuracy,
        speedKph,
        batteryLevel,
        capturedAt,
      },
    });

    return NextResponse.json({
      success: true,
      sharingAllowed: true,
      schedule,
      message: "Real Staff GPS location saved.",
      device: {
        id: device.id,
        name: device.name,
        lastLatitude: device.lastLatitude,
        lastLongitude: device.lastLongitude,
        lastSeenAt: device.lastSeenAt,
      },
      ping,
    });
  } catch (error) {
    return routeError(error);
  }
}
