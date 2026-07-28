import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { asPortalError, PortalHttpError, requirePortalRole } from "@/lib/accountant-control/auth";
import { notifyUser } from "@/lib/accountant-control/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown) => String(value ?? "").trim();

export async function GET() {
  try {
    const staff = await requirePortalRole(["STAFF"]);
    const expenses = await (prisma as any).expense.findMany({
      where: { companyId: staff.companyId, employeeId: staff.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return NextResponse.json({ success: true, expenses });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requirePortalRole(["STAFF"]);
    const body = await request.json();
    const amount = Number(body.amount);
    const category = text(body.category);
    const description = text(body.description);
    if (!category || !description || !Number.isFinite(amount) || amount <= 0) {
      throw new PortalHttpError("Category, description and a valid amount are required.", 400);
    }

    const db = prisma as any;
    const expense = await db.expense.create({
      data: {
        companyId: staff.companyId,
        employeeId: staff.id,
        createdById: staff.id,
        category,
        description,
        requestedAction: text(body.requestedAction) || null,
        requestMode: text(body.requestMode) || "STAFF_REQUEST",
        amount: amount.toFixed(2),
        expenseDate: body.expenseDate ? new Date(String(body.expenseDate)) : new Date(),
        receiptUrl: text(body.receiptUrl) || null,
        status: "PENDING",
      },
    });

    const reviewers = await db.user.findMany({
      where: { companyId: staff.companyId, role: { in: ["ACCOUNTANT", "COMPANY_ADMIN"] }, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(reviewers.map((reviewer: any) => notifyUser(db, {
      companyId: staff.companyId,
      userId: String(reviewer.id),
      title: "New staff expense request",
      message: `${staff.name} requested TZS ${amount.toLocaleString("en-TZ")} for ${category}.`,
      type: "INFO",
    })));

    return NextResponse.json({ success: true, message: "Expense request submitted for Accountant and Company Admin review.", expense }, { status: 201 });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
