import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { markOperationalAttendance } from "@/lib/staff/attendance";
import { sendNotice, sendNoticeToRoles } from "@/lib/staff/notify";
import { requireStaff } from "@/lib/staff/permissions";
import { tzDateKey } from "@/lib/staff/time";

export const dynamic = "force-dynamic";

function numberValue(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`INVALID:${name}`);
  return parsed;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

async function setting(companyId: string, key: string): Promise<string | null> {
  const row = await (db as any).companySetting.findUnique({
    where: { companyId_key: { companyId, key } },
  });
  return row?.value || null;
}

async function createAlert(input: {
  companyId: string;
  userId: string;
  deviceId?: string | null;
  type: string;
  title: string;
  message: string;
  latitude?: number | null;
  longitude?: number | null;
  speedKph?: number | null;
  dedupeKey: string;
}) {
  const existing = await (db as any).gpsAlert.findUnique({
    where: { companyId_dedupeKey: { companyId: input.companyId, dedupeKey: input.dedupeKey } },
  });
  const alert = await (db as any).gpsAlert.upsert({
    where: { companyId_dedupeKey: { companyId: input.companyId, dedupeKey: input.dedupeKey } },
    create: {
      companyId: input.companyId,
      userId: input.userId,
      deviceId: input.deviceId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      speedKph: input.speedKph ?? null,
      dedupeKey: input.dedupeKey,
      status: "OPEN",
    },
    update: {
      deviceId: input.deviceId || existing?.deviceId,
      title: input.title,
      message: input.message,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      speedKph: input.speedKph ?? null,
      status: "OPEN",
      resolvedAt: null,
    },
  });
  if (!existing || existing.status === "RESOLVED") {
    await Promise.all([
      sendNotice({
        companyId: input.companyId,
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: "WARNING",
      }),
      sendNoticeToRoles({
        companyId: input.companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT", "GPS_MANAGER"],
        title: input.title,
        message: input.message,
        type: "WARNING",
        excludeUserId: input.userId,
      }),
    ]);
  }
  return alert;
}

