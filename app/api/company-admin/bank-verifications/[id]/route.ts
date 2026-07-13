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

const statuses = [
  "PENDING",
  "VERIFIED",
  "AMOUNT_MISMATCH",
  "MISSING_RECEIPT",
  "DUPLICATE_DEPOSIT",
  "MISSING_BANK_RECORD",
  "REJECTED",
];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const verification = await db.companyBankVerification.findFirst({
      where: { id, companyId },
    });

    if (!verification) {
      throw new HttpError("Bank verification record not found.", 404);
    }

    const data: Record<string, unknown> = {};

    if (body.isSeenByAdmin !== undefined) {
      data.isSeenByAdmin = Boolean(body.isSeenByAdmin);
    }

    if (body.status !== undefined) {
      const status = text(body.status);
      if (!statuses.includes(status)) {
        throw new HttpError("Invalid bank verification status.", 422);
      }
      data.status = status;
      data.verifiedById = user.id;
      data.verifiedByName = user.name;
      data.verifiedAt = new Date();
    }

    const updated = await db.companyBankVerification.update({
      where: { id },
      data,
    });

    if (body.status !== undefined) {
      await createNotification({
        companyId,
        targetUserId: verification.uploadedById,
        title: `Bank record ${text(body.status).toLowerCase().replaceAll("_", " ")}`,
        message: `${user.name} reviewed reference ${text(verification.referenceNumber)}.`,
        type: text(body.status) === "VERIFIED" ? "SUCCESS" : "WARNING",
        link: "/dashboard",
      });

      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: `BANK_${text(body.status)}`,
        module: "BANK",
        details: `Reference ${text(verification.referenceNumber)}.`,
      });
    }

    return NextResponse.json({ success: true, verification: updated });
  } catch (error) {
    return routeError(error);
  }
}
