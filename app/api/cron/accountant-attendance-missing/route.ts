import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { calendarDateInDar, darDate } from "@/lib/accountant/date-range";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

async function run(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ success: false, message: "Unauthorized cron request." }, { status: 401 });

  const date = calendarDateInDar(new Date());
  const day = darDate(date);
  const companies = await prisma.company.findMany({ where: { status: "ACTIVE" } as any, select: { id: true, name: true } } as any);
  const results = [];

  for (const company of companies as any[]) {
    const companyId = String(company.id);
    const staff = await prisma.user.findMany({ where: { companyId: company.id, role: "STAFF", status: "ACTIVE" } as any, select: { id: true, name: true } } as any);
    const records = await prisma.accountantAttendance.findMany({ where: { companyId, date: day, userId: { in: staff.map((row: any) => String(row.id)) } } });
    const recorded = new Set(records.map((row: any) => String(row.userId)));
    const missing = staff.filter((row: any) => !recorded.has(String(row.id)));

    if (missing.length) {
      await createNotification(prisma, {
        companyId,
        roleTarget: "ACCOUNTANT",
        title: "Attendance register is incomplete",
        message: `${missing.length} active STAFF user${missing.length === 1 ? "" : "s"} have no attendance record for ${date}: ${missing.slice(0, 8).map((row: any) => row.name).join(", ")}${missing.length > 8 ? "…" : ""}.`,
        type: "WARNING",
      });
    }
    results.push({ companyId, companyName: company.name, missing: missing.length });
  }

  return NextResponse.json({ success: true, date, results });
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
