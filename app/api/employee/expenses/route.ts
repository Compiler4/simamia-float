import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AccountantHttpError,
  accountantRouteError,
  createAudit,
  decimalValue,
  notifyRoles,
  text,
} from "@/lib/accountant-server";

const categories = new Set([
  "Fuel",
  "Transport",
  "Airtime",
  "Accommodation",
  "Repairs",
  "Stationery",
  "Meals",
  "Office Expenses",
  "Emergency Expenses",
]);

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
        "The employee is not assigned to a company.",
        403,
      );
    }

    const body = await request.json();
    const category = text(body.category).trim();
    const description = text(body.description).trim();
    const receiptUrl = text(body.receiptUrl).trim();

    if (!categories.has(category)) {
      throw new AccountantHttpError(
        "Choose a supported expense category.",
        422,
      );
    }

    if (!description) {
      throw new AccountantHttpError(
        "An expense description is required.",
        422,
      );
    }

    if (!receiptUrl) {
      throw new AccountantHttpError(
        "Upload a receipt before submitting the expense.",
        422,
      );
    }

    const expense = await prisma.expense.create({
      data: {
        companyId: String(user.companyId),
        employeeId: String(user.id),
        category,
        amount: decimalValue(body.amount),
        description,
        receiptUrl,
        status: "PENDING",
      },
    });

    await notifyRoles({
      companyId: String(user.companyId),
      roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
      title: "Expense approval required",
      message: `${String(user.name ?? "Employee")} submitted ${category} expense of TZS ${Number(
        body.amount,
      ).toLocaleString()}.`,
      type: "INFO",
    });

    await createAudit({
      companyId: String(user.companyId),
      userId: String(user.id),
      action: "SUBMIT_EXPENSE",
      module: "EXPENSES",
      details: `${category}, TZS ${Number(body.amount)}.`,
    });

    return NextResponse.json({
      success: true,
      message: "Expense submitted for accountant review.",
      expense,
    });
  } catch (error) {
    return accountantRouteError(error);
  }
}
