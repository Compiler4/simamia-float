import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  formattedDatabaseAddress,
  geocodeTanzaniaAddress,
} from "@/lib/staff/geocode-broker";
import { requireVisibleBrokerCustomer } from "@/lib/staff/broker-scope";
import { requireStaffSession } from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown, maximum = 255): string {
  return String(value ?? "").trim().slice(0, maximum);
}

function serialise<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (
        item &&
        typeof item === "object" &&
        typeof item.toNumber === "function"
      ) {
        return item.toNumber();
      }
      return item;
    }),
  ) as T;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Authentication is required."],
    FORBIDDEN: [403, "Staff access is required."],
    STAFF_COMPANY_REQUIRED: [403, "The Staff account is not connected to a company."],
    BROKER_NOT_ASSIGNED: [403, "This broker is outside your assigned work."],
    BROKER_DIRECT_ASSIGNMENT_REQUIRED: [
      403,
      "The broker must be directly assigned to you before its registered location can be updated.",
    ],
  };

  if (known[message]) {
    return NextResponse.json(
      { success: false, message: known[message][1] },
      { status: known[message][0] },
    );
  }

  console.error("[STAFF_BROKER_GEOCODE]", error);
  return NextResponse.json(
    {
      success: false,
      message:
        message.startsWith("GEOCODER_HTTP_")
          ? "The address-location service is temporarily unavailable. Try again later."
          : "The broker address could not be converted into map coordinates.",
      details: process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession();
    const body = await request.json();
    const brokerCustomerId = text(body.brokerCustomerId, 191);

    if (!brokerCustomerId) {
      return NextResponse.json(
        { success: false, message: "Select a broker before resolving the address." },
        { status: 400 },
      );
    }

    const broker = await requireVisibleBrokerCustomer(
      session.companyId,
      session.id,
      brokerCustomerId,
    );

    const result = await geocodeTanzaniaAddress(broker);
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No map result matched the registered address. Add a street, ward, district and region, or capture the location while physically visiting the broker.",
          registeredAddress: formattedDatabaseAddress(broker),
        },
        { status: 404 },
      );
    }

    const database = db as any;
    const saved = await database.brokerCustomer.update({
      where: { id: brokerCustomerId },
      data: {
        latitude: result.latitude,
        longitude: result.longitude,
        attendedLocation: result.displayName,
      },
    });

    await database.auditLog.create({
      data: {
        companyId: session.companyId,
        userId: session.id,
        action: "GEOCODE_BROKER_ADDRESS",
        module: "GPS_TRACKING",
        details: JSON.stringify({
          brokerCustomerId,
          query: result.query,
          precision: result.precision,
          latitude: result.latitude,
          longitude: result.longitude,
          displayName: result.displayName,
        }),
      },
    }).catch(() => null);

    return NextResponse.json(
      serialise({
        success: true,
        message:
          result.precision === "STREET"
            ? "The broker street address was resolved and its pointer is now visible."
            : `The broker was placed at ${result.precision.toLowerCase()} level. Visit the broker and click Update now to save an exact GPS point.`,
        broker: saved,
        location: result,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
