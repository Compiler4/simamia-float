import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";
import { getCompanyStaff } from "@/lib/accountant/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) { return String(value ?? "").trim(); }

export async function GET() {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const companyId = String(auth.user.companyId);
    const staff = await getCompanyStaff(auth.user.companyId);
    const staffById = new Map(staff.map((row) => [row.id, row]));
    const rows = await prisma.accountantStaffFunding.findMany({
      where: { companyId, status: { in: ["RETURNED", "VERIFIED", "REJECTED"] } },
      orderBy: [{ returnedAt: "desc" }, { issuedAt: "desc" }],
      take: 500,
    });
    return NextResponse.json({ success: true, rows: rows.map((row: any) => ({ ...row, floatAmount: Number(row.floatAmount), cashAmount: Number(row.cashAmount), totalAmount: Number(row.totalAmount), returnedAmount: Number(row.returnedAmount || 0), staff: staffById.get(String(row.staffId)) ?? null })) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Float returns could not load." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const body = await request.json();
    const fundingId = clean(body.fundingId);
    const decision = clean(body.decision).toUpperCase();
    const reason = clean(body.reason);
    if (!fundingId || !["VERIFIED", "REJECTED"].includes(decision)) throw new Error("Funding and a valid decision are required.");
    if (!reason) throw new Error("Enter a verification or rejection reason.");

    const companyId = String(auth.user.companyId);
    const funding = await prisma.accountantStaffFunding.findFirst({ where: { id: fundingId, companyId, status: "RETURNED" } });
    if (!funding) throw new Error("A pending returned funding record was not found.");

    const updated = await prisma.accountantStaffFunding.update({
      where: { id: funding.id },
      data: {
        status: decision as any,
        returnReason: reason,
        verifiedById: String(auth.user.id),
        verifiedAt: new Date(),
      },
    });

    await createNotification(prisma, {
      companyId,
      userId: funding.staffId,
      title: decision === "VERIFIED" ? "Funding return verified" : "Funding return rejected",
      message: `${funding.referenceNo}: ${reason}`,
      type: decision === "VERIFIED" ? "SUCCESS" : "ERROR",
    });

    return NextResponse.json({ success: true, message: decision === "VERIFIED" ? "The STAFF funding return was verified." : "The STAFF funding return was rejected.", funding: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "The funding return could not be reviewed." }, { status: 400 });
  }
}
