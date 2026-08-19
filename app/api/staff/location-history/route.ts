import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAR_OFFSET = "+03:00";

type CalendarParts = { year: number; month: number; day: number };

type PeriodRange = {
  name: string;
  label: string;
  start: Date;
  end: Date;
};

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseCalendarDate(value: string): CalendarParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const test = new Date(Date.UTC(year, month - 1, day));
  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() !== month - 1 ||
    test.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function calendarText(parts: CalendarParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function shiftCalendar(parts: CalendarParts, days: number): CalendarParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function localStart(parts: CalendarParts): Date {
  return new Date(`${calendarText(parts)}T00:00:00.000${DAR_OFFSET}`);
}

function localEnd(parts: CalendarParts): Date {
  return new Date(`${calendarText(parts)}T23:59:59.999${DAR_OFFSET}`);
}

function todayDar(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date());
}

function labelDate(parts: CalendarParts): string {
  return new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(localStart(parts));
}

function resolveRange(request: NextRequest): PeriodRange {
  const period = clean(request.nextUrl.searchParams.get("period") || "DAY").toUpperCase();
  const anchorText = clean(request.nextUrl.searchParams.get("anchor") || todayDar());
  const anchor = parseCalendarDate(anchorText) ?? parseCalendarDate(todayDar())!;

  if (period === "CUSTOM") {
    const from = parseCalendarDate(clean(request.nextUrl.searchParams.get("from"))) ?? anchor;
    const to = parseCalendarDate(clean(request.nextUrl.searchParams.get("to"))) ?? anchor;
    const first = localStart(from) <= localStart(to) ? from : to;
    const last = localStart(from) <= localStart(to) ? to : from;
    return {
      name: "CUSTOM",
      label: `${labelDate(first)} – ${labelDate(last)}`,
      start: localStart(first),
      end: localEnd(last),
    };
  }

  if (period === "WEEK") {
    const abstract = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day));
    const weekday = abstract.getUTCDay(); // 0 Sunday ... 6 Saturday
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const startParts = shiftCalendar(anchor, mondayOffset);
    const endParts = shiftCalendar(startParts, 6);
    return {
      name: "WEEK",
      label: `${labelDate(startParts)} – ${labelDate(endParts)}`,
      start: localStart(startParts),
      end: localEnd(endParts),
    };
  }

  if (period === "MONTH") {
    const startParts = { year: anchor.year, month: anchor.month, day: 1 };
    const nextMonth = new Date(Date.UTC(anchor.year, anchor.month, 1));
    const endParts = shiftCalendar(
      { year: nextMonth.getUTCFullYear(), month: nextMonth.getUTCMonth() + 1, day: 1 },
      -1,
    );
    return {
      name: "MONTH",
      label: new Intl.DateTimeFormat("en-TZ", {
        month: "long",
        year: "numeric",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(localStart(startParts)),
      start: localStart(startParts),
      end: localEnd(endParts),
    };
  }

  if (period === "YEAR") {
    const startParts = { year: anchor.year, month: 1, day: 1 };
    const endParts = { year: anchor.year, month: 12, day: 31 };
    return {
      name: "YEAR",
      label: String(anchor.year),
      start: localStart(startParts),
      end: localEnd(endParts),
    };
  }

  return {
    name: "DAY",
    label: labelDate(anchor),
    start: localStart(anchor),
    end: localEnd(anchor),
  };
}

function usable(latitude: unknown, longitude: unknown): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const earth = 6_371_000;
  const rad = (value: number) => (value * Math.PI) / 180;
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const deltaLat = rad(b.latitude - a.latitude);
  const deltaLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function serialise<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === "object" && typeof item.toNumber === "function") {
        return item.toNumber();
      }
      return item;
    }),
  ) as T;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireStaffSession();
    const range = resolveRange(request);
    const db = prisma as any;

    const devices = await db.companyGpsDevice.findMany({
      where: {
        companyId: String(session.companyId),
        ownerUserId: String(session.id),
      },
      select: {
        id: true,
        name: true,
        status: true,
        lastSeenAt: true,
        lastLatitude: true,
        lastLongitude: true,
        gpsAccuracy: true,
        speedKph: true,
        pings: {
          where: { capturedAt: { gte: range.start, lte: range.end } },
          orderBy: { capturedAt: "asc" },
          take: 10000,
          select: {
            id: true,
            latitude: true,
            longitude: true,
            accuracy: true,
            speedKph: true,
            batteryLevel: true,
            capturedAt: true,
          },
        },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const history = devices
      .flatMap((device: any) =>
        (Array.isArray(device.pings) ? device.pings : []).map((ping: any) => ({
          ...ping,
          deviceId: device.id,
          deviceName: device.name,
        })),
      )
      .filter((ping: any) => usable(ping.latitude, ping.longitude))
      .sort(
        (a: any, b: any) =>
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
      );

    let distance = 0;
    for (let index = 1; index < history.length; index += 1) {
      distance += distanceMetres(
        { latitude: Number(history[index - 1].latitude), longitude: Number(history[index - 1].longitude) },
        { latitude: Number(history[index].latitude), longitude: Number(history[index].longitude) },
      );
    }

    const speedSamples = history
      .map((ping: any) => Number(ping.speedKph ?? 0))
      .filter((value: number) => Number.isFinite(value) && value >= 0);

    const latestDevice = devices.find((device: any) => usable(device.lastLatitude, device.lastLongitude));
    const latestPing = history.at(-1) ?? null;
    const current = latestDevice
      ? {
          id: `current-${latestDevice.id}`,
          deviceId: latestDevice.id,
          deviceName: latestDevice.name,
          latitude: Number(latestDevice.lastLatitude),
          longitude: Number(latestDevice.lastLongitude),
          accuracy: latestDevice.gpsAccuracy,
          speedKph: latestDevice.speedKph,
          capturedAt: latestDevice.lastSeenAt,
        }
      : latestPing;

    return NextResponse.json(
      serialise({
        success: true,
        period: {
          name: range.name,
          label: range.label,
          start: range.start,
          end: range.end,
        },
        staff: {
          id: String(session.id),
          name: session.name,
          email: session.email,
          companyId: String(session.companyId),
        },
        devices: devices.map((device: any) => ({
          id: device.id,
          name: device.name,
          status: device.status,
          lastSeenAt: device.lastSeenAt,
          lastLatitude: device.lastLatitude,
          lastLongitude: device.lastLongitude,
          gpsAccuracy: device.gpsAccuracy,
          speedKph: device.speedKph,
        })),
        current,
        history,
        summary: {
          gpsPoints: history.length,
          distanceMetres: distance,
          distanceKm: Number((distance / 1000).toFixed(3)),
          averageSpeedKph: speedSamples.length
            ? Number((speedSamples.reduce((sum: number, value: number) => sum + value, 0) / speedSamples.length).toFixed(1))
            : 0,
          maxSpeedKph: speedSamples.length ? Math.max(...speedSamples) : 0,
          firstCapturedAt: history[0]?.capturedAt ?? null,
          lastCapturedAt: history.at(-1)?.capturedAt ?? latestDevice?.lastSeenAt ?? null,
        },
      }),
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
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

    console.error("[STAFF_LOCATION_HISTORY]", error);

    return NextResponse.json(
      {
        success: false,
        message:
          status === 401
            ? "Please sign in again."
            : status === 403
              ? "Staff access is required."
              : code === "P2021" || code === "P2022"
                ? "The GPS history database is not synchronized."
                : "Real Staff GPS travel history could not be loaded.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status },
    );
  }
}
