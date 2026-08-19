import bcrypt from "bcryptjs";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  createAudit,
  createNotification,
  requireCompanyAdmin,
  routeError,
  HttpError,
} from "@/lib/company-admin-server";

import {
  cleanEmail,
  cleanNida,
  cleanText,
  COMPANY_USER_ROLES,
  EDITABLE_USER_STATUSES,
  normalizeGender,
  normalizeRole,
  normalizeStatus,
  safeUser,
  USER_GENDERS,
  validEmail,
  validNida,
} from "@/lib/company-admin-user-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

async function getCompanyUser(
  id: string,
  companyId: string,
) {
  const db = prisma as any;

  const user =
    await db.user.findFirst({
      where: {
        id,

        companyId,

        role: {
          notIn: [
            "SUPER_ADMIN",
            "SYSTEM_DEVELOPER",
          ],
        },
      },
    });

  if (!user) {
    throw new HttpError(
      "User was not found in your company.",
      404,
    );
  }

  return user;
}

/**
 * Protect the final ACTIVE Company Admin.
 */
async function ensureAnotherActiveCompanyAdmin(
  companyId: string,
  excludedUserId: string,
) {
  const db = prisma as any;

  const anotherAdmin =
    await db.user.findFirst({
      where: {
        companyId,

        id: {
          not: excludedUserId,
        },

        role:
          "COMPANY_ADMIN",

        status:
          "ACTIVE",
      },

      select: {
        id: true,
      },
    });

  if (!anotherAdmin) {
    throw new HttpError(
      "This action cannot be completed because the company must have at least one active Company Admin.",
      422,
    );
  }
}

