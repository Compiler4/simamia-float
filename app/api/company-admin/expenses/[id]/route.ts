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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
      "Expense updates must use application/json.",
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
   PATCH
   /api/company-admin/expenses/:id

   Handles:
   - Approve
   - Reject
   - Edit pending expense
============================================================ */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
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

    const { id } =
      await context.params;

    if (!id) {
      throw new HttpError(
        "Expense ID is required.",
        400,
      );
    }

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
        "Invalid expense update request.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       FIND EXPENSE

       Company isolation prevents one company from editing
       another company's expense.
    ======================================================== */

    const current =
      await db.companyExpense.findFirst(
        {
          where: {
            id,
            companyId,
          },
        },
      );

    if (!current) {
      throw new HttpError(
        "Expense not found.",
        404,
      );
    }

    /* ========================================================
       APPROVAL / REJECTION
    ======================================================== */

    const requestedStatus =
      clean(
        body.status,
      ).toUpperCase();

    if (
      requestedStatus
    ) {
      if (
        ![
          "APPROVED",
          "REJECTED",
        ].includes(
          requestedStatus,
        )
      ) {
        throw new HttpError(
          "Expense decision must be APPROVED or REJECTED.",
          422,
        );
      }

      /*
       * Idempotent handling.
       */
      if (
        current.status ===
          requestedStatus &&
        !clean(
          body.reviewNote,
        )
      ) {
        return NextResponse.json(
          {
            success: true,

            message:
              `Expense is already ${requestedStatus.toLowerCase()}.`,

            expense:
              serializeExpense(
                current,
              ),
          },
          {
            status: 200,
          },
        );
      }

      const reviewNote =
        clean(
          body.reviewNote,
        );

      let expense:
        any;

      try {
        expense =
          await db.companyExpense.update(
            {
              where: {
                id,
              },

              data: {
                status:
                  requestedStatus,

                reviewNote:
                  reviewNote ||
                  null,

                reviewedById:
                  user.id,

                reviewedByName:
                  user.name,

                reviewedAt:
                  new Date(),
              },
            },
          );
      } catch (
        databaseError
      ) {
        console.error(
          "[EXPENSE_DECISION_DATABASE_ERROR]",
          databaseError,
        );

        throw databaseError;
      }

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
            `${requestedStatus}_EXPENSE`,

          module:
            "EXPENSES",

          details:
            `${requestedStatus.toLowerCase()} expense ${id}.`,
        });
      } catch (
        auditError
      ) {
        console.error(
          "[EXPENSE_DECISION_AUDIT_ERROR]",
          auditError,
        );
      }

      return NextResponse.json(
        {
          success: true,

          message:
            `Expense ${requestedStatus.toLowerCase()} successfully.`,

          expense:
            serializeExpense(
              expense,
            ),
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    /* ========================================================
       NORMAL EDIT

       Existing business rule:
       only PENDING expenses can have their content edited.
    ======================================================== */

    if (
      current.status !==
      "PENDING"
    ) {
      throw new HttpError(
        "Only pending expenses can be edited.",
        409,
      );
    }

    const data:
      Record<string, unknown> =
      {};

    /* ========================================================
       CATEGORY
    ======================================================== */

    if (
      body.category !==
      undefined
    ) {
      const category =
        clean(
          body.category,
        );

      if (!category) {
        throw new HttpError(
          "Expense category cannot be empty.",
          422,
        );
      }

      data.category =
        category;
    }

    /* ========================================================
       DESCRIPTION
    ======================================================== */

    if (
      body.description !==
      undefined
    ) {
      data.description =
        clean(
          body.description,
        );
    }

    /* ========================================================
       RECEIPT URL
    ======================================================== */

    if (
      body.receiptUrl !==
      undefined
    ) {
      data.receiptUrl =
        clean(
          body.receiptUrl,
        );
    }

    /* ========================================================
       AMOUNT
    ======================================================== */

    if (
      body.amount !==
      undefined
    ) {
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

      data.amount =
        amount;
    }

    /* ========================================================
       EXPENSE DATE
    ======================================================== */

    if (
      body.expenseDate !==
      undefined
    ) {
      const raw =
        clean(
          body.expenseDate,
        );

      if (!raw) {
        throw new HttpError(
          "Expense date cannot be empty.",
          422,
        );
      }

      const expenseDate =
        new Date(raw);

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

      data.expenseDate =
        expenseDate;
    }

    /* ========================================================
       NOTHING TO UPDATE
    ======================================================== */

    if (
      Object.keys(data)
        .length === 0
    ) {
      return NextResponse.json(
        {
          success: true,

          message:
            "No expense changes were supplied.",

          expense:
            serializeExpense(
              current,
            ),
        },
        {
          status: 200,
        },
      );
    }

    /* ========================================================
       UPDATE
    ======================================================== */

    const expense =
      await db.companyExpense.update(
        {
          where: {
            id,
          },

          data,
        },
      );

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
          "UPDATE_EXPENSE",

        module:
          "EXPENSES",

        details:
          `Updated expense ${id}.`,
      });
    } catch (
      auditError
    ) {
      console.error(
        "[UPDATE_EXPENSE_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Expense updated successfully.",

        expense:
          serializeExpense(
            expense,
          ),
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