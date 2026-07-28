import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";
import { assertCompanyStaff, getCompanyStaff } from "@/lib/accountant/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function amount(value: unknown) {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result) || result < 0) throw new Error("Funding amounts must be valid positive numbers.");
  return result;
}

function reference(value: unknown) {
  const supplied = clean(value).toUpperCase().replace(/[^A-Z0-9/_-]+/g, "-").slice(0, 140);
  return supplied || `A2S-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function GET() {
  const auth = await requirePortalRole(["ACCOUNTANT"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const companyId = String(auth.user.companyId);
    const staff = await getCompanyStaff(auth.user.companyId);
    const staffById = new Map(staff.map((row) => [row.id, row]));
    const transactions = await prisma.accountantStaffFunding.findMany({
      where: { companyId },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    return NextResponse.json({
      success: true,
      staff,
      transactions: transactions.map((row: any) => ({
        ...row,
        floatAmount: Number(row.floatAmount),
        cashAmount: Number(row.cashAmount),
        totalAmount: Number(row.totalAmount),
        returnedAmount: row.returnedAmount == null ? null : Number(row.returnedAmount),
        toUser: staffById.get(String(row.staffId)) ?? null,
      })),
    });
  } catch (error) {
    console.error("[ACCOUNTANT_STAFF_FLOAT_GET]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "STAFF funding could not load." },
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
    const staffId = clean(body.staffId ?? body.staffUserId);
    const staff = await assertCompanyStaff(auth.user.companyId, staffId);
    const floatAmount = amount(body.floatAmount ?? body.amount);
    const cashAmount = amount(body.cashAmount);
    const totalAmount = floatAmount + cashAmount;
    if (totalAmount <= 0) throw new Error("Enter a float or cash amount greater than zero.");

    let referenceNo = reference(body.referenceNo);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const exists = await prisma.accountantStaffFunding.findFirst({ where: { companyId, referenceNo }, select: { id: true } });
      if (!exists) break;
      referenceNo = reference("");
    }

    const transaction = await prisma.accountantStaffFunding.create({
      data: {
        companyId,
        staffId,
        issuedById: String(auth.user.id),
        floatAmount,
        cashAmount,
        totalAmount,
        referenceNo,
        purpose: clean(body.purpose) || "Daily field operations",
        note: clean(body.notes ?? body.note) || null,
        status: "ISSUED",
        issuedAt: body.issueDate ? new Date(`${clean(body.issueDate)}T09:00:00+03:00`) : new Date(),
      },
    });

    const actor = String(auth.user.name ?? auth.user.username ?? auth.user.email ?? "Accountant");
    await createNotification(prisma, {
      companyId,
      userId: staff.id,
      title: "Float and cash issued",
      message: `${actor} issued TZS ${totalAmount.toLocaleString("en-TZ")} to you: float TZS ${floatAmount.toLocaleString("en-TZ")}, cash TZS ${cashAmount.toLocaleString("en-TZ")}. Reference: ${referenceNo}.`,
      type: "INFO",
    });

    return NextResponse.json(
      {
        success: true,
        message: `TZS ${totalAmount.toLocaleString("en-TZ")} was issued to ${staff.name}. Reference: ${referenceNo}.`,
        transaction,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ACCOUNTANT_STAFF_FLOAT_POST]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "STAFF funding could not be issued." },
      { status: 400 },
    );
  }
}
