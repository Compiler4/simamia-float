import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  toNumber,
  HttpError,
} from "@/lib/company-admin-server";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const id = text(body.id ?? body.expenseId).trim();
    const db = prisma as any;
    if (!id) throw new HttpError("Expense id is required.", 422);
    const current = await db.companyExpense.findFirst({ where: { id, companyId } });
    if (!current) throw new HttpError("Expense not found.", 404);
    if (current.status !== "PENDING") throw new HttpError("Approved or rejected expenses are changed through the dual approval workflow.", 409);

    const data: Record<string, unknown> = {};
    if (body.category !== undefined) data.category = text(body.category).trim();
    if (body.description !== undefined) data.description = text(body.description).trim();
    if (body.receiptUrl !== undefined) data.receiptUrl = text(body.receiptUrl).trim();
    if (body.amount !== undefined) {
      const amount = toNumber(body.amount);
      if (amount <= 0) throw new HttpError("Expense amount must be above zero.", 422);
      data.amount = amount;
    }

    const expense = await db.companyExpense.update({ where: { id }, data });
    await createAudit({ companyId, actorId: user.id, actorName: user.name, actorRole: user.role, action: "UPDATE_EXPENSE", module: "EXPENSES", details: `Updated expense ${id}.` });
    return NextResponse.json({ success: true, expense });
  } catch (error) {
    return routeError(error);
  }
}
