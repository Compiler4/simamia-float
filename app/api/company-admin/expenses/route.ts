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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;
    const current = await db.companyExpense.findFirst({ where: { id, companyId } });
    if (!current) throw new HttpError("Expense not found.", 404);

    const requestedStatus = text(body.status).trim().toUpperCase();
    if (requestedStatus) {
      if (!["APPROVED", "REJECTED"].includes(requestedStatus)) {
        throw new HttpError("Expense decision must be APPROVED or REJECTED.", 422);
      }

      const expense = await db.companyExpense.update({
        where: { id },
        data: {
          status: requestedStatus,
          reviewNote: text(body.reviewNote).trim() || null,
          reviewedById: user.id,
          reviewedByName: user.name,
          reviewedAt: new Date(),
        },
      });

      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: `${requestedStatus}_EXPENSE`,
        module: "EXPENSES",
        details: `${requestedStatus.toLowerCase()} expense ${id}.`,
      });

      return NextResponse.json({ success: true, expense });
    }

    if (current.status !== "PENDING") throw new HttpError("Only pending expenses can be edited.", 409);

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
