import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AccountantHttpError,
  accountantRouteError,
  blockingDepositStatuses,
  createAudit,
  decimalValue,
  notifyRoles,
  text,
} from "@/lib/accountant-server";

export async function POST(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as any;

    if (!user) {
      throw new AccountantHttpError(
        "Authentication is required.",
        401,
      );
    }

    if (!user.companyId) {
      throw new AccountantHttpError(
        "The staff account is not assigned to a company.",
        403,
      );
    }

    if (
      !["STAFF", "BROKER", "GPS_MANAGER"].includes(String(user.role))
    ) {
      throw new AccountantHttpError(
        "Only operational staff may submit bank deposits.",
        403,
      );
    }

    const companyId = String(user.companyId);
    const staffId = String(user.id);
    const db = prisma as any;

    const unresolvedHold = await db.bankDeposit.findFirst({
      where: {
        companyId,
        staffId,
        status: {
          in: [...blockingDepositStatuses],
        },
      },
      select: {
        id: true,
        status: true,
        mismatchReason: true,
      },
    });

    if (unresolvedHold) {
      throw new AccountantHttpError(
        `Financial Hold: resolve the ${String(
          unresolvedHold.status,
        )
          .toLowerCase()
          .replaceAll("_", " ")} deposit before submitting another one.`,
        409,
      );
    }

    const body = await request.json();
    const referenceNo = text(body.referenceNo).trim();
    const bankAccount = text(body.bankAccount).trim();
    const depositSlipUrl = text(body.depositSlipUrl).trim();
    const bankReceiptUrl = text(body.bankReceiptUrl).trim();

    if (!referenceNo || !bankAccount) {
      throw new AccountantHttpError(
        "Reference number and bank account are required.",
        422,
      );
    }

    if (!depositSlipUrl || !bankReceiptUrl) {
      throw new AccountantHttpError(
        "Upload both the deposit slip and bank receipt.",
        422,
      );
    }

    const duplicate = await db.bankDeposit.findFirst({
      where: {
        companyId,
        referenceNo,
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new AccountantHttpError(
        "A deposit with this reference number already exists.",
        409,
      );
    }

    const deposit = await db.bankDeposit.create({
      data: {
        companyId,
        staffId,
        amount: decimalValue(body.amount),
        referenceNo,
        bankAccount,
        depositDate: body.depositDate
          ? new Date(body.depositDate)
          : new Date(),
        depositSlipUrl,
        bankReceiptUrl,
        status: "PENDING",
      },
    });

    await notifyRoles({
      companyId,
      roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
      title: "Bank deposit awaiting verification",
      message: `${String(user.name ?? "Staff")} uploaded deposit ${referenceNo} for accountant verification.`,
      type: "INFO",
    });

    await createAudit({
      companyId,
      userId: staffId,
      action: "SUBMIT_BANK_DEPOSIT",
      module: "BANK_RECONCILIATION",
      details: `${referenceNo}, TZS ${Number(body.amount)}.`,
    });

    return NextResponse.json({
      success: true,
      message: "Bank deposit submitted for verification.",
      deposit,
    });
  } catch (error) {
    return accountantRouteError(error);
  }
}
