import "server-only";

import { prisma } from "@/lib/prisma";

import { notifyUser } from "./notifications";

export async function recalculateExpenseDecision(input: {
  companyId: string;
  expenseId: string;
}) {
  const db = prisma as any;
  const decisions = await db.accountantExpenseDecision.findMany({
    where: {
      companyId: input.companyId,
      expenseId: input.expenseId,
    },
  });

  const accountant = decisions.find((item: any) => item.actorRole === "ACCOUNTANT");
  const admin = decisions.find((item: any) => item.actorRole === "COMPANY_ADMIN");

  let finalStatus = "PENDING";
  if (decisions.some((item: any) => item.decision === "REJECT")) {
    finalStatus = "REJECTED";
  } else if (accountant?.decision === "APPROVE" && admin?.decision === "APPROVE") {
    finalStatus = "APPROVED";
  }

  const expense = await db.expense.findFirst({
    where: { id: input.expenseId, companyId: input.companyId },
  });

  if (expense) {
    const data: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(expense, "status")) {
      data.status = finalStatus;
    } else if (Object.prototype.hasOwnProperty.call(expense, "approvalStatus")) {
      data.approvalStatus = finalStatus;
    }

    const reasons = decisions
      .map((item: any) => String(item.reason ?? "").trim())
      .filter(Boolean)
      .join(" | ");
    if (reasons && Object.prototype.hasOwnProperty.call(expense, "reviewNote")) {
      data.reviewNote = reasons;
    }

    if (Object.keys(data).length) {
      await db.expense.update({ where: { id: input.expenseId }, data });
    }

    const staffId = String(
      expense.employeeId ?? expense.staffId ?? expense.requestedById ?? expense.userId ?? "",
    );
    if (staffId && finalStatus !== "PENDING") {
      await notifyUser({
        companyId: input.companyId,
        userId: staffId,
        title: `Expense ${finalStatus.toLowerCase()}`,
        message:
          finalStatus === "APPROVED"
            ? "Your expense was approved by both the Company Admin and Accountant."
            : "Your expense was rejected because at least one required approver rejected it.",
        type: finalStatus === "APPROVED" ? "SUCCESS" : "ERROR",
      });
    }
  }

  return { finalStatus, accountant, admin, decisions };
}
