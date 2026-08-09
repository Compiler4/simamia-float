import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createNotification, routeError, text, HttpError } from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readDeviceToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || text(request.headers.get("x-device-token")).trim();
}

export async function POST(request: NextRequest) {
  try {
    const token = readDeviceToken(request);
    if (!token) throw new HttpError("A GPS device token is required.", 401);

    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = body.accuracy == null ? null : Number(body.accuracy);
    const speedKph = body.speedKph == null ? null : Number(body.speedKph);
    const batteryLevel = body.batteryLevel == null ? null : Number(body.batteryLevel);
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new HttpError("Latitude must be between -90 and 90.", 422);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new HttpError("Longitude must be between -180 and 180.", 422);
    if (Number.isNaN(capturedAt.getTime())) throw new HttpError("capturedAt must be a valid date/time.", 422);
    if (batteryLevel != null && (!Number.isInteger(batteryLevel) || batteryLevel < 0 || batteryLevel > 100)) throw new HttpError("Battery level must be from 0 to 100.", 422);

    const db = prisma as any;
    const device = await db.companyGpsDevice.findUnique({ where: { deviceToken: token } });
    if (!device || device.status !== "ACTIVE") throw new HttpError("GPS device token is invalid or inactive.", 401);

    const ping = await db.$transaction(async (tx: any) => {
      const created = await tx.companyGpsPing.create({
        data: {
          deviceId: device.id,
          companyId: device.companyId,
          latitude,
          longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
          speedKph: Number.isFinite(speedKph) ? speedKph : null,
          batteryLevel,
          capturedAt,
        },
      });
      await tx.companyGpsDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: capturedAt,
          lastLatitude: latitude,
          lastLongitude: longitude,
          gpsAccuracy: Number.isFinite(accuracy) ? accuracy : null,
          speedKph: Number.isFinite(speedKph) ? speedKph : null,
          batteryLevel,
        },
      });
      return created;
    });

    if (batteryLevel != null && batteryLevel <= 15) {
      await createNotification({
        companyId: device.companyId,
        targetRole: "COMPANY_ADMIN",
        title: "GPS device battery is low",
        message: `${device.ownerName || device.name} device battery is ${batteryLevel}% at ${capturedAt.toLocaleString("en-TZ")}.`,
        type: "GPS",
        link: "/admin/dashboard?section=gps",
      });
    }

    return NextResponse.json({ success: true, ping, nextUpdateSeconds: 60 });
  } catch (error) {
    return routeError(error);
  }
}
