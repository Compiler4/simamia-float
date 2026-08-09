import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) { return String(value ?? "").trim(); }

export async function GET() {
  const auth = await requirePortalRole(["COMPANY_ADMIN"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const rows = await prisma.accountantPeriodReopenRequest.findMany({
      where: { companyId: String(auth.user.companyId) },
      include: { period: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Reopen requests could not load." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["COMPANY_ADMIN"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const requestId = clean(body.requestId);
    const decision = clean(body.decision).toUpperCase();
    const reviewNote = clean(body.reviewNote);
    if (!requestId || !["APPROVED", "REJECTED"].includes(decision)) throw new Error("Request and a valid decision are required.");
    if (!reviewNote) throw new Error("Enter a Company Admin review note.");
    const companyId = String(auth.user.companyId);

    const reopenRequest = await prisma.accountantPeriodReopenRequest.findFirst({ where: { id: requestId, companyId, status: "PENDING" }, include: { period: true } });
    if (!reopenRequest) throw new Error("Pending reopen request not found.");

    await prisma.$transaction(async (tx: any) => {
      await tx.accountantPeriodReopenRequest.update({ where: { id: reopenRequest.id }, data: { status: decision, reviewNote, reviewedById: String(auth.user!.id), reviewedAt: new Date() } });
      if (decision === "APPROVED") await tx.accountantPeriod.update({ where: { id: reopenRequest.periodId }, data: { status: "OPEN", reason: `Reopened by Company Admin: ${reviewNote}`, lockedById: null, lockedAt: null } });
      await createNotification(tx, { companyId, userId: reopenRequest.requestedById, title: decision === "APPROVED" ? "Accounting period reopened" : "Reopen request rejected", message: `${reopenRequest.period.label}: ${reviewNote}`, type: decision === "APPROVED" ? "SUCCESS" : "ERROR" });
    });

    return NextResponse.json({ success: true, message: decision === "APPROVED" ? "Accounting period reopened." : "Reopen request rejected." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "The reopen request could not be reviewed." }, { status: 400 });
  }
}
