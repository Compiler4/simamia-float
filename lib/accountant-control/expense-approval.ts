import { PortalHttpError, type PortalSession } from "./auth";
import { notifyUser } from "./notifications";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function recordExpenseDecision(
  db: any,
  reviewer: PortalSession,
  input: {
    expenseId: unknown;
    decision: unknown;
    reason: unknown;
  },
) {
  const expenseId = text(input.expenseId);
  const decision = text(input.decision).toUpperCase();
  const reason = text(input.reason);

  if (!expenseId || !["APPROVED", "REJECTED"].includes(decision)) {
    throw new PortalHttpError(
      "Expense, decision and review reason are required.",
      400,
    );
  }
  if (!reason) {
    throw new PortalHttpError("Enter a review reason.", 400);
  }

  if (!["ACCOUNTANT", "COMPANY_ADMIN"].includes(reviewer.role)) {
    throw new PortalHttpError(
      "Only the Accountant and Company Admin can decide expenses.",
      403,
    );
  }

  const expense = await db.expense.findFirst({
    where: { id: expenseId, companyId: reviewer.companyId },
    include: { employee: true },
  });
  if (!expense) {
    throw new PortalHttpError("Expense request not found.", 404);
  }

  await db.approvalDecision.upsert({
    where: {
      companyId_itemType_itemId_reviewerRole: {
        companyId: reviewer.companyId,
        itemType: "EXPENSE",
        itemId: expense.id,
        reviewerRole: reviewer.role,
      },
    },
    update: {
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      decision,
      reason,
      decidedAt: new Date(),
    },
    create: {
      companyId: reviewer.companyId,
      itemType: "EXPENSE",
      itemId: expense.id,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      decision,
      reason,
      decidedAt: new Date(),
    },
  });

  const decisions = await db.approvalDecision.findMany({
    where: {
      companyId: reviewer.companyId,
      itemType: "EXPENSE",
      itemId: expense.id,
      reviewerRole: { in: ["ACCOUNTANT", "COMPANY_ADMIN"] },
    },
  });

  const byRole = new Map<string, any>(
    decisions.map((row: any) => [String(row.reviewerRole), row]),
  );
  const accountant = byRole.get("ACCOUNTANT");
  const admin = byRole.get("COMPANY_ADMIN");

  let finalStatus: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";
  if (
    accountant?.decision === "REJECTED" ||
    admin?.decision === "REJECTED"
  ) {
    finalStatus = "REJECTED";
  } else if (
    accountant?.decision === "APPROVED" &&
    admin?.decision === "APPROVED"
  ) {
    finalStatus = "APPROVED";
  }

  const reviewSummary = [
    accountant
      ? `Accountant: ${accountant.decision} — ${accountant.reason}`
      : "Accountant: pending",
    admin
      ? `Company Admin: ${admin.decision} — ${admin.reason}`
      : "Company Admin: pending",
  ].join("\n");

  const updated = await db.expense.update({
    where: { id: expense.id },
    data: {
      status: finalStatus,
      reviewedById: reviewer.id,
      reviewedAt: finalStatus === "PENDING" ? null : new Date(),
      reviewNote: reviewSummary,
    },
  });

  await notifyUser(db, {
    companyId: reviewer.companyId,
    userId: expense.employeeId,
    title:
      finalStatus === "PENDING"
        ? "Expense review updated"
        : `Expense ${finalStatus.toLowerCase()}`,
    message:
      finalStatus === "PENDING"
        ? `${reviewer.role.replaceAll("_", " ")} recorded ${decision.toLowerCase()}. The second approval is still required.`
        : `Your ${expense.category} expense of TZS ${Number(expense.amount).toLocaleString("en-TZ")} is ${finalStatus.toLowerCase()}. ${reason}`,
    type:
      finalStatus === "APPROVED"
        ? "SUCCESS"
        : finalStatus === "REJECTED"
          ? "ERROR"
          : "INFO",
  });

  return {
    expense: updated,
    decisions,
    finalStatus,
    message:
      finalStatus === "APPROVED"
        ? "Both required approvals are complete. The expense is approved."
        : finalStatus === "REJECTED"
          ? "At least one required reviewer rejected the expense. The expense is rejected."
          : "Decision saved. The expense remains pending until both reviewers approve.",
  };
}
