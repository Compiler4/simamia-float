import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getStaffGpsSchedule } from "@/lib/staff/gps-schedule";
import { createNotice, createRoleNotices } from "@/lib/staff/notify-live";
import { requireStaffSession } from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown, max = 191): string {
  return String(value ?? "").trim().slice(0, max);
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validCoordinatePair(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

async function markDeviceInactive(input: {
  database: any;
  companyId: string;
  staffId: string;
  deviceToken: string;
}) {
  if (!input.deviceToken) return null;

  const existing = await input.database.companyGpsDevice.findUnique({
    where: { deviceToken: input.deviceToken },
  });

  if (!existing) return null;

  if (
    String(existing.companyId) !== input.companyId ||
    String(existing.ownerUserId || "") !== input.staffId
  ) {
    throw new Error("GPS_DEVICE_FORBIDDEN");
  }

  return input.database.companyGpsDevice.update({
    where: { id: existing.id },
    data: { status: "INACTIVE" },
  });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

  if (message === "UNAUTHENTICATED") {
    return NextResponse.json(
      { success: false, message: "Please sign in." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN" || message === "STAFF_COMPANY_REQUIRED") {
    return NextResponse.json(
      { success: false, message: "Staff access is required." },
      { status: 403 },
    );
  }

  if (message === "GPS_DEVICE_FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "This GPS device belongs to another account." },
      { status: 403 },
    );
  }

  const prismaCode = (error as { code?: string })?.code;
  console.error("[STAFF_GPS]", error);

  return NextResponse.json(
    {
      success: false,
      message:
        prismaCode === "P2021" || prismaCode === "P2022"
          ? "The GPS database is not synchronized. Run npx prisma db push and npx prisma generate."
          : "The GPS location could not be saved.",
      code: prismaCode,
      details: process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession();
    const body = await request.json();
    const database = db as any;
    const event = text(body.event, 50).toUpperCase();
    const deviceToken = text(body.deviceToken, 191);
    const schedule = getStaffGpsSchedule(new Date());

    if (
      event === "SCHEDULE_STOP" ||
      event === "MANUAL_STOP" ||
      event === "PAGE_STOP"
    ) {
      const device = await markDeviceInactive({
        database,
        companyId: session.companyId,
        staffId: session.id,
        deviceToken,
      });

      return NextResponse.json({
        success: true,
        sharingAllowed: false,
        schedule,
        device,
        message:
          event === "SCHEDULE_STOP"
            ? `Automatic GPS stopped at ${schedule.stopTime}. It will start again from ${schedule.startTime} when the Staff portal is open.`
            : "Live GPS sharing stopped.",
      });
    }

    if (event === "PERMISSION_DENIED" || event === "DISABLED") {
      const device = await markDeviceInactive({
        database,
        companyId: session.companyId,
        staffId: session.id,
        deviceToken,
      });

      await Promise.allSettled([
        createNotice({
          companyId: session.companyId,
          userId: session.id,
          title: "GPS permission required",
          message: `${session.name}'s device did not allow location access. Enable browser location permission so automatic daytime tracking can continue.`,
          type: "WARNING",
        }),
        createRoleNotices({
          companyId: session.companyId,
          roles: ["COMPANY_ADMIN", "ACCOUNTANT", "GPS_MANAGER"],
          title: "Staff GPS permission unavailable",
          message: `${session.name}'s device did not allow location access during the scheduled tracking period.`,
          type: "WARNING",
          excludeUserId: session.id,
        }),
      ]);

      return NextResponse.json({
        success: true,
        sharingAllowed: false,
        schedule,
        device,
        message: "Location permission is required for automatic Staff GPS.",
      });
    }

    if (!schedule.isSharingWindow) {
      const device = await markDeviceInactive({
        database,
        companyId: session.companyId,
        staffId: session.id,
        deviceToken,
      });

      return NextResponse.json({
        success: true,
        sharingAllowed: false,
        schedule,
        device,
        message: `Night schedule is active. GPS sharing resumes at ${schedule.startTime}.`,
      });
    }

    if (!deviceToken) {
      return NextResponse.json(
        { success: false, message: "A GPS device token is required." },
        { status: 400 },
      );
    }

    const latitude = finiteNumber(body.latitude);
    const longitude = finiteNumber(body.longitude);

    if (
      latitude === null ||
      longitude === null ||
      !validCoordinatePair(latitude, longitude)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The GPS coordinates are invalid. Coordinates 0,0 are rejected.",
        },
        { status: 400 },
      );
    }

    const accuracy = finiteNumber(body.accuracy);
    const speedMps = finiteNumber(body.speed);
    const heading = finiteNumber(body.heading);
    const batteryLevel = finiteNumber(body.batteryLevel);
    const speedKph = speedMps == null ? null : Math.max(0, speedMps * 3.6);
    const capturedAt = body.capturedAt
      ? new Date(String(body.capturedAt))
      : new Date();

    if (Number.isNaN(capturedAt.getTime())) {
      return NextResponse.json(
        { success: false, message: "The GPS capture time is invalid." },
        { status: 400 },
      );
    }

    const deviceName =
      text(body.deviceName, 120) || "Staff mobile device";
    const existing = await database.companyGpsDevice.findUnique({
      where: { deviceToken },
    });

    if (
      existing &&
      (String(existing.companyId) !== session.companyId ||
        String(existing.ownerUserId || "") !== session.id)
    ) {
      throw new Error("GPS_DEVICE_FORBIDDEN");
    }

    const device = existing
      ? await database.companyGpsDevice.update({
          where: { id: existing.id },
          data: {
            name: deviceName,
            status: "ACTIVE",
            lastSeenAt: capturedAt,
            lastLatitude: latitude,
            lastLongitude: longitude,
            batteryLevel:
              batteryLevel == null
                ? existing.batteryLevel
                : Math.max(0, Math.min(100, Math.round(batteryLevel))),
            gpsAccuracy: accuracy,
            speedKph,
          },
        })
      : await database.companyGpsDevice.create({
          data: {
            companyId: session.companyId,
            name: deviceName,
            deviceType: "WEB_GEOLOCATION",
            ownerUserId: session.id,
            ownerName: session.name,
            deviceToken,
            status: "ACTIVE",
            lastSeenAt: capturedAt,
            lastLatitude: latitude,
            lastLongitude: longitude,
            batteryLevel:
              batteryLevel == null
                ? null
                : Math.max(0, Math.min(100, Math.round(batteryLevel))),
            gpsAccuracy: accuracy,
            speedKph,
          },
        });

    // Keep exactly one active Staff device/pointer for this Staff account.
    if (typeof database.companyGpsDevice.updateMany === "function") {
      await database.companyGpsDevice.updateMany({
        where: {
          companyId: session.companyId,
          ownerUserId: session.id,
          id: { not: device.id },
          status: "ACTIVE",
        },
        data: { status: "INACTIVE" },
      });
    }

    await database.companyGpsPing.create({
      data: {
        deviceId: device.id,
        companyId: session.companyId,
        latitude,
        longitude,
        accuracy,
        batteryLevel:
          batteryLevel == null
            ? null
            : Math.max(0, Math.min(100, Math.round(batteryLevel))),
        speedKph,
        capturedAt,
      },
    });

    const warnings: string[] = [];

    // Keep legacy travel-history support, but never fail the live GPS save when
    // a deployment has an older gps_tracking table.
    if (database.gpsTracking && typeof database.gpsTracking.create === "function") {
      try {
        await database.gpsTracking.create({
          data: {
            companyId: session.companyId,
            userId: session.id,
            assetType: "STAFF_DEVICE",
            assetName: deviceName,
            liveLocation: JSON.stringify({
              latitude,
              longitude,
              accuracy,
              heading,
            }),
            latitude,
            longitude,
            accuracy,
            heading,
            speed: speedKph,
            gpsSignal:
              accuracy == null
                ? "AVAILABLE"
                : accuracy <= 20
                  ? "STRONG"
                  : accuracy <= 50
                    ? "FAIR"
                    : "WEAK",
            recordedAt: capturedAt,
          },
        });
      } catch (trackingError) {
        warnings.push("Travel-history compatibility record was skipped.");
        console.warn("[GPS_TRACKING_COMPATIBILITY_SKIPPED]", trackingError);
      }
    }

    return NextResponse.json({
      success: true,
      sharingAllowed: true,
      message: "Automatic daytime Staff GPS location saved.",
      schedule,
      device,
      location: {
        latitude,
        longitude,
        accuracy,
        speedKph,
        heading,
        capturedAt,
      },
      warnings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
