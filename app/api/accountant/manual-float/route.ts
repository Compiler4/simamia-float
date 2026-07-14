import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  AccountantHttpError,
  accountantRouteError,
  createAudit,
  ensurePeriodOpen,
  notifyUser,
  numberValue,
  requireAccountant,
  text,
  tanzaniaDayBounds,
} from "@/lib/accountant-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function positiveAmount(value: unknown): number {
  const amount = numberValue(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AccountantHttpError(
      "Enter a float amount greater than zero.",
      400,
    );
  }

  return amount;
}

function issueDate(value: unknown): Date {
  const input = cleanText(value);

  const result = input ? new Date(`${input}T09:00:00+03:00`) : new Date();

  if (Number.isNaN(result.getTime())) {
    throw new AccountantHttpError("Enter a valid float issue date.", 400);
  }

  return result;
}

function generatedReference() {
  return `A2S-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function normalizedReference(value: unknown): string {
  const supplied = cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);

  return supplied || generatedReference();
}

function prismaErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(
      (
        error as {
          code?: unknown;
        }
      ).code ?? "",
    );
  }

  return "";
}

async function uniqueReference(
  companyId: string,
  requested: unknown,
): Promise<string> {
  const base = normalizedReference(requested);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 140)}-${attempt + 1}`;

    const existing = await prisma.floatTransaction.findFirst({
      where: {
        companyId,
        referenceNo: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }
  }

  return generatedReference();
}

async function requireActiveStaff(companyId: string, staffUserId: string) {
  const staff = await prisma.user.findFirst({
    where: {
      id: staffUserId,
      companyId,
      role: "STAFF",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      profileImageUrl: true,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!staff) {
    throw new AccountantHttpError(
      "The selected active STAFF user was not found in your company.",
      404,
    );
  }

  return staff;
}

async function requireOpenFinancialDay(companyId: string, date: Date) {
  const bounds = tanzaniaDayBounds(date);

  await ensurePeriodOpen(companyId, bounds.start);

  const financialDay = await prisma.financialDay.findUnique({
    where: {
      companyId_date: {
        companyId,
        date: bounds.start,
      },
    },
  });

  if (!financialDay) {
    throw new AccountantHttpError(
      "Open the financial day before assigning float to staff.",
      409,
    );
  }

  if (financialDay.status !== "OPEN") {
    throw new AccountantHttpError(
      `The financial day is ${String(
        financialDay.status,
      ).toLowerCase()}. Float can be assigned only while it is open.`,
      409,
    );
  }

  return financialDay;
}

export async function GET() {
  try {
    const accountant = await requireAccountant(true);

    const rows = await prisma.floatTransaction.findMany({
      where: {
        companyId: accountant.companyId,
        fromUserId: accountant.id,
        transactionType: "ACCOUNTANT_TO_STAFF",
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            profileImageUrl: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            branchId: true,
            profileImageUrl: true,
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          issuedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 1000,
    });

    return NextResponse.json({
      success: true,
      rows,
      total: rows.length,
    });
  } catch (error) {
    return accountantRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const accountant = await requireAccountant(true);

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AccountantHttpError(
        "The request body must contain valid JSON.",
        400,
      );
    }

    const action = cleanText(body.action).toUpperCase();

    if (action && action !== "ASSIGN_STAFF_FLOAT") {
      throw new AccountantHttpError(
        `Unsupported manual-float action: ${action}.`,
        422,
      );
    }

    const staffUserId = text(body.staffUserId).trim();

    if (!staffUserId) {
      throw new AccountantHttpError("Select a staff officer.", 400);
    }

    const staff = await requireActiveStaff(accountant.companyId, staffUserId);

    const amount = positiveAmount(body.amount);

    const issuedAt = issueDate(body.issueDate);

    await requireOpenFinancialDay(accountant.companyId, issuedAt);

    const purpose = cleanText(body.purpose) || "Morning operational float";

    const notes = cleanText(body.notes) || null;

    const receiptUrl = cleanText(body.receiptUrl) || null;

    let referenceNo = await uniqueReference(
      accountant.companyId,
      body.referenceNo,
    );

    let transaction: any = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        transaction = await prisma.floatTransaction.create({
          data: {
            companyId: accountant.companyId,
            fromUserId: accountant.id,
            toUserId: staff.id,
            approvedById: accountant.id,
            brokerCustomerId: null,
            transactionType: "ACCOUNTANT_TO_STAFF",
            referenceNo,
            amount: amount.toFixed(2),
            returnedAmount: null,
            purpose,
            receiptUrl,
            notes,
            status: "ISSUED",
            issuedAt,
            approvedAt: new Date(),
          },
          include: {
            fromUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profileImageUrl: true,
              },
            },
            toUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                branchId: true,
                profileImageUrl: true,
                branch: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        });

        break;
      } catch (error) {
        if (prismaErrorCode(error) !== "P2002") {
          throw error;
        }

        referenceNo = generatedReference();
      }
    }

    if (!transaction) {
      throw new AccountantHttpError(
        "A unique float reference could not be generated. Submit again.",
        409,
      );
    }

    await Promise.allSettled([
      notifyUser({
        companyId: accountant.companyId,
        userId: staff.id,
        title: "Operational float assigned",
        message: `${accountant.name} assigned TZS ${amount.toLocaleString()} to you. Reference: ${referenceNo}. Confirm receipt from the Staff Portal.`,
        type: "INFO",
      }),

      createAudit({
        companyId: accountant.companyId,
        userId: accountant.id,
        action: "ASSIGN_STAFF_FLOAT",
        module: "MANUAL_CASHFLOW",
        details: `Assigned TZS ${amount.toFixed(
          2,
        )} to ${staff.name} (${staff.id}) using reference ${referenceNo}.`,
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: `TZS ${amount.toLocaleString()} was assigned to ${staff.name}. Reference: ${referenceNo}.`,
        transaction,
      },
      { status: 201 },
    );
  } catch (error) {
    const code = prismaErrorCode(error);

    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          message: "The float transaction database is not synchronized.",
          details:
            "Run npx prisma db push, regenerate Prisma Client, clear .next and restart.",
          error: error instanceof Error ? error.message : String(error),
        },
        { status: 503 },
      );
    }

    return accountantRouteError(error);
  }
}
