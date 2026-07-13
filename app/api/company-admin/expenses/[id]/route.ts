import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const expense = await db.companyExpense.findFirst({
      where: { id, companyId },
    });

    if (!expense) throw new HttpError("Expense not found.", 404);

    const status = text(body.status);
    if (!allowedStatuses.includes(status)) {
      throw new HttpError("Invalid expense decision.", 422);
    }

    const updated = await db.companyExpense.update({
      where: { id },
      data: {
        status,
        reviewedById: user.id,
        reviewedByName: user.name,
        reviewNote: text(body.reviewNote).trim() || null,
        reviewedAt: new Date(),
      },
    });

    await createNotification({
      companyId,
      targetUserId: expense.createdById,
      title: `Expense ${status.toLowerCase()}`,
      message: `${user.name} marked your ${text(expense.category)} expense as ${status}.`,
      type: status === "APPROVED" ? "SUCCESS" : "WARNING",
      link: "/dashboard",
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: `EXPENSE_${status}`,
      module: "EXPENSES",
      details: `Expense ${id}: ${text(body.reviewNote) || "No note"}`,
    });

    return NextResponse.json({ success: true, expense: updated });
  } catch (error) {
    return routeError(error);
  }
}
