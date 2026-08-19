import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  toNumber,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   HELPERS
============================================================ */

function clean(
  value: unknown,
): string {
  return text(value).trim();
}

function assertJsonRequest(
  request: NextRequest,
) {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() || "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    throw new HttpError(
      "Expense requests must use application/json.",
      415,
    );
  }
}

function serializeExpense(
  expense: any,
) {
  if (!expense) {
    return expense;
  }

  return {
    ...expense,

    amount:
      expense.amount == null
        ? 0
        : Number(
            expense.amount,
          ),
  };
}

/* ============================================================
   GET
   /api/company-admin/expenses

   LIST COMPANY EXPENSES
============================================================ */

export async function GET(
  request: NextRequest,
) {
  try {
    const user =
      await requireCompanyAdmin();

    const companyId =
      clean(
        user.companyId,
      );

    if (!companyId) {
      throw new HttpError(
        "Your Company Admin account is not connected to a company.",
        403,
      );
    }

    const db =
      prisma as any;

    const status =
      clean(
        request.nextUrl.searchParams.get(
          "status",
        ),
      ).toUpperCase();

    const category =
      clean(
        request.nextUrl.searchParams.get(
          "category",
        ),
      );

    const search =
      clean(
        request.nextUrl.searchParams.get(
          "search",
        ),
      );

    const where:
      Record<string, any> = {
        companyId,
      };

    if (
      status &&
      status !== "ALL"
    ) {
      if (
        ![
          "PENDING",
          "APPROVED",
          "REJECTED",
        ].includes(status)
      ) {
        throw new HttpError(
          "Invalid expense status filter.",
          422,
        );
      }

      where.status =
        status;
    }

    if (
      category &&
      category !== "ALL"
    ) {
      where.category =
        category;
    }

    if (search) {
      where.OR = [
        {
          category: {
            contains:
              search,
          },
        },

        {
          description: {
            contains:
              search,
          },
        },

        {
          createdByName: {
            contains:
              search,
          },
        },

        {
          reviewNote: {
            contains:
              search,
          },
        },
      ];
    }

    const expenses =
      await db.companyExpense.findMany(
        {
          where,

          orderBy: [
            {
              expenseDate:
                "desc",
            },
            {
              createdAt:
                "desc",
            },
          ],
        },
      );

    const serialized =
      expenses.map(
        serializeExpense,
      );

    const summary = {
      total:
        serialized.length,

      pending:
        serialized.filter(
          (item: any) =>
            item.status ===
            "PENDING",
        ).length,

      approved:
        serialized.filter(
          (item: any) =>
            item.status ===
            "APPROVED",
        ).length,

      rejected:
        serialized.filter(
          (item: any) =>
            item.status ===
            "REJECTED",
        ).length,

      totalAmount:
        serialized.reduce(
          (
            sum: number,
            item: any,
          ) =>
            sum +
            Number(
              item.amount ||
                0,
            ),
          0,
        ),

      approvedAmount:
        serialized
          .filter(
            (item: any) =>
              item.status ===
              "APPROVED",
          )
          .reduce(
            (
              sum: number,
              item: any,
            ) =>
              sum +
              Number(
                item.amount ||
                  0,
              ),
            0,
          ),
    };

    return NextResponse.json(
      {
        success: true,

        expenses:
          serialized,

        summary,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return routeError(
      error,
    );
  }
}

/* ============================================================
   POST
   /api/company-admin/expenses

   CREATE EXPENSE
============================================================ */

export async function POST(
  request: NextRequest,
) {
  try {
    const user =
      await requireCompanyAdmin();

    const companyId =
      clean(
        user.companyId,
      );

    if (!companyId) {
      throw new HttpError(
        "Your Company Admin account is not connected to a company.",
        403,
      );
    }

    /*
     * Normal expense creation uses JSON.
     */
    assertJsonRequest(
      request,
    );

    let body:
      Record<string, any>;

    try {
      body =
        await request.json();
    } catch {
      throw new HttpError(
        "Invalid expense request. JSON data was expected.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       CATEGORY
    ======================================================== */

    const category =
      clean(
        body.category,
      );

    if (!category) {
      throw new HttpError(
        "Expense category is required.",
        422,
      );
    }

    if (
      category.length >
      100
    ) {
      throw new HttpError(
        "Expense category is too long.",
        422,
      );
    }

    /* ========================================================
       AMOUNT
    ======================================================== */

    const amount =
      toNumber(
        body.amount,
      );

    if (
      !Number.isFinite(
        amount,
      ) ||
      amount <= 0
    ) {
      throw new HttpError(
        "Expense amount must be above zero.",
        422,
      );
    }

    /* ========================================================
       DATE
    ======================================================== */

    const expenseDateRaw =
      clean(
        body.expenseDate,
      );

    if (
      !expenseDateRaw
    ) {
      throw new HttpError(
        "Expense date is required.",
        422,
      );
    }

    const expenseDate =
      new Date(
        expenseDateRaw,
      );

    if (
      Number.isNaN(
        expenseDate.getTime(),
      )
    ) {
      throw new HttpError(
        "Expense date is invalid.",
        422,
      );
    }

    /* ========================================================
       DESCRIPTION
    ======================================================== */

    const description =
      clean(
        body.description,
      );

    /* ========================================================
       RECEIPT
    ======================================================== */

    const receiptUrl =
      clean(
        body.receiptUrl,
      );

    /*
     * receiptUrl may be blank when no supporting
     * document was uploaded.
     *
     * If your business rules require receipts for every
     * expense, change this to a validation error.
     */

    /* ========================================================
       COMPANY ADMIN AUTO APPROVAL

       Requirement:
       Expenses created by Company Admin are automatically
       APPROVED.
    ======================================================== */

    const now =
      new Date();

    let expense:
      any;

    try {
      expense =
        await db.companyExpense.create(
          {
            data: {
              companyId,

              category,

              amount,

              expenseDate,

              description,

              receiptUrl,

              /*
               * Creator information
               */
              createdById:
                user.id,

              createdByName:
                user.name,

              createdByRole:
                user.role,

              /*
               * Company Admin expenses are automatically
               * approved.
               */
              status:
                "APPROVED",

              reviewedById:
                user.id,

              reviewedByName:
                user.name,

              reviewedAt:
                now,

              reviewNote:
                "Automatically approved because the expense was created by Company Admin.",
            },
          },
        );
    } catch (error: any) {
      console.error(
        "[COMPANY_ADMIN_CREATE_EXPENSE_DATABASE_ERROR]",
        error,
      );

      if (
        error?.code ===
        "P2002"
      ) {
        throw new HttpError(
          "An expense with the same unique information already exists.",
          409,
        );
      }

      throw error;
    }

    /* ========================================================
       AUDIT
    ======================================================== */

    try {
      await createAudit({
        companyId,

        actorId:
          user.id,

        actorName:
          user.name,

        actorRole:
          user.role,

        action:
          "CREATE_EXPENSE",

        module:
          "EXPENSES",

        details:
          `Created and automatically approved ${category} expense of ${amount}.`,
      });
    } catch (
      auditError
    ) {
      /*
       * Expense creation already succeeded.
       * Audit failure should not make the UI report
       * that expense creation failed.
       */
      console.error(
        "[CREATE_EXPENSE_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Expense created and automatically approved.",

        expense:
          serializeExpense(
            expense,
          ),
      },
      {
        status: 201,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return routeError(
      error,
    );
  }
}