/**
 * ============================================================
 * PATCH /api/company-admin/users/:id
 * ============================================================
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const sessionUser =
      await requireCompanyAdmin();

    const companyId =
      cleanText(
        sessionUser.companyId,
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
        "User ID is required.",
        400,
      );
    }

    const target =
      await getCompanyUser(
        id,
        companyId,
      );

    let body: Record<
      string,
      any
    >;

    try {
      body =
        await request.json();
    } catch {
      throw new HttpError(
        "Invalid request body.",
        400,
      );
    }

    const db = prisma as any;

    const data: Record<
      string,
      any
    > = {};

    /**
     * ========================================================
     * NAME
     * ========================================================
     */

    if (
      body.name !== undefined
    ) {
      const name =
        cleanText(body.name);

      if (!name) {
        throw new HttpError(
          "Name cannot be empty.",
          422,
        );
      }

      if (name.length < 2) {
        throw new HttpError(
          "Name must contain at least 2 characters.",
          422,
        );
      }

      data.name = name;
    }

    /**
     * ========================================================
     * EMAIL
     * ========================================================
     */

    if (
      body.email !== undefined
    ) {
      const email =
        cleanEmail(body.email);

      if (!email) {
        throw new HttpError(
          "Email address cannot be empty.",
          422,
        );
      }

      if (!validEmail(email)) {
        throw new HttpError(
          "Enter a valid email address.",
          422,
        );
      }

      const duplicate =
        await db.user.findFirst({
          where: {
            email,

            id: {
              not: id,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        throw new HttpError(
          "Email address is already registered.",
          409,
        );
      }

      data.email = email;
    }

    /**
     * ========================================================
     * PHONE
     * ========================================================
     */

    if (
      body.phone !== undefined
    ) {
      const phone =
        cleanText(body.phone);

      if (!phone) {
        data.phone = null;
      } else {
        if (
          phone.length < 7
        ) {
          throw new HttpError(
            "Enter a valid phone number.",
            422,
          );
        }

        data.phone = phone;
      }
    }

    /**
     * ========================================================
     * NATIONALITY
     * ========================================================
     */

    if (
      body.nationality !==
      undefined
    ) {
      const value =
        cleanText(
          body.nationality,
        );

      data.nationality =
        value || null;
    }

    /**
     * ========================================================
     * PHYSICAL ADDRESS
     * ========================================================
     */

    if (
      body.physicalAddress !==
      undefined
    ) {
      const value =
        cleanText(
          body.physicalAddress,
        );

      data.physicalAddress =
        value || null;
    }

    /**
     * ========================================================
     * REGION
     * ========================================================
     */

    if (
      body.assignedRegion !==
      undefined
    ) {
      const value =
        cleanText(
          body.assignedRegion,
        );

      data.assignedRegion =
        value || null;
    }

    /**
     * ========================================================
     * PROFILE IMAGE
     * ========================================================
     */

    if (
      body.profileImageUrl !==
      undefined
    ) {
      const value =
        cleanText(
          body.profileImageUrl,
        );

      data.profileImageUrl =
        value || null;
    }

    /**
     * ========================================================
     * GENDER
     * ========================================================
     */

    if (
      body.gender !== undefined
    ) {
      const gender =
        normalizeGender(
          body.gender,
        );

      if (!gender) {
        data.gender = null;
      } else {
        if (
          !USER_GENDERS.has(
            gender,
          )
        ) {
          throw new HttpError(
            "Gender must be MALE, FEMALE or OTHER.",
            422,
          );
        }

        data.gender =
          gender;
      }
    }

    /**
     * ========================================================
     * NIDA
     * ========================================================
     */

    if (
      body.nidaNumber !==
      undefined
    ) {
      const nidaNumber =
        cleanNida(
          body.nidaNumber,
        );

      if (!nidaNumber) {
        data.nidaNumber =
          null;
      } else {
        if (
          !validNida(
            nidaNumber,
          )
        ) {
          throw new HttpError(
            "NIDA number must contain exactly 20 digits.",
            422,
          );
        }

        const duplicate =
          await db.user.findFirst({
            where: {
              companyId,

              nidaNumber,

              id: {
                not: id,
              },

              status: {
                not:
                  "REMOVED",
              },
            },

            select: {
              id: true,
            },
          });

        if (duplicate) {
          throw new HttpError(
            "NIDA number is already registered.",
            409,
          );
        }

        data.nidaNumber =
          nidaNumber;
      }
    }

    /**
     * ========================================================
     * DATE OF BIRTH
     * ========================================================
     */

    if (
      body.dateOfBirth !==
      undefined
    ) {
      const value =
        cleanText(
          body.dateOfBirth,
        );

      if (!value) {
        data.dateOfBirth =
          null;
      } else {
        const date =
          new Date(value);

        if (
          Number.isNaN(
            date.getTime(),
          )
        ) {
          throw new HttpError(
            "Enter a valid date of birth.",
            422,
          );
        }

        if (
          date >= new Date()
        ) {
          throw new HttpError(
            "Date of birth must be in the past.",
            422,
          );
        }

        data.dateOfBirth =
          date;
      }
    }

    /**
     * ========================================================
     * BRANCH
     * ========================================================
     */

    if (
      body.branchId !==
      undefined
    ) {
      const branchId =
        cleanText(
          body.branchId,
        );

      if (!branchId) {
        data.branchId =
          null;
      } else {
        const branch =
          await db.branch.findFirst({
            where: {
              id: branchId,
              companyId,
            },

            select: {
              id: true,
            },
          });

        if (!branch) {
          throw new HttpError(
            "Selected branch was not found in your company.",
            404,
          );
        }

        data.branchId =
          branchId;
      }
    }

    /**
     * ========================================================
     * ROLE
     * ========================================================
     */

    if (
      body.role !== undefined
    ) {
      const newRole =
        normalizeRole(
          body.role,
        );

      if (
        !COMPANY_USER_ROLES.has(
          newRole,
        )
      ) {
        throw new HttpError(
          "Invalid user role.",
          422,
        );
      }

      const currentRole =
        normalizeRole(
          target.role,
        );

      /**
       * Do not allow the logged-in Company Admin
       * to demote their own account.
       */
      if (
        id === sessionUser.id &&
        newRole !==
          "COMPANY_ADMIN"
      ) {
        throw new HttpError(
          "You cannot remove your own Company Admin privileges.",
          422,
        );
      }

      /**
       * If changing another Company Admin
       * into another role, make sure at least
       * one active admin remains.
       */
      if (
        currentRole ===
          "COMPANY_ADMIN" &&
        newRole !==
          "COMPANY_ADMIN" &&
        normalizeStatus(
          target.status,
        ) === "ACTIVE"
      ) {
        await ensureAnotherActiveCompanyAdmin(
          companyId,
          id,
        );
      }

      data.role =
        newRole;
    }

    /**
     * ========================================================
     * STATUS
     * ========================================================
     */

    if (
      body.status !==
      undefined
    ) {
      const newStatus =
        normalizeStatus(
          body.status,
        );

      if (
        !EDITABLE_USER_STATUSES.has(
          newStatus,
        )
      ) {
        throw new HttpError(
          "User status must be ACTIVE or SUSPENDED.",
          422,
        );
      }

      const oldStatus =
        normalizeStatus(
          target.status,
        );

      /**
       * Company Admin cannot suspend themselves.
       */
      if (
        id === sessionUser.id &&
        newStatus !==
          "ACTIVE"
      ) {
        throw new HttpError(
          "You cannot suspend your own Company Admin account.",
          422,
        );
      }

      /**
       * Prevent suspension of the final active
       * Company Admin.
       */
      if (
        normalizeRole(
          target.role,
        ) ===
          "COMPANY_ADMIN" &&
        oldStatus ===
          "ACTIVE" &&
        newStatus ===
          "SUSPENDED"
      ) {
        await ensureAnotherActiveCompanyAdmin(
          companyId,
          id,
        );
      }

      data.status =
        newStatus;
    }

    /**
     * ========================================================
     * PASSWORD
     * ========================================================
     */

    if (
      body.password !==
      undefined
    ) {
      const password =
        String(
          body.password ?? "",
        );

      if (password) {
        if (
          password.length < 8
        ) {
          throw new HttpError(
            "Password must contain at least 8 characters.",
            422,
          );
        }

        if (
          password.length >
          128
        ) {
          throw new HttpError(
            "Password is too long.",
            422,
          );
        }

        data.passwordHash =
          await bcrypt.hash(
            password,
            12,
          );
      }
    }

    /**
     * ========================================================
     * NOTHING TO UPDATE
     * ========================================================
     */

    if (
      Object.keys(data)
        .length === 0
    ) {
      throw new HttpError(
        "No valid changes were supplied.",
        422,
      );
    }

    /**
     * ========================================================
     * UPDATE USER
     * ========================================================
     */

    let updated;

    try {
      updated =
        await db.user.update({
          where: {
            id,
          },

          data,
        });
    } catch (error: any) {
      if (
        error?.code ===
        "P2002"
      ) {
        throw new HttpError(
          "Another user already uses one of these unique details.",
          409,
        );
      }

      throw error;
    }

    /**
     * ========================================================
     * STATUS NOTIFICATION
     * ========================================================
     */

    const previousStatus =
      normalizeStatus(
        target.status,
      );

    const resultingStatus =
      data.status
        ? normalizeStatus(
            data.status,
          )
        : previousStatus;

    if (
      data.status &&
      previousStatus !==
        resultingStatus
    ) {
      try {
        await createNotification({
          companyId,

          targetUserId: id,

          title:
            resultingStatus ===
            "ACTIVE"
              ? "Account activated"
              : "Account suspended",

          message:
            resultingStatus ===
            "ACTIVE"
              ? `${sessionUser.name} activated your account.`
              : `${sessionUser.name} suspended your account.`,

          type:
            resultingStatus ===
            "ACTIVE"
              ? "SUCCESS"
              : "WARNING",

          link:
            "/dashboard",
        });
      } catch (error) {
        console.error(
          "[UPDATE_USER_NOTIFICATION_ERROR]",
          error,
        );
      }
    }

    /**
     * ========================================================
     * AUDIT
     * ========================================================
     */

    try {
      await createAudit({
        companyId,

        actorId:
          sessionUser.id,

        actorName:
          sessionUser.name,

        actorRole:
          sessionUser.role,

        action:
          "UPDATE_USER",

        module:
          "USERS",

        details:
          `Updated ${cleanText(target.name)} (${id}). ` +
          `Fields: ${Object.keys(data).join(", ")}.`,
      });
    } catch (error) {
      console.error(
        "[UPDATE_USER_AUDIT_ERROR]",
        error,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "User updated successfully.",

        user:
          safeUser(updated),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return routeError(error);
  }
}

/**
 * ============================================================
 * DELETE /api/company-admin/users/:id
 * ============================================================
 *
 * Soft delete.
 *
 * We do not physically DELETE database records because other
 * records may reference this user.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const sessionUser =
      await requireCompanyAdmin();

    const companyId =
      cleanText(
        sessionUser.companyId,
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
        "User ID is required.",
        400,
      );
    }

    /**
     * Never remove yourself.
     */
    if (
      id === sessionUser.id
    ) {
      throw new HttpError(
        "You cannot remove your own account.",
        422,
      );
    }

    const target =
      await getCompanyUser(
        id,
        companyId,
      );

    const db = prisma as any;

    /**
     * Already removed.
     */
    if (
      normalizeStatus(
        target.status,
      ) === "REMOVED"
    ) {
      return NextResponse.json({
        success: true,

        message:
          "User has already been removed.",
      });
    }

    /**
     * Protect final active Company Admin.
     */
    if (
      normalizeRole(
        target.role,
      ) ===
        "COMPANY_ADMIN" &&
      normalizeStatus(
        target.status,
      ) ===
        "ACTIVE"
    ) {
      await ensureAnotherActiveCompanyAdmin(
        companyId,
        id,
      );
    }

    /**
     * Soft delete.
     */
    await db.user.update({
      where: {
        id,
      },

      data: {
        status:
          "REMOVED",
      },
    });

    /**
     * Audit.
     */
    try {
      await createAudit({
        companyId,

        actorId:
          sessionUser.id,

        actorName:
          sessionUser.name,

        actorRole:
          sessionUser.role,

        action:
          "REMOVE_USER",

        module:
          "USERS",

        details:
          `Removed user ${cleanText(target.name)} (${id}).`,
      });
    } catch (error) {
      console.error(
        "[REMOVE_USER_AUDIT_ERROR]",
        error,
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "User removed successfully.",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return routeError(error);
  }
}