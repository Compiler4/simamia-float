import { prisma } from "@/lib/prisma";
import { createNotification } from "./notifications";

export async function decideExpense(input: {
  companyId: string;
  expenseId: string;
  reviewerId: string;
  reviewerRole: "ACCOUNTANT" | "COMPANY_ADMIN";
  decision: "APPROVED" | "REJECTED";
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("A decision reason is required.");

  return prisma.$transaction(async (tx: any) => {
    const expense = await tx.accountantExpenseRequest.findFirst({
      where: { id: input.expenseId, companyId: input.companyId },
      include: { decisions: true },
    });
    if (!expense) throw new Error("Expense request was not found.");

    await tx.accountantExpenseDecision.upsert({
      where: {
        expenseId_reviewerRole: {
          expenseId: expense.id,
          reviewerRole: input.reviewerRole,
        },
      },
      update: {
        reviewerId: input.reviewerId,
        decision: input.decision,
        reason: input.reason.trim(),
        decidedAt: new Date(),
      },
      create: {
        expenseId: expense.id,
        reviewerId: input.reviewerId,
        reviewerRole: input.reviewerRole,
        decision: input.decision,
        reason: input.reason.trim(),
      },
    });

    const decisions = await tx.accountantExpenseDecision.findMany({
      where: { expenseId: expense.id },
    });
    const byRole = new Map(decisions.map((row: any) => [row.reviewerRole, row.decision]));

    let finalStatus: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";
    if (decisions.some((row: any) => row.decision === "REJECTED")) {
      finalStatus = "REJECTED";
    } else if (
      byRole.get("ACCOUNTANT") === "APPROVED" &&
      byRole.get("COMPANY_ADMIN") === "APPROVED"
    ) {
      finalStatus = "APPROVED";
    }

    const updated = await tx.accountantExpenseRequest.update({
      where: { id: expense.id },
      data: {
        status: finalStatus,
        finalisedAt: finalStatus === "PENDING" ? null : new Date(),
      },
      include: { decisions: true },
    });

    if (expense.status !== finalStatus && finalStatus !== "PENDING") {
      await createNotification(tx, {
        companyId: input.companyId,
        userId: expense.staffId,
        title: `Expense ${finalStatus.toLowerCase()}`,
        message:
          finalStatus === "APPROVED"
            ? `Your ${expense.category} expense request has been approved by both reviewers.`
            : `Your ${expense.category} expense request was rejected. Review the recorded reasons.`,
        type: finalStatus === "APPROVED" ? "SUCCESS" : "ERROR",
      });
    }

    return updated;
  });
}
