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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return text(value).trim();
}

function positiveAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError("Bank verification amount must be greater than zero.", 422);
  }
  return amount;
}

function validDate(value: unknown): Date {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    throw new HttpError("A valid deposit date is required.", 422);
  }
  return date;
}

export async function GET() {
  try {
    const user = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = String(user.companyId || "").trim();
    if (!companyId) throw new HttpError("Your account is not connected to a company.", 403);

    const db = prisma as any;
    const verifications = await db.companyBankVerification.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json(
      { success: true, verifications },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = String(user.companyId || "").trim();
    if (!companyId) throw new HttpError("Your account is not connected to a company.", 403);

    const body = (await request.json()) as Record<string, unknown>;
    const referenceNumber = clean(body.referenceNumber).toUpperCase();
    const bankAccount = clean(body.bankAccount);
    const amount = positiveAmount(body.amount);
    const depositDate = validDate(body.depositDate);

    if (referenceNumber.length < 3) {
      throw new HttpError("A bank reference number is required.", 422);
    }
    if (!bankAccount) {
      throw new HttpError("A bank account or account label is required.", 422);
    }

    const db = prisma as any;
    const duplicate = await db.companyBankVerification.findFirst({
      where: { companyId, referenceNumber },
      select: { id: true },
    });
    if (duplicate) {
      throw new HttpError("This bank reference number already exists for the company.", 409);
    }

    const verification = await db.companyBankVerification.create({
      data: {
        companyId,
        uploadedById: user.id,
        uploadedByName: user.name,
        uploadedByRole: user.role,
        amount,
        referenceNumber,
        depositDate,
        bankAccount,
        depositSlipUrl: clean(body.depositSlipUrl) || null,
        bankReceiptUrl: clean(body.bankReceiptUrl) || null,
        bankStatementUrl: clean(body.bankStatementUrl) || null,
        proofInspectionStatus: "PENDING",
        proofMissingFields: null,
        reviewNote: clean(body.reviewNote) || null,
        status: "PENDING",
        isSeenByAdmin: user.role === "COMPANY_ADMIN",
      },
    });

    if (user.role !== "COMPANY_ADMIN") {
      await createNotification({
        companyId,
        targetRole: "COMPANY_ADMIN",
        title: "New bank verification",
        message: `${user.name} submitted bank reference ${referenceNumber} for review.`,
        type: "INFO",
        link: "/admin/dashboard",
      });
    }

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "CREATE_BANK_VERIFICATION",
      module: "BANK",
      details: `Created bank verification ${referenceNumber}.`,
    });

    return NextResponse.json({ success: true, verification }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
