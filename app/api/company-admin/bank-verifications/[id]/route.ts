import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createAudit, createNotification, requireCompanyMember, routeError, text, HttpError } from "@/lib/company-admin-server";

const statuses = new Set(["PENDING", "VERIFIED", "AMOUNT_MISMATCH", "MISSING_RECEIPT", "DUPLICATE_DEPOSIT", "MISSING_BANK_RECORD", "REJECTED"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = String(user.companyId);
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const current = await db.companyBankVerification.findFirst({ where: { id, companyId } });
    if (!current) throw new HttpError("Bank verification record not found.", 404);

    const data: Record<string, unknown> = {};
    if (body.isSeenByAdmin !== undefined) data.isSeenByAdmin = Boolean(body.isSeenByAdmin);
    if (body.reviewNote !== undefined) data.reviewNote = text(body.reviewNote).trim() || null;

    if (body.status !== undefined) {
      const status = text(body.status).trim().toUpperCase();
      if (!statuses.has(status)) throw new HttpError("Invalid bank verification status.", 422);

      if (status !== "PENDING" && text(body.reviewNote).trim().length < 5) {
        throw new HttpError("Write a clear review reason before saving the bank decision.", 422);
      }

      if (status === "VERIFIED" && current.proofInspectionStatus === "INSUFFICIENT") {
        if (user.role !== "COMPANY_ADMIN" || !Boolean(body.overrideInsufficientProof)) {
          throw new HttpError("This proof is marked insufficient. Company Admin must explicitly override it with a review reason, or request clearer proof.", 409);
        }
        data.proofInspectionStatus = "MANUAL_REVIEW";
      }

      data.status = status;
      data.verifiedById = status === "PENDING" ? null : user.id;
      data.verifiedByName = status === "PENDING" ? null : user.name;
      data.verifiedAt = status === "PENDING" ? null : new Date();
      data.isSeenByAdmin = true;
    }

    const verification = await db.companyBankVerification.update({ where: { id }, data });

    if (body.status !== undefined) {
      const status = text(body.status).trim().toUpperCase();
      await createNotification({
        companyId,
        targetUserId: current.uploadedById,
        title: `Bank record ${status.toLowerCase().replaceAll("_", " ")}`,
        message: `${user.name} reviewed reference ${current.referenceNumber}. ${text(body.reviewNote).trim()}`.trim(),
        type: status === "VERIFIED" ? "SUCCESS" : status === "PENDING" ? "INFO" : "WARNING",
        link: "/dashboard",
      });
      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: `BANK_${status}`,
        module: "BANK",
        details: `Reference ${current.referenceNumber}; ${text(body.reviewNote).trim()}`,
      });
    }

    return NextResponse.json({ success: true, verification });
  } catch (error) {
    return routeError(error);
  }
}
