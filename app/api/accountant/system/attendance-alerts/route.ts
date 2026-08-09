import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureAttendanceMissingNotifications } from "@/lib/accountant/accounting";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  const companies = await (db as any).company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const results = [];
  for (const company of companies) {
    const result = await ensureAttendanceMissingNotifications(company.id, new Date());
    results.push({ companyId: company.id, companyName: company.name, missing: result.missing });
  }

  return NextResponse.json({ success: true, results });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
