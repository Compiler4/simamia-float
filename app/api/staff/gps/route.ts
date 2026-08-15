import { NextResponse } from "next/server";

import { getStaffGpsSchedule } from "@/lib/staff/gps-schedule";
import { requireStaffSession } from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    console.error("[STAFF_GPS_SCHEDULE]", error);
    return NextResponse.json(
      {
        success: false,
        message: "The Staff GPS schedule could not be loaded.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
