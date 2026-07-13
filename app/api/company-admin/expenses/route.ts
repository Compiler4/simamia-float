import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  normalizeDate,
  requireCompanyMember,
  routeError,
  text,
  toNumber,
  HttpError,
} from "@/lib/company-admin-server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyMember([
      "COMPANY_ADMIN",
      "ACCOUNTANT",
      "STAFF",
      "BROKER",
    ]);
    const companyId = user.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const category = text(body.category).trim();
    const amount = toNumber(body.amount);
    const expenseDate = normalizeDate(body.expenseDate || new Date());

    if (!category || amount <= 0) {
      throw new HttpError("Category and an amount above zero are required.", 422);
    }

    const expense = await db.companyExpense.create({
      data: {
        companyId,
        createdById: user.id,
        createdByName: user.name,
        createdByRole: user.role,
        category,
        amount,
        description: text(body.description).trim() || null,
        expenseDate,
        receiptUrl: text(body.receiptUrl).trim() || null,
        status: user.role === "COMPANY_ADMIN" && body.autoApprove
          ? "APPROVED"
          : "PENDING",
        reviewedById:
          user.role === "COMPANY_ADMIN" && body.autoApprove ? user.id : null,
        reviewedByName:
          user.role === "COMPANY_ADMIN" && body.autoApprove ? user.name : null,
        reviewedAt:
          user.role === "COMPANY_ADMIN" && body.autoApprove ? new Date() : null,
      },
    });

    await createNotification({
      companyId,
      targetRole: "COMPANY_ADMIN",
      title: "New expense submitted",
      message: `${user.name} submitted ${category} expense of TZS ${amount.toLocaleString()}.`,
      type: "EXPENSE",
      link: "/admin/dashboard?section=expenses",
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "CREATE_EXPENSE",
      module: "EXPENSES",
      details: `${category} - TZS ${amount}.`,
    });

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    return routeError(error);
  }
}
