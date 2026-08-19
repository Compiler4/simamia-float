import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  createAudit,
  createNotification,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   ALLOWED VALUES
============================================================ */

const allowedRoles = new Set([
  "COMPANY_ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "GPS_MANAGER",
]);

const allowedGenders = new Set([
  "MALE",
  "FEMALE",
  "OTHER",
]);

const allowedStatuses = new Set([
  "ACTIVE",
  "SUSPENDED",
]);

/* ============================================================
   GENERAL HELPERS
============================================================ */

function cleanText(value: unknown): string {
  return text(value).trim();
}

function cleanEmail(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function cleanNida(value: unknown): string {
  return cleanText(value).replace(/\s+/g, "");
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validNida(value: string): boolean {
  return /^\d{20}$/.test(value);
}

function safeUser(user: any) {
  if (!user) {
    return user;
  }

  const {
    passwordHash: _passwordHash,
    password: _password,
    resetPasswordToken: _resetPasswordToken,
    passwordResetToken: _passwordResetToken,
    ...safe
  } = user;

  return safe;
}

/* ============================================================
   USERNAME HELPERS
============================================================ */

/**
 * Converts:
 *
 * Baraka Nicolaus -> baraka.nicolaus
 * Baraka@Example.com -> baraka
 *
 * Only letters, numbers, dot, underscore and dash remain.
 */
function normalizeUsername(value: unknown): string {
  let username = cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");

  if (username.length > 40) {
    username = username.slice(0, 40);
  }

  return username;
}

/**
 * Automatically creates a base username.
 *
 * Priority:
 *
 * 1. username submitted by frontend
 * 2. email before @
 * 3. person's name
 */
function usernameBase(
  requestedUsername: unknown,
  email: string,
  name: string,
): string {
  const requested = normalizeUsername(
    requestedUsername,
  );

  if (requested) {
    return requested;
  }

  const emailPart = normalizeUsername(
    email.split("@")[0],
  );

  if (emailPart) {
    return emailPart;
  }

  const namePart = normalizeUsername(name);

  if (namePart) {
    return namePart;
  }

  return "user";
}

/**
 * Generates a unique username inside the database.
 *
 * Example:
 *
 * barakanicolaus4
 * barakanicolaus4.2
 * barakanicolaus4.3
 */
async function generateUniqueUsername(
  db: any,
  requestedUsername: unknown,
  email: string,
  name: string,
): Promise<string> {
  let base = usernameBase(
    requestedUsername,
    email,
    name,
  );

  if (base.length < 3) {
    base = `user.${base || "account"}`;
  }

  if (base.length > 32) {
    base = base.slice(0, 32);
  }

  let candidate = base;

  for (let counter = 1; counter <= 1000; counter++) {
    const existing =
      await db.user.findFirst({
        where: {
          username: candidate,
        },

        select: {
          id: true,
        },
      });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}.${counter + 1}`;
  }

  /**
   * Extremely unlikely fallback.
   */
  return `${base}.${Date.now()
    .toString(36)
    .slice(-8)}`;
}

/* ============================================================
   GET /api/company-admin/users
============================================================ */

export async function GET(
  request: NextRequest,
) {
  try {
    const sessionUser =
      await requireCompanyAdmin();

    const companyId = cleanText(
      sessionUser.companyId,
    );

    if (!companyId) {
      throw new HttpError(
        "Your Company Admin account is not connected to a company.",
        403,
      );
    }

    const db = prisma as any;

    const searchParams =
      request.nextUrl.searchParams;

    const search = cleanText(
      searchParams.get("search"),
    );

    const role = cleanText(
      searchParams.get("role"),
    ).toUpperCase();

    const status = cleanText(
      searchParams.get("status"),
    ).toUpperCase();

    const branchId = cleanText(
      searchParams.get("branchId"),
    );

    const where: Record<string, any> = {
      companyId,

      role: {
        notIn: [
          "SUPER_ADMIN",
          "SYSTEM_DEVELOPER",
        ],
      },

      status: {
        not: "REMOVED",
      },
    };

    /* --------------------------------------------------------
       ROLE FILTER
    -------------------------------------------------------- */

    if (role && role !== "ALL") {
      if (!allowedRoles.has(role)) {
        throw new HttpError(
          "Invalid user role filter.",
          422,
        );
      }

      where.role = role;
    }

    /* --------------------------------------------------------
       STATUS FILTER
    -------------------------------------------------------- */

    if (status && status !== "ALL") {
      if (!allowedStatuses.has(status)) {
        throw new HttpError(
          "Invalid user status filter.",
          422,
        );
      }

      where.status = status;
    }

    /* --------------------------------------------------------
       BRANCH FILTER
    -------------------------------------------------------- */

    if (
      branchId &&
      branchId !== "ALL"
    ) {
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
          "Selected branch was not found.",
          404,
        );
      }

      where.branchId = branchId;
    }

    /* --------------------------------------------------------
       SEARCH
    -------------------------------------------------------- */

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
          },
        },

        {
          username: {
            contains: search.toLowerCase(),
          },
        },

        {
          email: {
            contains: search,
          },
        },

        {
          phone: {
            contains: search,
          },
        },

        {
          nidaNumber: {
            contains:
              search.replace(/\s+/g, ""),
          },
        },

        {
          assignedRegion: {
            contains: search,
          },
        },
      ];
    }

    /* --------------------------------------------------------
       LOAD USERS
    -------------------------------------------------------- */

    const users =
      await db.user.findMany({
        where,

        orderBy: {
          createdAt: "desc",
        },
      });

    const safeUsers =
      users.map(safeUser);

    /* --------------------------------------------------------
       STATISTICS
    -------------------------------------------------------- */

    const statistics = {
      total: users.length,

      active: users.filter(
        (user: any) =>
          cleanText(user.status)
            .toUpperCase() ===
          "ACTIVE",
      ).length,

      suspended: users.filter(
        (user: any) =>
          cleanText(user.status)
            .toUpperCase() ===
          "SUSPENDED",
      ).length,

      companyAdmins:
        users.filter(
          (user: any) =>
            cleanText(user.role)
              .toUpperCase() ===
            "COMPANY_ADMIN",
        ).length,

      accountants:
        users.filter(
          (user: any) =>
            cleanText(user.role)
              .toUpperCase() ===
            "ACCOUNTANT",
        ).length,

      staff:
        users.filter(
          (user: any) =>
            cleanText(user.role)
              .toUpperCase() ===
            "STAFF",
        ).length,

      gpsManagers:
        users.filter(
          (user: any) =>
            cleanText(user.role)
              .toUpperCase() ===
            "GPS_MANAGER",
        ).length,
    };

    return NextResponse.json(
      {
        success: true,
        users: safeUsers,
        statistics,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}

/* ============================================================
   POST /api/company-admin/users
============================================================ */

export async function POST(
  request: NextRequest,
) {
  try {
    /* --------------------------------------------------------
       AUTHENTICATION
    -------------------------------------------------------- */

    const sessionUser =
      await requireCompanyAdmin();

    const companyId = cleanText(
      sessionUser.companyId,
    );

    if (!companyId) {
      throw new HttpError(
        "Your Company Admin account is not connected to a company.",
        403,
      );
    }

    /* --------------------------------------------------------
       REQUEST BODY
    -------------------------------------------------------- */

    let body: Record<string, any>;

    try {
      body = await request.json();
    } catch {
      throw new HttpError(
        "Invalid request body. JSON data was expected.",
        400,
      );
    }

    const db = prisma as any;

    /* --------------------------------------------------------
       NORMALIZE DATA
    -------------------------------------------------------- */

    const name = cleanText(
      body.name,
    );

    const email = cleanEmail(
      body.email,
    );

    const phone = cleanText(
      body.phone,
    );

    const password = String(
      body.password ?? "",
    );

    const role = cleanText(
      body.role,
    ).toUpperCase();

    const status = cleanText(
      body.status || "ACTIVE",
    ).toUpperCase();

    const gender = cleanText(
      body.gender,
    ).toUpperCase();

    const nidaNumber = cleanNida(
      body.nidaNumber,
    );

    const nationality =
      cleanText(
        body.nationality,
      );

    const physicalAddress =
      cleanText(
        body.physicalAddress,
      );

    const assignedRegion =
      cleanText(
        body.assignedRegion,
      );

    const profileImageUrl =
      cleanText(
        body.profileImageUrl,
      );

    const branchId =
      cleanText(
        body.branchId,
      );

    /* ========================================================
       NAME
    ======================================================== */

    if (!name) {
      throw new HttpError(
        "Full name is required.",
        422,
      );
    }

    if (name.length < 2) {
      throw new HttpError(
        "Full name must contain at least 2 characters.",
        422,
      );
    }

    if (name.length > 150) {
      throw new HttpError(
        "Full name cannot exceed 150 characters.",
        422,
      );
    }

    /* ========================================================
       EMAIL
    ======================================================== */

    if (!email) {
      throw new HttpError(
        "Email address is required.",
        422,
      );
    }

    if (!validEmail(email)) {
      throw new HttpError(
        "Enter a valid email address.",
        422,
      );
    }

    const existingEmail =
      await db.user.findFirst({
        where: {
          email,
        },

        select: {
          id: true,
        },
      });

    if (existingEmail) {
      throw new HttpError(
        "This email address is already registered.",
        409,
      );
    }

    /* ========================================================
       PASSWORD
    ======================================================== */

    if (!password) {
      throw new HttpError(
        "Password is required.",
        422,
      );
    }

    if (password.length < 8) {
      throw new HttpError(
        "Password must contain at least 8 characters.",
        422,
      );
    }

    if (password.length > 128) {
      throw new HttpError(
        "Password cannot exceed 128 characters.",
        422,
      );
    }

    /* ========================================================
       ROLE
    ======================================================== */

    if (!role) {
      throw new HttpError(
        "User role is required.",
        422,
      );
    }

    if (!allowedRoles.has(role)) {
      throw new HttpError(
        "Invalid user role. Allowed roles are COMPANY_ADMIN, ACCOUNTANT, STAFF and GPS_MANAGER.",
        422,
      );
    }

    /* ========================================================
       STATUS
    ======================================================== */

    if (!allowedStatuses.has(status)) {
      throw new HttpError(
        "Account status must be ACTIVE or SUSPENDED.",
        422,
      );
    }

    /* ========================================================
       GENDER
    ======================================================== */

    if (
      gender &&
      !allowedGenders.has(gender)
    ) {
      throw new HttpError(
        "Gender must be MALE, FEMALE or OTHER.",
        422,
      );
    }

    /* ========================================================
       NIDA
    ======================================================== */

    if (nidaNumber) {
      if (!validNida(nidaNumber)) {
        throw new HttpError(
          "NIDA number must contain exactly 20 digits.",
          422,
        );
      }

      const existingNida =
        await db.user.findFirst({
          where: {
            companyId,
            nidaNumber,

            status: {
              not: "REMOVED",
            },
          },

          select: {
            id: true,
          },
        });

      if (existingNida) {
        throw new HttpError(
          "This NIDA number is already registered in your company.",
          409,
        );
      }
    }

    /* ========================================================
       PHONE
    ======================================================== */

    if (
      phone &&
      phone.length < 7
    ) {
      throw new HttpError(
        "Enter a valid phone number.",
        422,
      );
    }

    /* ========================================================
       DATE OF BIRTH
    ======================================================== */

    let dateOfBirth:
      | Date
      | undefined;

    if (
      body.dateOfBirth !==
        undefined &&
      cleanText(
        body.dateOfBirth,
      )
    ) {
      const parsedDate =
        new Date(
          cleanText(
            body.dateOfBirth,
          ),
        );

      if (
        Number.isNaN(
          parsedDate.getTime(),
        )
      ) {
        throw new HttpError(
          "Enter a valid date of birth.",
          422,
        );
      }

      if (
        parsedDate >= new Date()
      ) {
        throw new HttpError(
          "Date of birth must be in the past.",
          422,
        );
      }

      dateOfBirth =
        parsedDate;
    }

    /* ========================================================
       BRANCH
    ======================================================== */

    if (branchId) {
      const branch =
        await db.branch.findFirst({
          where: {
            id: branchId,
            companyId,
          },

          select: {
            id: true,
            name: true,
          },
        });

      if (!branch) {
        throw new HttpError(
          "Selected branch does not belong to your company.",
          404,
        );
      }
    }

    /* ========================================================
       GENERATE USERNAME
    ======================================================== */

    const username =
      await generateUniqueUsername(
        db,
        body.username,
        email,
        name,
      );

    if (!username) {
      throw new HttpError(
        "The system could not generate a username.",
        500,
      );
    }

    /* ========================================================
       HASH PASSWORD
    ======================================================== */

    const passwordHash =
      await bcrypt.hash(
        password,
        12,
      );

    /* ========================================================
       BUILD CREATE OBJECT
    ======================================================== */

    const createData:
      Record<string, any> = {
      companyId,

      name,

      email,

      /**
       * THIS IS THE FIELD THAT WAS MISSING.
       */
      username,

      passwordHash,

      role,

      status,
    };

    if (phone) {
      createData.phone =
        phone;
    }

    if (gender) {
      createData.gender =
        gender;
    }

    if (nidaNumber) {
      createData.nidaNumber =
        nidaNumber;
    }

    if (nationality) {
      createData.nationality =
        nationality;
    }

    if (
      physicalAddress
    ) {
      createData.physicalAddress =
        physicalAddress;
    }

    if (
      assignedRegion
    ) {
      createData.assignedRegion =
        assignedRegion;
    }

    if (
      profileImageUrl
    ) {
      createData.profileImageUrl =
        profileImageUrl;
    }

    if (branchId) {
      createData.branchId =
        branchId;
    }

    if (dateOfBirth) {
      createData.dateOfBirth =
        dateOfBirth;
    }

    /* ========================================================
       CREATE USER
    ======================================================== */

    let createdUser: any;

    try {
      createdUser =
        await db.user.create({
          data:
            createData,
        });
    } catch (error: any) {
      console.error(
        "[COMPANY_ADMIN_CREATE_USER]",
        error,
      );

      /**
       * Prisma unique violation.
       */
      if (
        error?.code ===
        "P2002"
      ) {
        const target =
          Array.isArray(
            error?.meta?.target,
          )
            ? error.meta.target.join(
                ", ",
              )
            : String(
                error?.meta
                  ?.target ??
                  "",
              );

        if (
          target
            .toLowerCase()
            .includes(
              "username",
            )
        ) {
          throw new HttpError(
            "Generated username is already in use. Please try registering the user again.",
            409,
          );
        }

        if (
          target
            .toLowerCase()
            .includes(
              "email",
            )
        ) {
          throw new HttpError(
            "Email address is already registered.",
            409,
          );
        }

        if (
          target
            .toLowerCase()
            .includes(
              "nida",
            )
        ) {
          throw new HttpError(
            "NIDA number is already registered.",
            409,
          );
        }

        throw new HttpError(
          "A user with these unique details already exists.",
          409,
        );
      }

      throw error;
    }

    /* ========================================================
       AUDIT LOG
    ======================================================== */

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
          "CREATE_USER",

        module:
          "USERS",

        details:
          `Created ${name} (${createdUser.id}). ` +
          `Username: ${username}. ` +
          `Role: ${role}.`,
      });
    } catch (error) {
      /**
       * User creation already succeeded.
       *
       * Do not pretend registration failed just because
       * optional audit logging had a problem.
       */
      console.error(
        "[CREATE_USER_AUDIT_ERROR]",
        error,
      );
    }

    /* ========================================================
       USER NOTIFICATION
    ======================================================== */

    try {
      await createNotification({
        companyId,

        targetUserId:
          createdUser.id,

        title:
          "Account created",

        message:
          `${sessionUser.name} created your SIMAMIA account. ` +
          `Your username is ${username}.`,

        type:
          "SUCCESS",

        link:
          "/dashboard",
      });
    } catch (error) {
      console.error(
        "[CREATE_USER_NOTIFICATION_ERROR]",
        error,
      );
    }

    /* ========================================================
       RESPONSE
    ======================================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "User registered successfully.",

        user:
          safeUser(
            createdUser,
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
    return routeError(error);
  }
}