import { NextResponse } from "next/server";

import { darDayBounds, numberValue } from "@/lib/staff/geo";
import { requireStaffSession } from "@/lib/staff/require-staff";
import {
  editBrokerServiceVisit,
  loadBrokerServiceVisits,
  recordBrokerServiceVisit,
} from "@/lib/staff/service-visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown, maximum = 500): string {
  return String(value ?? "").trim().slice(0, maximum);
}

function booleanValue(value: unknown): boolean {
  return (
    value === true ||
    String(value).toLowerCase() === "true" ||
    String(value) === "1"
  );
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
      if (typeof item === "bigint") return Number(item);
      return item;
    }),
  ) as T;
}

function nestedErrorCode(error: unknown): string {
  const current = error as {
    code?: string;
    cause?: { code?: string; cause?: unknown };
  };

  return String(
    current?.code ||
      current?.cause?.code ||
      (current?.cause as any)?.cause?.code ||
      "",
  );
}

function errorResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "UNKNOWN_ERROR";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Authentication is required."],
    FORBIDDEN: [403, "Staff access is required."],
    STAFF_COMPANY_REQUIRED: [
      403,
      "The Staff account is not connected to a company.",
    ],
    BROKER_NOT_ASSIGNED: [
      403,
      "This broker is outside your assigned work.",
    ],
    INVALID_AMOUNT: [
      400,
      "Float, cash and income values must be valid non-negative amounts.",
    ],
    INVALID_LATITUDE: [400, "The staff latitude is invalid."],
    INVALID_LONGITUDE: [400, "The staff longitude is invalid."],
    INVALID_GPS_COORDINATE: [
      400,
      "The device returned an invalid GPS position. Coordinates 0,0 are rejected.",
    ],
    GPS_ACCURACY_TOO_LOW: [
      409,
      "GPS accuracy is too low. Move outdoors and wait for a more accurate position.",
    ],
    BROKER_TOO_FAR: [
      409,
      "Your device is too far from the broker's verified location.",
    ],
    VISIT_NOT_FOUND: [
      404,
      "The service visit was not found or does not belong to this Staff account.",
    ],
    SERVICE_VISIT_TABLE_MISSING: [
      500,
      "The broker_service_visits table is missing. Run npx prisma db push and npx prisma generate.",
    ],
    SERVICE_VISIT_SAVE_NOT_CONFIRMED: [
      500,
      "The database did not confirm the saved visit. Check the broker_service_visits table and try again.",
    ],
    INVALID_DATE: [
      400,
      "The selected service-visit date is invalid. Refresh the page and try again.",
    ],
  };

  if (message.startsWith("INVALID:")) {
    const field = message.split(":")[1] || "value";
    return NextResponse.json(
      {
        success: false,
        message: `The ${field} value is invalid.`,
        code: message,
      },
      { status: 400 },
    );
  }

  if (known[message]) {
    return NextResponse.json(
      {
        success: false,
        message: known[message][1],
        code: message,
      },
      { status: known[message][0] },
    );
  }

  if (message.startsWith("SERVICE_VISIT_REQUIRED_COLUMNS_MISSING:")) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The broker_service_visits table is incomplete. Synchronise Prisma before saving visits.",
        code: "SERVICE_VISIT_REQUIRED_COLUMNS_MISSING",
        details: message.split(":").slice(1).join(":"),
      },
      { status: 500 },
    );
  }

  const code = nestedErrorCode(error);
  const databaseMessage =
    code === "P2021" || code === "P2022"
      ? "The service-visit database is not synchronized. Run npx prisma db push and npx prisma generate."
      : code === "P2003"
        ? "The visit could not be linked because a required broker or Staff record is missing."
        : code === "P2025"
          ? "The broker or service visit no longer exists. Refresh and try again."
          : code === "P2002"
            ? "A visit for this broker is already being saved. Refresh and try once more."
            : "The broker visit could not be updated.";

  console.error("[STAFF_SERVICE_VISIT_UPDATE_FAILED]", {
    code,
    message,
    error,
  });

  return NextResponse.json(
    {
      success: false,
      message: databaseMessage,
      code: code || "SERVICE_VISIT_UPDATE_FAILED",
      details:
        process.env.NODE_ENV === "development"
          ? message
          : undefined,
    },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession();
    const url = new URL(request.url);
    const startValue = url.searchParams.get("start");
    const endValue = url.searchParams.get("end");

    let start: Date;
    let end: Date;

    if (startValue && endValue) {
      start = new Date(startValue);
      end = new Date(endValue);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start > end
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "The service-visit date range is invalid.",
          },
          { status: 400 },
        );
      }
    } else {
      const requestedDate =
        url.searchParams.get("date") || new Date();
      const bounds = darDayBounds(requestedDate);
      start = bounds.start;
      end = bounds.end;
    }

    const visits = await loadBrokerServiceVisits({
      companyId: session.companyId,
      staffId: session.id,
      start,
      end,
    });

    return NextResponse.json(
      serialise({
        success: true,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        visits,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession();
    const body = await request.json();
    const action = text(
      body.action || "UPDATE_VISIT",
      60,
    ).toUpperCase();

    if (
      ![
        "UPDATE_VISIT",
        "QUICK_LOCATION_UPDATE",
        "QUICK_VISIT_AND_SERVICE",
      ].includes(action)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported service-visit action.",
        },
        { status: 400 },
      );
    }

    const brokerCustomerId = text(
      body.brokerCustomerId,
      191,
    );

    if (!brokerCustomerId) {
      return NextResponse.json(
        {
          success: false,
          message: "Select a broker before updating the visit.",
        },
        { status: 400 },
      );
    }

    const staffLatitude = numberValue(
      body.staffLatitude,
      "latitude",
    );
    const staffLongitude = numberValue(
      body.staffLongitude,
      "longitude",
    );

    if (staffLatitude < -90 || staffLatitude > 90) {
      throw new Error("INVALID_LATITUDE");
    }
    if (staffLongitude < -180 || staffLongitude > 180) {
      throw new Error("INVALID_LONGITUDE");
    }

    const capturedAt = body.capturedAt
      ? new Date(String(body.capturedAt))
      : new Date();

    if (Number.isNaN(capturedAt.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "The service time is invalid.",
        },
        { status: 400 },
      );
    }

    const isQuickService =
      action === "QUICK_VISIT_AND_SERVICE";
    const isLocationOnly =
      action === "QUICK_LOCATION_UPDATE";

    const result = await recordBrokerServiceVisit({
      companyId: session.companyId,
      staffId: session.id,
      staffName: session.name,
      brokerCustomerId,
      deviceId: text(body.deviceId, 191) || null,
      serviceType: isLocationOnly
        ? "GPS_VISIT_UPDATE"
        : isQuickService
          ? "BROKER_VISIT_SERVICE"
          : text(
              body.serviceType || "FLOAT_AND_CASH_SERVICE",
              120,
            ),
      floatAmount:
        isLocationOnly || isQuickService
          ? 0
          : Number(body.floatAmount ?? 0),
      cashAmount:
        isLocationOnly || isQuickService
          ? 0
          : Number(body.cashAmount ?? 0),
      companyIncome:
        isLocationOnly || isQuickService
          ? 0
          : Number(body.companyIncome ?? 0),
      staffLatitude,
      staffLongitude,
      accuracy: optionalNumber(body.accuracy),
      capturedAt,
      locationName:
        text(body.locationName, 255) || null,
      proofUrl: text(body.proofUrl, 500) || null,
      notes: text(body.notes, 2000) || null,
      updateRegisteredLocation: isQuickService
        ? true
        : booleanValue(body.updateRegisteredLocation),
      markServiced: isQuickService,
    });

    return NextResponse.json(
      serialise({
        success: true,
        message: isQuickService
          ? "The broker was marked visited and serviced. The captured GPS position and today's service visit were saved."
          : isLocationOnly
            ? "Broker arrival and database location were updated."
            : "Broker service visit and location were saved.",
        visit: result.visit,
        broker: result.broker,
        warnings: result.warnings,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireStaffSession();
    const body = await request.json();
    const visitId = text(body.visitId, 191);

    if (!visitId) {
      return NextResponse.json(
        {
          success: false,
          message: "A service visit ID is required.",
        },
        { status: 400 },
      );
    }

    const visit = await editBrokerServiceVisit({
      companyId: session.companyId,
      staffId: session.id,
      staffName: session.name,
      visitId,
      serviceType: text(
        body.serviceType || "BROKER_VISIT_SERVICE",
        120,
      ),
      floatAmount: Number(body.floatAmount ?? 0),
      cashAmount: Number(body.cashAmount ?? 0),
      companyIncome: Number(body.companyIncome ?? 0),
      status: text(
        body.status || "SERVICE_RECORDED",
        60,
      ),
      locationName:
        text(body.locationName, 255) || null,
      notes: text(body.notes, 2000) || null,
    });

    return NextResponse.json(
      serialise({
        success: true,
        message:
          "The service visit and linked service activity were updated.",
        visit,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
