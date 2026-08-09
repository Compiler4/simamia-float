import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import {
  calendarDateInDar,
  darDate,
  darDateTime,
  resolveRange,
} from "@/lib/accountant/date-range";
import { createNotification } from "@/lib/accountant/notifications";
import { assertCompanyStaff, getCompanyStaff } from "@/lib/accountant/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS = new Set(["PRESENT", "ABSENT", "LATE", "ON_LEAVE", "HOLIDAY"]);

type AttendanceInput = {
  userId?: unknown;
  staffId?: unknown;
  morningStatus?: unknown;
  eveningStatus?: unknown;
  morningTime?: unknown;
  eveningTime?: unknown;
  note?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function status(value: unknown): string | null {
  const result = clean(value).toUpperCase();
  if (!result) return null;
  if (!STATUS.has(result)) throw new Error(`Unsupported attendance status: ${result}.`);
  return result;
}

function overall(morning: string | null, evening: string | null) {
  if (!morning && !evening) return "NOT_MARKED";
  if (!morning || !evening) return "PARTIAL";
  const presentLike = (value: string) => value === "PRESENT" || value === "LATE";
  if (presentLike(morning) && presentLike(evening)) return "PRESENT";
  if (morning === "ABSENT" && evening === "ABSENT") return "ABSENT";
  return "MIXED";
}

function numeric(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export async function GET(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const companyId = String(auth.user.companyId);
    const rawCompanyId = auth.user.companyId;
    const range = resolveRange(request.nextUrl.searchParams);
    const q = clean(request.nextUrl.searchParams.get("q") ?? request.nextUrl.searchParams.get("search"));
    const staff = await getCompanyStaff(rawCompanyId);
    const filteredStaff = q
      ? staff.filter((row) => `${row.name} ${row.username} ${row.email} ${row.assignedRegion}`.toLowerCase().includes(q.toLowerCase()))
      : staff;
    const staffIds = filteredStaff.map((row) => row.id);
    const staffById = new Map(staff.map((row) => [row.id, row]));

    const records = await prisma.accountantAttendance.findMany({
      where: {
        companyId,
        userId: { in: staffIds },
        date: { gte: range.from, lt: range.toExclusive },
      },
      orderBy: [{ date: "desc" }, { userId: "asc" }],
    });

    const mapped = records.map((row: any) => ({
      ...row,
      user: staffById.get(String(row.userId)) ?? null,
    }));

    const totals = {
      records: mapped.length,
      morningPresent: mapped.filter((row: any) => ["PRESENT", "LATE"].includes(String(row.morningStatus))).length,
      morningAbsent: mapped.filter((row: any) => row.morningStatus === "ABSENT").length,
      eveningPresent: mapped.filter((row: any) => ["PRESENT", "LATE"].includes(String(row.eveningStatus))).length,
      eveningAbsent: mapped.filter((row: any) => row.eveningStatus === "ABSENT").length,
      markedSessions: mapped.reduce((sum: number, row: any) => sum + numeric(Boolean(row.morningStatus)) + numeric(Boolean(row.eveningStatus)), 0),
    };

    return NextResponse.json({
      success: true,
      period: {
        name: range.period,
        label: range.label,
        from: range.fromCalendar,
        to: range.toCalendar,
      },
      staff: filteredStaff,
      records: mapped,
      totals,
    });
  } catch (error) {
    console.error("[ACCOUNTANT_STAFF_ATTENDANCE_GET]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Attendance could not load." },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const body = await request.json();
    const companyId = String(auth.user.companyId);
    const rawCompanyId = auth.user.companyId;
    const accountantId = String(auth.user.id);
    const accountantName = String(auth.user.name ?? auth.user.username ?? auth.user.email ?? "Accountant");
    const attendanceDate = clean(body.date);
    const day = darDate(attendanceDate);
    const inputs: AttendanceInput[] = Array.isArray(body.rows) ? body.rows : [body];

    if (!inputs.length) throw new Error("At least one STAFF attendance row is required.");

    const results = [];
    for (const input of inputs) {
      const userId = clean(input.userId ?? input.staffId);
      const staff = await assertCompanyStaff(rawCompanyId, userId);
      const morningStatus = status(input.morningStatus);
      const eveningStatus = status(input.eveningStatus);
      const morningTime = clean(input.morningTime) || "08:00";
      const eveningTime = clean(input.eveningTime) || "17:00";
      const morningEnabled = morningStatus && !["ABSENT", "ON_LEAVE", "HOLIDAY"].includes(morningStatus);
      const eveningEnabled = eveningStatus && !["ABSENT", "ON_LEAVE", "HOLIDAY"].includes(eveningStatus);
      const checkInAt = morningEnabled ? darDateTime(attendanceDate, morningTime) : null;
      const checkOutAt = eveningEnabled ? darDateTime(attendanceDate, eveningTime) : null;
      const notes = clean(input.note) || `Verified by ${accountantName}.`;

      const record = await prisma.accountantAttendance.upsert({
        where: {
          companyId_userId_date: {
            companyId,
            userId,
            date: day,
          },
        },
        update: {
          morningStatus: morningStatus as any,
          eveningStatus: eveningStatus as any,
          morningSource: morningStatus ? "ACCOUNTANT" : null,
          eveningSource: eveningStatus ? "ACCOUNTANT" : null,
          checkInAt,
          checkOutAt,
          notes,
          markedById: accountantId,
          overallStatus: overall(morningStatus, eveningStatus) as any,
        },
        create: {
          companyId,
          userId,
          date: day,
          morningStatus: morningStatus as any,
          eveningStatus: eveningStatus as any,
          morningSource: morningStatus ? "ACCOUNTANT" : null,
          eveningSource: eveningStatus ? "ACCOUNTANT" : null,
          checkInAt,
          checkOutAt,
          notes,
          markedById: accountantId,
          overallStatus: overall(morningStatus, eveningStatus) as any,
        },
      });

      await createNotification(prisma, {
        companyId,
        userId,
        title: "Attendance verified",
        message: `${accountantName} recorded your ${attendanceDate} attendance: morning ${morningStatus ?? "not marked"}, evening ${eveningStatus ?? "not marked"}.`,
        type: morningStatus === "ABSENT" || eveningStatus === "ABSENT" ? "WARNING" : "SUCCESS",
      });

      results.push({ ...record, user: staff });
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} STAFF attendance record${results.length === 1 ? "" : "s"} saved by the accountant.`,
      records: results,
    });
  } catch (error) {
    console.error("[ACCOUNTANT_STAFF_ATTENDANCE_POST]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Attendance could not be saved." },
      { status: 400 },
    );
  }
}
