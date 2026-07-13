import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { routeError, text, toNumber, HttpError } from "@/lib/company-admin-server";

export async function POST(request: NextRequest) {
  try {
    const token =
      request.headers.get("x-device-token") ||
      text((await request.clone().json().catch(() => ({})))?.deviceToken);

    if (!token) throw new HttpError("Device token is required.", 401);

    const body = await request.json();
    const latitude = toNumber(body.latitude);
    const longitude = toNumber(body.longitude);
    const db = prisma as any;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new HttpError("Valid latitude and longitude are required.", 422);
    }

    const device = await db.companyGpsDevice.findUnique({
      where: { deviceToken: token },
    });

    if (!device || device.status !== "ACTIVE") {
      throw new HttpError("Device token is invalid or inactive.", 403);
    }

    const capturedAt = body.capturedAt
      ? new Date(body.capturedAt)
      : new Date();
    const accuracy =
      body.accuracy === null || body.accuracy === undefined
        ? null
        : toNumber(body.accuracy);
    const speedKph =
      body.speedKph === null || body.speedKph === undefined
        ? null
        : toNumber(body.speedKph);
    const batteryLevel =
      body.batteryLevel === null || body.batteryLevel === undefined
        ? null
        : Math.max(0, Math.min(100, Math.round(toNumber(body.batteryLevel))));

    const [ping] = await db.$transaction([
      db.companyGpsPing.create({
        data: {
          deviceId: device.id,
          companyId: device.companyId,
          latitude,
          longitude,
          accuracy,
          speedKph,
          batteryLevel,
          capturedAt,
        },
      }),
      db.companyGpsDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: capturedAt,
          lastLatitude: latitude,
          lastLongitude: longitude,
          gpsAccuracy: accuracy,
          speedKph,
          batteryLevel,
        },
      }),
    ]);

    return NextResponse.json({ success: true, ping });
  } catch (error) {
    return routeError(error);
  }
}
