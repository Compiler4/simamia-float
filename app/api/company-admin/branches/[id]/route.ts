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

const statuses =
  new Set([
    "ACTIVE",
    "SUSPENDED",
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
      "Branch updates must use application/json.",
      415,
    );
  }
}

/* ============================================================
   PATCH
   /api/company-admin/branches/:id
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
        "Branch ID is required.",
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
        "Invalid branch update request.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       MAKE SURE BRANCH BELONGS TO CURRENT COMPANY
    ======================================================== */

    const current =
      await db.branch.findFirst({
        where: {
          id,
          companyId,
        },
      });

    if (!current) {
      throw new HttpError(
        "Branch not found.",
        404,
      );
    }

    const data:
      Record<string, unknown> =
      {};

    /* ========================================================
       NAME
    ======================================================== */

    if (
      body.name !==
      undefined
    ) {
      const name =
        clean(
          body.name,
        );

      if (!name) {
        throw new HttpError(
          "Branch name cannot be empty.",
          422,
        );
      }

      if (
        name.length <
        2
      ) {
        throw new HttpError(
          "Branch name must contain at least 2 characters.",
          422,
        );
      }

      if (
        name.length >
        150
      ) {
        throw new HttpError(
          "Branch name cannot exceed 150 characters.",
          422,
        );
      }

      data.name =
        name;
    }

    /* ========================================================
       CODE
    ======================================================== */

    if (
      body.code !==
      undefined
    ) {
      const code =
        clean(
          body.code,
        ).toUpperCase();

      if (!code) {
        throw new HttpError(
          "Branch code cannot be empty.",
          422,
        );
      }

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

      const duplicate =
        await db.branch.findFirst({
          where: {
            companyId,

            code,

            NOT: {
              id,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        throw new HttpError(
          "This branch code is already registered.",
          409,
        );
      }

      data.code =
        code;
    }

    /* ========================================================
       REGION

       Frontend does not require it, so allow empty string.
    ======================================================== */

    if (
      body.region !==
      undefined
    ) {
      data.region =
        clean(
          body.region,
        );
    }

    /* ========================================================
       ADDRESS

       Frontend does not require it, so allow empty string.
    ======================================================== */

    if (
      body.address !==
      undefined
    ) {
      data.address =
        clean(
          body.address,
        );
    }

    /* ========================================================
       STATUS
    ======================================================== */

    if (
      body.status !==
      undefined
    ) {
      const status =
        clean(
          body.status,
        ).toUpperCase();

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

      data.status =
        status;
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
            "No branch changes were supplied.",

          branch:
            current,
        },
        {
          status: 200,
        },
      );
    }

    /* ========================================================
       UPDATE
    ======================================================== */

    let branch:
      any;

    try {
      branch =
        await db.branch.update({
          where: {
            id,
          },

          data,
        });
    } catch (error: any) {
      console.error(
        "[UPDATE_BRANCH_DATABASE_ERROR]",
        error,
      );

      if (
        error?.code ===
        "P2002"
      ) {
        throw new HttpError(
          "A branch with this code or unique information already exists.",
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
          "UPDATE_BRANCH",

        module:
          "BRANCHES",

        details:
          `Updated branch ${current.name}.`,
      });
    } catch (
      auditError
    ) {
      console.error(
        "[UPDATE_BRANCH_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Branch updated successfully.",

        branch,
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
   DELETE
   /api/company-admin/branches/:id
============================================================ */

export async function DELETE(
  _request: NextRequest,
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
        "Branch ID is required.",
        400,
      );
    }

    const db =
      prisma as any;

    /* ========================================================
       FIND BRANCH
    ======================================================== */

    const current =
      await db.branch.findFirst({
        where: {
          id,
          companyId,
        },
      });

    if (!current) {
      throw new HttpError(
        "Branch not found.",
        404,
      );
    }

    /* ========================================================
       CHECK ASSIGNED USERS
    ======================================================== */

    const assigned =
      await db.user.count({
        where: {
          companyId,

          branchId:
            id,

          NOT: {
            status:
              "REMOVED",
          },
        },
      });

    if (
      assigned > 0
    ) {
      throw new HttpError(
        `This branch still has ${assigned} active company user${
          assigned === 1
            ? ""
            : "s"
        }. Move them to another branch before removing it.`,
        409,
      );
    }

    /* ========================================================
       DELETE
    ======================================================== */

    try {
      await db.branch.delete({
        where: {
          id,
        },
      });
    } catch (error: any) {
      console.error(
        "[DELETE_BRANCH_DATABASE_ERROR]",
        error,
      );

      /*
       * Foreign key constraint.
       *
       * Other historical records may still reference this branch.
       */
      if (
        error?.code ===
        "P2003"
      ) {
        throw new HttpError(
          "This branch is still referenced by historical system records. Suspend it instead of deleting it.",
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
          "DELETE_BRANCH",

        module:
          "BRANCHES",

        details:
          `Removed branch ${current.name}.`,
      });
    } catch (
      auditError
    ) {
      console.error(
        "[DELETE_BRANCH_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Branch removed successfully.",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return routeError(
      error,
    );
  }
}