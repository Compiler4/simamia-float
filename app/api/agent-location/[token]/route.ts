import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { hashLocationToken } from "@/lib/security/location-token";
import { usableAccuracy, usableCoordinatePair } from "@/lib/staff/location-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveDevice(token: string) {
  const tokenHash = hashLocationToken(token);
  return (db as any).brokerAgentLocationDevice.findUnique({
    where: { tokenHash },
    include: {
      broker: {
        select: {
          id: true,
          name: true,
          businessName: true,
          code: true,
          location: true,
          region: true,
          district: true,
          ward: true,
          address: true,
        },
      },
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const device = await resolveDevice(token);

    if (!device || device.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "This location-sharing link is invalid or has been replaced." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      broker: device.broker,
      lastSeenAt: device.lastSeenAt,
      lastAccuracy: device.lastAccuracy,
    });
  } catch (error) {
    console.error("[AGENT_LOCATION_GET]", error);
    return NextResponse.json(
      { success: false, message: "The location-sharing page could not load." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const device = await resolveDevice(token);

    if (!device || device.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "This location-sharing link is invalid or has been replaced." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = usableAccuracy(body.accuracy);
    const heading = numberOrNull(body.heading);
    const speedMps = numberOrNull(body.speed);
    const capturedAt = body.capturedAt ? new Date(String(body.capturedAt)) : new Date();

    if (!usableCoordinatePair(latitude, longitude)) {
      return NextResponse.json(
        { success: false, message: "The phone returned an invalid location. Coordinates 0,0 are rejected." },
        { status: 400 },
      );
    }

    if (Number.isNaN(capturedAt.getTime())) {
      return NextResponse.json(
        { success: false, message: "The GPS capture time is invalid." },
        { status: 400 },
      );
    }

    const maximumAccuracy = Math.max(
      10,
      Number(process.env.AGENT_GPS_MAX_ACCURACY_METERS || 150),
    );

    if (accuracy != null && accuracy > maximumAccuracy) {
      return NextResponse.json(
        {
          success: false,
          message: `GPS accuracy is ${Math.round(accuracy)} metres. Move outdoors and wait until accuracy is ${maximumAccuracy} metres or better.`,
        },
        { status: 409 },
      );
    }

    const speedKph = speedMps == null ? null : Math.max(0, speedMps * 3.6);
    const database = db as any;

    await database.$transaction(async (transaction: any) => {
      await transaction.brokerAgentLocationDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: capturedAt,
          lastLatitude: latitude,
          lastLongitude: longitude,
          lastAccuracy: accuracy,
          lastHeading: heading,
          lastSpeedKph: speedKph,
        },
      });

      await transaction.brokerAgentLocationPing.create({
        data: {
          deviceId: device.id,
          companyId: device.companyId,
          brokerCustomerId: device.brokerCustomerId,
          latitude,
          longitude,
          accuracy,
          heading,
          speedKph,
          capturedAt,
        },
      });

      // Keep the registered agent's latest exact device position available to
      // every permitted staff map. This does not mark a staff service visit.
      await transaction.brokerCustomer.update({
        where: { id: device.brokerCustomerId },
        data: { latitude, longitude },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Live location shared successfully.",
      capturedAt: capturedAt.toISOString(),
      accuracy,
    });
  } catch (error) {
    console.error("[AGENT_LOCATION_POST]", error);
    return NextResponse.json(
      {
        success: false,
        message: "The live location could not be saved.",
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