async function resolveConnectivityAlerts(companyId: string, userId: string) {
  await (db as any).gpsAlert.updateMany({
    where: {
      companyId,
      userId,
      status: "OPEN",
      type: { in: ["GPS_DISABLED", "EMPLOYEE_OFFLINE"] },
    },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await request.json();

    if (String(body.event || "").toUpperCase() === "DISABLED") {
      await createAlert({
        companyId: session.companyId,
        userId: session.id,
        type: "GPS_DISABLED",
        title: "GPS disabled",
        message: `${session.name}'s device denied or disabled location access.`,
        dedupeKey: `GPS_DISABLED:${session.id}:${tzDateKey()}`,
      });
      return NextResponse.json({ success: true, message: "GPS-disabled alert recorded." });
    }

    const latitude = numberValue(body.latitude, "latitude");
    const longitude = numberValue(body.longitude, "longitude");
    const accuracy = body.accuracy == null ? null : numberValue(body.accuracy, "accuracy");
    const speedMps = body.speed == null ? null : numberValue(body.speed, "speed");
    const heading = body.heading == null ? null : numberValue(body.heading, "heading");
    const batteryLevel = body.batteryLevel == null ? null : Math.round(numberValue(body.batteryLevel, "batteryLevel"));
    const deviceToken = String(body.deviceToken ?? "").trim();
    const deviceName = String(body.deviceName ?? "Staff mobile device").trim().slice(0, 120);
    const capturedAt = body.capturedAt ? new Date(String(body.capturedAt)) : new Date();
    if (!deviceToken) return NextResponse.json({ success: false, message: "A device token is required." }, { status: 400 });
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ success: false, message: "The GPS coordinates are invalid." }, { status: 400 });
    }

    const speedKph = speedMps == null ? null : Math.max(0, speedMps * 3.6);
    const existing = await (db as any).companyGpsDevice.findUnique({ where: { deviceToken } });
    if (existing && (existing.companyId !== session.companyId || existing.ownerUserId !== session.id)) {
      return NextResponse.json({ success: false, message: "This GPS device belongs to another account." }, { status: 403 });
    }

    const device = existing
      ? await (db as any).companyGpsDevice.update({
          where: { id: existing.id },
          data: {
            name: deviceName,
            status: "ACTIVE",
            lastSeenAt: capturedAt,
            lastLatitude: latitude,
            lastLongitude: longitude,
            batteryLevel,
            gpsAccuracy: accuracy,
            speedKph,
          },
        })
      : await (db as any).companyGpsDevice.create({
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
            batteryLevel,
            gpsAccuracy: accuracy,
            speedKph,
          },
        });

    const recentPing = await (db as any).companyGpsPing.findFirst({
      where: { deviceId: device.id },
      orderBy: { capturedAt: "desc" },
    });

    await Promise.all([
      (db as any).companyGpsPing.create({
        data: {
          deviceId: device.id,
          companyId: session.companyId,
          latitude,
          longitude,
          accuracy,
          batteryLevel,
          speedKph,
          capturedAt,
        },
      }),
      (db as any).gpsTracking.create({
        data: {
          companyId: session.companyId,
          userId: session.id,
          assetType: "STAFF_DEVICE",
          assetName: deviceName,
          liveLocation: JSON.stringify({ latitude, longitude, accuracy, heading }),
          latitude,
          longitude,
          accuracy,
          heading,
          speed: speedKph,
          gpsSignal: accuracy == null ? "AVAILABLE" : accuracy <= 20 ? "STRONG" : accuracy <= 50 ? "FAIR" : "WEAK",
          recordedAt: capturedAt,
        },
      }),
    ]);

    await resolveConnectivityAlerts(session.companyId, session.id);
    if ((speedKph || 0) > 2 || (recentPing && distanceKm(recentPing.latitude, recentPing.longitude, latitude, longitude) > 0.05)) {
      await markOperationalAttendance({ companyId: session.companyId, userId: session.id, action: "GPS_MOVEMENT", occurredAt: capturedAt });
    }

    const overspeed = Number((await setting(session.companyId, "GPS_OVERSPEED_KPH")) || 80);
    if ((speedKph || 0) > overspeed) {
      await createAlert({
        companyId: session.companyId,
        userId: session.id,
        deviceId: device.id,
        type: "OVERSPEED",
        title: "Overspeed alert",
        message: `${session.name} was travelling at ${Math.round(speedKph || 0)} km/h, above the ${overspeed} km/h limit.`,
        latitude,
        longitude,
        speedKph,
        dedupeKey: `OVERSPEED:${session.id}:${tzDateKey(capturedAt)}:${new Date(capturedAt).getUTCHours()}`,
      });
    }

    const geofenceRaw = await setting(session.companyId, `STAFF_GEOFENCE_${session.id}`);
    if (geofenceRaw) {
      try {
        const fence = JSON.parse(geofenceRaw) as { latitude: number; longitude: number; radiusKm: number; name?: string };
        const distance = distanceKm(fence.latitude, fence.longitude, latitude, longitude);
        if (distance > Number(fence.radiusKm || 0)) {
          await createAlert({
            companyId: session.companyId,
            userId: session.id,
            deviceId: device.id,
            type: "LEFT_ASSIGNED_REGION",
            title: "Assigned region alert",
            message: `${session.name} moved ${distance.toFixed(1)} km from ${fence.name || "the assigned region"}.`,
            latitude,
            longitude,
            speedKph,
            dedupeKey: `LEFT_REGION:${session.id}:${tzDateKey(capturedAt)}`,
          });
        }
      } catch {
        // Ignore an invalid optional company setting; tracking remains available.
      }
    }

    const idleMinutes = Number((await setting(session.companyId, "GPS_LONG_IDLE_MINUTES")) || 30);
    if (recentPing && (speedKph || 0) < 1) {
      const elapsedMinutes = (capturedAt.getTime() - new Date(recentPing.capturedAt).getTime()) / 60000;
      const movedKm = distanceKm(recentPing.latitude, recentPing.longitude, latitude, longitude);
      if (elapsedMinutes >= idleMinutes && movedKm < 0.05) {
        await createAlert({
          companyId: session.companyId,
          userId: session.id,
          deviceId: device.id,
          type: "LONG_IDLE_TIME",
          title: "Long idle time",
          message: `${session.name}'s device remained in the same area for at least ${idleMinutes} minutes.`,
          latitude,
          longitude,
          speedKph,
          dedupeKey: `LONG_IDLE:${session.id}:${tzDateKey(capturedAt)}:${new Date(capturedAt).getUTCHours()}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Live GPS location saved.",
      location: { latitude, longitude, accuracy, speedKph, heading, capturedAt },
      device,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Staff access is required." }, { status: 403 });
    if (message.startsWith("INVALID:")) return NextResponse.json({ success: false, message: `${message.split(":")[1]} is invalid.` }, { status: 400 });
    console.error("[STAFF_GPS]", error);
    return NextResponse.json({ success: false, message: "The GPS location could not be saved." }, { status: 500 });
  }
}
