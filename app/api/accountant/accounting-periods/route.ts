import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) { return String(value ?? "").trim(); }
function validDate(value: unknown, label: string) { const result = new Date(clean(value)); if (Number.isNaN(result.getTime())) throw new Error(`${label} is invalid.`); return result; }

export async function GET() {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const companyId = String(auth.user.companyId);
    const [periods, requests] = await Promise.all([
      prisma.accountantPeriod.findMany({ where: { companyId }, include: { reopenRequests: { orderBy: { createdAt: "desc" } } }, orderBy: { startDate: "desc" }, take: 200 }),
      prisma.accountantPeriodReopenRequest.findMany({ where: { companyId, requestedById: String(auth.user.id) }, include: { period: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    return NextResponse.json({ success: true, periods, requests });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Accounting periods could not load." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const action = clean(body.action).toUpperCase();
    const companyId = String(auth.user.companyId);
    const actorId = String(auth.user.id);

    if (action === "CREATE_PERIOD") {
      const label = clean(body.label);
      if (!label) throw new Error("Period label is required.");
      const startDate = validDate(body.startDate, "Start date");
      const endDate = validDate(body.endDate, "End date");
      if (endDate < startDate) throw new Error("End date must be after the start date.");
      const period = await prisma.accountantPeriod.create({ data: { companyId, label, periodType: clean(body.periodType) || "MONTH", startDate, endDate, status: "OPEN" } });
      return NextResponse.json({ success: true, message: "Accounting period created.", period }, { status: 201 });
    }

    if (action === "LOCK_PERIOD") {
      const periodId = clean(body.periodId);
      const reason = clean(body.reason);
      if (!periodId || !reason) throw new Error("Period and lock reason are required.");
      const result = await prisma.accountantPeriod.updateMany({ where: { id: periodId, companyId, status: "OPEN" }, data: { status: "LOCKED", reason, lockedById: actorId, lockedAt: new Date() } });
      if (!result.count) throw new Error("An open accounting period was not found.");
      return NextResponse.json({ success: true, message: "Accounting period locked." });
    }

    if (action === "REQUEST_REOPEN") {
      const periodId = clean(body.periodId);
      const reason = clean(body.reason);
      if (!periodId || !reason) throw new Error("Period and reopen reason are required.");
      const period = await prisma.accountantPeriod.findFirst({ where: { id: periodId, companyId, status: { in: ["CLOSED", "LOCKED"] } } });
      if (!period) throw new Error("A locked or closed accounting period was not found.");
      const existing = await prisma.accountantPeriodReopenRequest.findFirst({ where: { periodId, companyId, status: "PENDING" } });
      if (existing) throw new Error("A reopen request is already pending for this period.");
      const reopenRequest = await prisma.accountantPeriodReopenRequest.create({ data: { companyId, periodId, requestedById: actorId, reason, status: "PENDING" } });
      await createNotification(prisma, { companyId, roleTarget: "COMPANY_ADMIN", title: "Accounting period reopen requested", message: `${String(auth.user.name ?? auth.user.username ?? "Accountant")} requested reopening ${period.label}: ${reason}`, type: "WARNING" });
      return NextResponse.json({ success: true, message: "Reopen request sent to the Company Admin.", request: reopenRequest });
    }

    throw new Error(`Unsupported accounting-period action: ${action}.`);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Accounting-period action failed." }, { status: 400 });
  }
}
