import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  createAudit,
  requireCompanyMember,
  routeError,
  text,
  toNumber,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NETWORKS = new Set([
  "VODACOM",
  "YAS_MIX",
  "AIRTEL",
  "HALOTEL",
  "OTHER",
]);

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

function normalizeNetwork(
  value: unknown,
): string {
  const raw =
    clean(value)
      .toUpperCase()
      .replace(
        /\s+/g,
        "_",
      );

  if (
    raw === "YAS" ||
    raw === "MIX" ||
    raw === "MIX_BY_YAS" ||
    raw === "YAS_MIX"
  ) {
    return "YAS_MIX";
  }

  return raw;
}

function assertJsonRequest(
  request: NextRequest,
) {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ||
    "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    throw new HttpError(
      "Network balance updates must use application/json.",
      415,
    );
  }
}

function readBalance(
  value: unknown,
  fieldName: string,
): number {
  const amount =
    toNumber(
      value,
    );

  if (
    !Number.isFinite(
      amount,
    )
  ) {
    throw new HttpError(
      `${fieldName} must be a valid number.`,
      422,
    );
  }

  if (
    amount < 0
  ) {
    throw new HttpError(
      `${fieldName} cannot be negative.`,
      422,
    );
  }

  return amount;
}

function serializeBalance(
  balance: any,
) {
  if (!balance) {
    return balance;
  }

  return {
    ...balance,

    floatBalance:
      Number(
        balance.floatBalance ??
          0,
      ),

    cashBalance:
      Number(
        balance.cashBalance ??
          0,
      ),

    totalBalance:
      Number(
        balance.floatBalance ??
          0,
      ) +
      Number(
        balance.cashBalance ??
          0,
      ),
  };
}

/* ============================================================
   PATCH
   /api/company-admin/network-balances/:id
============================================================ */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const user =
      await requireCompanyMember([
        "COMPANY_ADMIN",
        "ACCOUNTANT",
      ]);

    const companyId =
      clean(
        user.companyId,
      );

    if (!companyId) {
      throw new HttpError(
        "Your account is not connected to a company.",
        403,
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      throw new HttpError(
        "Network balance ID is required.",
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
        "Invalid network balance update.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       FIND COMPANY RECORD
    ======================================================== */

    const existing =
      await db.networkBalance.findFirst(
        {
          where: {
            id,

            companyId,
          },
        },
      );

    if (!existing) {
      throw new HttpError(
        "Network balance record not found.",
        404,
      );
    }

    const data:
      Record<string, unknown> = {
        updatedByName:
          user.name,
      };

    /* ========================================================
       ACCOUNT NAME
    ======================================================== */

    if (
      body.accountName !==
      undefined
    ) {
      const accountName =
        clean(
          body.accountName,
        );

      if (!accountName) {
        throw new HttpError(
          "Account name cannot be empty.",
          422,
        );
      }

      data.accountName =
        accountName;
    }

    /* ========================================================
       FLOAT
    ======================================================== */

    if (
      body.floatBalance !==
      undefined
    ) {
      data.floatBalance =
        readBalance(
          body.floatBalance,
          "Float balance",
        );
    }

    /* ========================================================
       CASH
    ======================================================== */

    if (
      body.cashBalance !==
      undefined
    ) {
      data.cashBalance =
        readBalance(
          body.cashBalance,
          "Cash balance",
        );
    }

    /* ========================================================
       NETWORK

       Optional, but supports future editing.
    ======================================================== */

    let newNetwork =
      existing.network;

    if (
      body.network !==
      undefined
    ) {
      newNetwork =
        normalizeNetwork(
          body.network,
        );

      if (
        !NETWORKS.has(
          newNetwork,
        )
      ) {
        throw new HttpError(
          "Invalid mobile network.",
          422,
        );
      }

      data.network =
        newNetwork;
    }

    /* ========================================================
       SIM NUMBER
    ======================================================== */

    let newSimCardNumber =
      existing.simCardNumber;

    if (
      body.simCardNumber !==
      undefined
    ) {
      newSimCardNumber =
        clean(
          body.simCardNumber,
        )
          .replace(
            /\s+/g,
            "",
          );

      if (!newSimCardNumber) {
        throw new HttpError(
          "SIM card number cannot be empty.",
          422,
        );
      }

      data.simCardNumber =
        newSimCardNumber;
    }

    /* ========================================================
       DUPLICATE PROTECTION

       Needed when changing network or SIM.
    ======================================================== */

    if (
      body.network !== undefined ||
      body.simCardNumber !==
        undefined
    ) {
      const duplicate =
        await db.networkBalance.findFirst(
          {
            where: {
              companyId,

              network:
                newNetwork,

              simCardNumber:
                newSimCardNumber,

              NOT: {
                id,
              },
            },

            select: {
              id: true,
            },
          },
        );

      if (duplicate) {
        throw new HttpError(
          "Another balance record already uses this network and SIM card number.",
          409,
        );
      }
    }

    /* ========================================================
       UPDATE
    ======================================================== */

    let balance:
      any;

    try {
      balance =
        await db.networkBalance.update(
          {
            where: {
              id,
            },

            data,
          },
        );
    } catch (
      error: any
    ) {
      console.error(
        "[NETWORK_BALANCE_UPDATE_DATABASE_ERROR]",
        error,
      );

      if (
        error?.code ===
        "P2002"
      ) {
        throw new HttpError(
          "A balance record for this network and SIM already exists.",
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
          "UPDATE_NETWORK_BALANCE",

        module:
          "ACCOUNTING",

        details:
          `Updated ${existing.network} ${existing.simCardNumber}.`,
      });
    } catch (
      auditError
    ) {
      console.error(
        "[NETWORK_BALANCE_UPDATE_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Network balance updated successfully.",

        balance:
          serializeBalance(
            balance,
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