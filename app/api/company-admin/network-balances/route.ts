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

function clean(
  value: unknown,
): string {
  return text(value).trim();
}

function normalizeNetwork(
  value: unknown,
): string {
  const raw = clean(value)
    .toUpperCase()
    .replace(/\s+/g, "_");

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
      ?.toLowerCase() || "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    throw new HttpError(
      "Network balance requests must use application/json.",
      415,
    );
  }
}

function readBalance(
  value: unknown,
  fieldName: string,
): number {
  const amount =
    toNumber(value);

  if (
    !Number.isFinite(amount)
  ) {
    throw new HttpError(
      `${fieldName} must be a valid number.`,
      422,
    );
  }

  if (amount < 0) {
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
   GET
   /api/company-admin/network-balances

   List network/SIM balances for current company.
============================================================ */

export async function GET(
  request: NextRequest,
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

    const db =
      prisma as any;

    const networkFilter =
      normalizeNetwork(
        request.nextUrl
          .searchParams
          .get("network"),
      );

    const search =
      clean(
        request.nextUrl
          .searchParams
          .get("search"),
      );

    const where:
      Record<string, any> = {
        companyId,
      };

    if (
      networkFilter &&
      networkFilter !== "ALL"
    ) {
      if (
        !NETWORKS.has(
          networkFilter,
        )
      ) {
        throw new HttpError(
          "Invalid network filter.",
          422,
        );
      }

      where.network =
        networkFilter;
    }

    if (search) {
      where.OR = [
        {
          simCardNumber: {
            contains:
              search,
          },
        },

        {
          accountName: {
            contains:
              search,
          },
        },

        {
          network: {
            contains:
              search.toUpperCase(),
          },
        },

        {
          updatedByName: {
            contains:
              search,
          },
        },
      ];
    }

    const balances =
      await db.networkBalance.findMany(
        {
          where,

          orderBy: [
            {
              network:
                "asc",
            },
            {
              simCardNumber:
                "asc",
            },
          ],
        },
      );

    const rows =
      balances.map(
        serializeBalance,
      );

    const totalFloat =
      rows.reduce(
        (
          sum: number,
          item: any,
        ) =>
          sum +
          Number(
            item.floatBalance ||
              0,
          ),
        0,
      );

    const totalCash =
      rows.reduce(
        (
          sum: number,
          item: any,
        ) =>
          sum +
          Number(
            item.cashBalance ||
              0,
          ),
        0,
      );

    return NextResponse.json(
      {
        success: true,

        balances:
          rows,

        total:
          rows.length,

        summary: {
          totalFloat,

          totalCash,

          grandTotal:
            totalFloat +
            totalCash,
        },
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
   /api/company-admin/network-balances

   Create OR update the same network + SIM.

   Example:
   VODACOM + 0755123456

   If it already exists:
   UPDATE

   If it does not exist:
   CREATE
============================================================ */

export async function POST(
  request: NextRequest,
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
        "Invalid network balance request. JSON data was expected.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       NETWORK
    ======================================================== */

    const network =
      normalizeNetwork(
        body.network,
      );

    if (!network) {
      throw new HttpError(
        "Network is required.",
        422,
      );
    }

    if (
      !NETWORKS.has(
        network,
      )
    ) {
      throw new HttpError(
        "Network must be VODACOM, YAS_MIX, AIRTEL, HALOTEL or OTHER.",
        422,
      );
    }

    /* ========================================================
       SIM NUMBER
    ======================================================== */

    const simCardNumber =
      clean(
        body.simCardNumber,
      )
        .replace(/\s+/g, "");

    if (!simCardNumber) {
      throw new HttpError(
        "SIM card number is required.",
        422,
      );
    }

    if (
      simCardNumber.length <
      6
    ) {
      throw new HttpError(
        "Enter a valid SIM card number.",
        422,
      );
    }

    if (
      simCardNumber.length >
      30
    ) {
      throw new HttpError(
        "SIM card number is too long.",
        422,
      );
    }

    /* ========================================================
       ACCOUNT NAME
    ======================================================== */

    const accountName =
      clean(
        body.accountName,
      );

    if (!accountName) {
      throw new HttpError(
        "Account name is required.",
        422,
      );
    }

    /* ========================================================
       FLOAT + CASH
    ======================================================== */

    const floatBalance =
      readBalance(
        body.floatBalance,
        "Float balance",
      );

    const cashBalance =
      readBalance(
        body.cashBalance,
        "Cash balance",
      );

    /* ========================================================
       FIND SAME NETWORK + SIM

       Important:
       Do not create duplicate records every time Admin clicks
       Save Balance.
    ======================================================== */

    const existing =
      await db.networkBalance.findFirst(
        {
          where: {
            companyId,

            network,

            simCardNumber,
          },
        },
      );

    let balance:
      any;

    let created =
      false;

    if (existing) {
      /* ======================================================
         UPDATE EXISTING RECORD
      ====================================================== */

      balance =
        await db.networkBalance.update(
          {
            where: {
              id:
                existing.id,
            },

            data: {
              accountName,

              floatBalance,

              cashBalance,

              updatedByName:
                user.name,
            },
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
            "UPDATE_NETWORK_BALANCE",

          module:
            "ACCOUNTING",

          details:
            `Updated ${network} ${simCardNumber}. Float: ${floatBalance}; Cash: ${cashBalance}.`,
        });
      } catch (
        auditError
      ) {
        console.error(
          "[UPDATE_NETWORK_BALANCE_AUDIT_ERROR]",
          auditError,
        );
      }
    } else {
      /* ======================================================
         CREATE NEW RECORD
      ====================================================== */

      try {
        balance =
          await db.networkBalance.create(
            {
              data: {
                companyId,

                network,

                simCardNumber,

                accountName,

                floatBalance,

                cashBalance,

                updatedByName:
                  user.name,
              },
            },
          );

        created =
          true;
      } catch (
        error: any
      ) {
        console.error(
          "[CREATE_NETWORK_BALANCE_DATABASE_ERROR]",
          error,
        );

        /*
         * If your Prisma model contains a unique
         * constraint for company/network/SIM.
         */
        if (
          error?.code ===
          "P2002"
        ) {
          /*
           * Another request may have created it between
           * findFirst() and create().
           *
           * Read it again and update instead.
           */
          const duplicate =
            await db.networkBalance.findFirst(
              {
                where: {
                  companyId,

                  network,

                  simCardNumber,
                },
              },
            );

          if (!duplicate) {
            throw new HttpError(
              "This network SIM balance already exists.",
              409,
            );
          }

          balance =
            await db.networkBalance.update(
              {
                where: {
                  id:
                    duplicate.id,
                },

                data: {
                  accountName,

                  floatBalance,

                  cashBalance,

                  updatedByName:
                    user.name,
                },
              },
            );

          created =
            false;
        } else {
          throw error;
        }
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
            created
              ? "CREATE_NETWORK_BALANCE"
              : "UPDATE_NETWORK_BALANCE",

          module:
            "ACCOUNTING",

          details:
            `${
              created
                ? "Registered"
                : "Updated"
            } ${network} ${simCardNumber}. Float: ${floatBalance}; Cash: ${cashBalance}.`,
        });
      } catch (
        auditError
      ) {
        console.error(
          "[SAVE_NETWORK_BALANCE_AUDIT_ERROR]",
          auditError,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,

        created,

        message:
          created
            ? "Network SIM balance registered successfully."
            : "Existing network SIM balance updated successfully.",

        balance:
          serializeBalance(
            balance,
          ),
      },
      {
        status:
          created
            ? 201
            : 200,

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