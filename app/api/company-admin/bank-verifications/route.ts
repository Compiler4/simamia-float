import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  normalizeDate,
  requireCompanyMember,
  routeError,
  text,
  toNumber,
  HttpError,
} from "@/lib/company-admin-server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyMember([
      "COMPANY_ADMIN",
      "ACCOUNTANT",
      "STAFF",
      "BROKER",
    ]);
    const companyId = user.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const amount = toNumber(body.amount);
    const referenceNumber = text(body.referenceNumber).trim();
    const bankAccount = text(body.bankAccount).trim();
    const depositDate = normalizeDate(body.depositDate || new Date());

    if (amount <= 0 || !referenceNumber || !bankAccount) {
      throw new HttpError(
        "Amount, reference number and bank account are required.",
        422,
      );
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
        depositSlipUrl: text(body.depositSlipUrl).trim() || null,
        bankReceiptUrl: text(body.bankReceiptUrl).trim() || null,
        bankStatementUrl: text(body.bankStatementUrl).trim() || null,
        status: "PENDING",
        isSeenByAdmin: false,
      },
    });

    await createNotification({
      companyId,
      targetRole: "COMPANY_ADMIN",
      title: "New bank verification uploaded",
      message: `${user.name} uploaded bank documents for reference ${referenceNumber}.`,
      type: "BANK",
      link: "/admin/dashboard?section=bank",
    });

    await createNotification({
      companyId,
      targetRole: "ACCOUNTANT",
      title: "Bank record awaiting verification",
      message: `${user.name} submitted TZS ${amount.toLocaleString()} for review.`,
      type: "BANK",
      link: "/dashboard",
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPLOAD_BANK_VERIFICATION",
      module: "BANK",
      details: `Reference ${referenceNumber}, TZS ${amount}.`,
    });

    return NextResponse.json({ success: true, verification });
  } catch (error) {
    return routeError(error);
  }
}
