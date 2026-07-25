import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  requireCompanyMember,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const decisions = new Set(["APPROVED", "REJECTED"]);
const itemTypes = new Set(["EXPENSE", "BANK_VERIFICATION"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ itemType: string; id: string }> },
) {
  try {
    const reviewer = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = reviewer.companyId as string;
    const { itemType: rawItemType, id } = await context.params;
    const itemType = text(rawItemType).toUpperCase();
    const body = await request.json();
    const decision = text(body.decision).toUpperCase();
    const reason = text(body.reason).trim();
    const overrideInsufficientProof = Boolean(body.overrideInsufficientProof);
    const db = prisma as any;

    if (!itemTypes.has(itemType)) {
      throw new HttpError("Invalid approval item type.", 422);
    }
    if (!decisions.has(decision)) {
      throw new HttpError("Decision must be APPROVED or REJECTED.", 422);
    }
    if (reason.length < 5) {
      throw new HttpError("Write a clear approval or rejection reason.", 422);
    }

    const item =
      itemType === "EXPENSE"
        ? await db.companyExpense.findFirst({ where: { id, companyId } })
        : await db.companyBankVerification.findFirst({ where: { id, companyId } });
    if (!item) throw new HttpError("Approval record was not found.", 404);

    const overridingInsufficientBankProof =
      itemType === "BANK_VERIFICATION" &&
      decision === "APPROVED" &&
      item.proofInspectionStatus === "INSUFFICIENT";

    if (overridingInsufficientBankProof) {
      if (reviewer.role !== "COMPANY_ADMIN" || !overrideInsufficientProof) {
        throw new HttpError(
          "This bank proof is insufficient. A Company Admin must explicitly override it with a detailed reason, or the uploader must provide clearer proof.",
          409,
        );
      }
    }

    await db.approvalDecision.upsert({
      where: {
        companyId_itemType_itemId_reviewerRole: {
          companyId,
          itemType,
          itemId: id,
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
        companyId,
        itemType,
        itemId: id,
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        reviewerRole: reviewer.role,
        decision,
        reason,
      },
    });

    const workflowDecisions = await db.approvalDecision.findMany({
      where: { companyId, itemType, itemId: id },
      orderBy: { reviewerRole: "asc" },
    });

    const companyAdmin = workflowDecisions.find(
      (row: any) => row.reviewerRole === "COMPANY_ADMIN",
    );
    const accountant = workflowDecisions.find(
      (row: any) => row.reviewerRole === "ACCOUNTANT",
    );
    const hasRejection = workflowDecisions.some(
      (row: any) => row.decision === "REJECTED",
    );
    const fullyApproved =
      companyAdmin?.decision === "APPROVED" && accountant?.decision === "APPROVED";
    const conflict =
      Boolean(companyAdmin && accountant) &&
      companyAdmin.decision !== accountant.decision;
    const workflowStatus = hasRejection
      ? conflict
        ? "CONFLICT"
        : "REJECTED"
      : fullyApproved
        ? "APPROVED"
        : "PARTIAL";

    if (itemType === "EXPENSE") {
      await db.companyExpense.update({
        where: { id },
        data: {
          status: fullyApproved ? "APPROVED" : hasRejection ? "REJECTED" : "PENDING",
          reviewedById: reviewer.id,
          reviewedByName: reviewer.name,
          reviewNote: reason,
          reviewedAt: new Date(),
        },
      });

      await createNotification({
        companyId,
        targetUserId: item.createdById,
        title: `Expense workflow ${workflowStatus.toLowerCase()}`,
        message: `${reviewer.name} (${reviewer.role}) ${decision.toLowerCase()} your ${item.category} expense. Reason: ${reason}`,
        type: fullyApproved ? "SUCCESS" : hasRejection ? "WARNING" : "INFO",
        link: "/dashboard",
      });
    } else {
      await db.companyBankVerification.update({
        where: { id },
        data: {
          status: fullyApproved ? "VERIFIED" : hasRejection ? "REJECTED" : "PENDING",
          proofInspectionStatus: overridingInsufficientBankProof
            ? "MANUAL_REVIEW"
            : undefined,
          verifiedById: reviewer.id,
          verifiedByName: reviewer.name,
          reviewNote: reason,
          verifiedAt: new Date(),
          isSeenByAdmin: true,
        },
      });

      await createNotification({
        companyId,
        targetUserId: item.uploadedById,
        title: `Bank workflow ${workflowStatus.toLowerCase()}`,
        message: `${reviewer.name} (${reviewer.role}) ${decision.toLowerCase()} reference ${item.referenceNumber}. Reason: ${reason}`,
        type: fullyApproved ? "SUCCESS" : hasRejection ? "WARNING" : "INFO",
        link: "/dashboard",
      });
    }

    await createAudit({
      companyId,
      actorId: reviewer.id,
      actorName: reviewer.name,
      actorRole: reviewer.role,
      action: `${itemType}_${decision}`,
      module: "APPROVALS",
      details: `${id}: ${reason}; workflow=${workflowStatus}; insufficientProofOverride=${overridingInsufficientBankProof}.`,
    });

    return NextResponse.json({
      success: true,
      workflowStatus,
      conflict,
      decisions: workflowDecisions,
    });
  } catch (error) {
    return routeError(error);
  }
}
