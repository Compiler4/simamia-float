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
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const statuses = new Set([
  "ACTIVE",
  "SUSPENDED",
]);

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
      "Branch requests must use application/json.",
      415,
    );
  }
}

/* ============================================================
   GET
   /api/company-admin/branches
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

    const search =
      clean(
        request.nextUrl.searchParams.get(
          "search",
        ),
      );

    const status =
      clean(
        request.nextUrl.searchParams.get(
          "status",
        ),
      ).toUpperCase();

    const where:
      Record<string, any> = {
        companyId,
      };

    /* --------------------------------------------------------
       STATUS FILTER
    -------------------------------------------------------- */

    if (
      status &&
      status !== "ALL"
    ) {
      if (
        !statuses.has(
          status,
        )
      ) {
        throw new HttpError(
          "Branch status must be ACTIVE or SUSPENDED.",
          422,
        );
      }

      where.status =
        status;
    }

    /* --------------------------------------------------------
       SEARCH
    -------------------------------------------------------- */

    if (search) {
      where.OR = [
        {
          name: {
            contains:
              search,
          },
        },

        {
          code: {
            contains:
              search,
          },
        },

        {
          region: {
            contains:
              search,
          },
        },

        {
          address: {
            contains:
              search,
          },
        },
      ];
    }

    /* --------------------------------------------------------
       LOAD BRANCHES
    -------------------------------------------------------- */

    const branches =
      await db.branch.findMany({
        where,

        orderBy: {
          name: "asc",
        },
      });

    return NextResponse.json(
      {
        success: true,

        branches,

        total:
          branches.length,

        summary: {
          active:
            branches.filter(
              (
                branch: any,
              ) =>
                branch.status ===
                "ACTIVE",
            ).length,

          suspended:
            branches.filter(
              (
                branch: any,
              ) =>
                branch.status ===
                "SUSPENDED",
            ).length,
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
   /api/company-admin/branches

   CREATE NEW BRANCH
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
     * Branch creation is JSON.
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
        "Invalid branch request. JSON data was expected.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       NORMALIZE
    ======================================================== */

    const name =
      clean(body.name);

    const code =
      clean(
        body.code,
      ).toUpperCase();

    const region =
      clean(
        body.region,
      );

    const address =
      clean(
        body.address,
      );

    const status =
      clean(
        body.status ||
          "ACTIVE",
      ).toUpperCase();

    /* ========================================================
       VALIDATION
    ======================================================== */

    if (!name) {
      throw new HttpError(
        "Branch name is required.",
        422,
      );
    }

    if (
      name.length < 2
    ) {
      throw new HttpError(
        "Branch name must contain at least 2 characters.",
        422,
      );
    }

    if (
      name.length > 150
    ) {
      throw new HttpError(
        "Branch name cannot exceed 150 characters.",
        422,
      );
    }

    if (!code) {
      throw new HttpError(
        "Branch code is required.",
        422,
      );
    }

    if (
      code.length < 2
    ) {
      throw new HttpError(
        "Branch code must contain at least 2 characters.",
        422,
      );
    }

    if (
      code.length > 50
    ) {
      throw new HttpError(
        "Branch code cannot exceed 50 characters.",
        422,
      );
    }

    /*
     * Keep branch codes clean.
     *
     * Example:
     * DODOMA-001
     * DSM-HQ
     */
    if (
      !/^[A-Z0-9_-]+$/.test(
        code,
      )
    ) {
      throw new HttpError(
        "Branch code may contain only letters, numbers, hyphens and underscores.",
        422,
      );
    }

    if (
      !statuses.has(
        status,
      )
    ) {
      throw new HttpError(
        "Branch status must be ACTIVE or SUSPENDED.",
        422,
      );
    }

    /* ========================================================
       DUPLICATE CODE
    ======================================================== */

    const duplicateCode =
      await db.branch.findFirst({
        where: {
          companyId,
          code,
        },

        select: {
          id: true,
        },
      });

    if (duplicateCode) {
      throw new HttpError(
        "This branch code is already registered.",
        409,
      );
    }

    /* ========================================================
       OPTIONAL DUPLICATE NAME PROTECTION
    ======================================================== */

    const duplicateName =
      await db.branch.findFirst({
        where: {
          companyId,
          name,
        },

        select: {
          id: true,
        },
      });

    if (duplicateName) {
      throw new HttpError(
        "A branch with this name already exists.",
        409,
      );
    }

    /* ========================================================
       CREATE
    ======================================================== */

    let branch:
      any;

    try {
      branch =
        await db.branch.create({
          data: {
            companyId,

            name,

            code,

            region,

            address,

            status,
          },
        });
    } catch (error: any) {
      console.error(
        "[CREATE_BRANCH_DATABASE_ERROR]",
        error,
      );

      /*
       * Prisma unique constraint violation.
       */
      if (
        error?.code ===
        "P2002"
      ) {
        throw new HttpError(
          "A branch with the same unique information already exists.",
          409,
        );
      }

      throw error;
    }

    /* ========================================================
       AUDIT

       Do not make successful branch creation look failed
       just because audit logging failed afterwards.
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
          "CREATE_BRANCH",

        module:
          "BRANCHES",

        details:
          `Created branch ${branch.name} (${branch.code}).`,
      });
    } catch (
      auditError
    ) {
      console.error(
        "[CREATE_BRANCH_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Branch created successfully.",

        branch,
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