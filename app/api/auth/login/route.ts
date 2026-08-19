import bcrypt from "bcryptjs";
import {
  type NextRequest,
  NextResponse,
} from "next/server";

import {
  createAuthSession,
  getDashboardPath,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

type LoginBody = {
  email?: unknown;
  identifier?: unknown;
  login?: unknown;

  password?: unknown;
  userPassword?: unknown;
  pass?: unknown;

  rememberMe?: unknown;
};

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function text(value: unknown): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function errorText(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toBoolean(
  value: unknown,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    text(value).toLowerCase(),
  );
}

function jsonError(
  message: string,
  status: number,
  reason?: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      ok: false,
      message,

      ...(process.env.NODE_ENV ===
        "development" &&
      reason
        ? {
            reason,
          }
        : {}),
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}

/**
 * Do NOT make this:
 *
 * value is string
 *
 * passwordHash is already converted to string,
 * so a type predicate can cause TypeScript to narrow
 * invalid branches to never.
 */
function isValidBcryptHash(
  value: string,
): boolean {
  return (
    value.length === 60 &&
    /^\$2[aby]\$\d{2}\$/.test(value)
  );
}

/**
 * ============================================================
 * REQUEST BODY
 * ============================================================
 */

async function readLoginBody(
  request: NextRequest,
): Promise<LoginBody> {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  /**
   * JSON login request.
   */
  if (
    contentType.includes(
      "application/json",
    )
  ) {
    const body =
      (await request.json()) as unknown;

    if (
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body)
    ) {
      return body as LoginBody;
    }

    return {};
  }

  /**
   * HTML form / FormData.
   */
  if (
    contentType.includes(
      "multipart/form-data",
    ) ||
    contentType.includes(
      "application/x-www-form-urlencoded",
    )
  ) {
    const form =
      await request.formData();

    return {
      email:
        form.get("email") ??
        form.get("identifier") ??
        form.get("login"),

      password:
        form.get("password") ??
        form.get("userPassword") ??
        form.get("pass"),

      rememberMe:
        form.get("rememberMe"),
    };
  }

  /**
   * Fallback.
   */
  const raw =
    await request.text();

  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(raw) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as LoginBody;
    }
  } catch {
    const params =
      new URLSearchParams(raw);

    return {
      email:
        params.get("email") ??
        params.get("identifier") ??
        params.get("login"),

      password:
        params.get("password") ??
        params.get("userPassword") ??
        params.get("pass"),

      rememberMe:
        params.get("rememberMe"),
    };
  }

  return {};
}

/**
 * ============================================================
 * REDIRECT
 * ============================================================
 */

/**
 * Always use the role stored in the database.
 *
 * getDashboardPath() remains your single source of truth
 * for role -> dashboard routing.
 */
function resolveDashboard(
  role: unknown,
): string {
  const normalized =
    text(role).toUpperCase();

  /**
   * Support an older SYSTEM_ADMIN name
   * if one exists in your database.
   */
  if (
    normalized ===
    "SYSTEM_ADMIN"
  ) {
    return getDashboardPath(
      "SUPER_ADMIN",
    );
  }

  return getDashboardPath(
    normalized,
  );
}

/**
 * Detect a native HTML form request.
 *
 * For a native form POST we can return a real HTTP redirect.
 *
 * For a JavaScript fetch() request we return JSON containing
 * redirectTo because fetch redirects do not automatically
 * replace the browser's top-level page.
 */
function shouldHttpRedirect(
  request: NextRequest,
): boolean {
  const accept =
    request.headers
      .get("accept")
      ?.toLowerCase() ?? "";

  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  const isJson =
    contentType.includes(
      "application/json",
    );

  return (
    !isJson &&
    accept.includes("text/html")
  );
}

/**
 * ============================================================
 * POST /api/auth/login
 * ============================================================
 */

export async function POST(
  request: NextRequest,
): Promise<Response> {
  /**
   * ----------------------------------------------------------
   * 1. READ LOGIN REQUEST
   * ----------------------------------------------------------
   */

  let body: LoginBody;

  try {
    body =
      await readLoginBody(
        request,
      );
  } catch (error) {
    console.error(
      "LOGIN_REQUEST_READ_ERROR",
      error,
    );

    return jsonError(
      "The login request could not be read.",
      400,
      "INVALID_LOGIN_REQUEST",
    );
  }

  const email =
    text(
      body.email ??
        body.identifier ??
        body.login,
    ).toLowerCase();

  /**
   * IMPORTANT:
   *
   * Do not trim passwords.
   */
  const passwordValue =
    body.password ??
    body.userPassword ??
    body.pass;

  const password =
    passwordValue === null ||
    passwordValue === undefined
      ? ""
      : String(passwordValue);

  const rememberMe =
    toBoolean(
      body.rememberMe,
    );

  /**
   * ----------------------------------------------------------
   * 2. VALIDATE
   * ----------------------------------------------------------
   */

  if (!email) {
    return jsonError(
      "Enter your registered email address.",
      422,
      "EMAIL_REQUIRED",
    );
  }

  if (!password) {
    return jsonError(
      "Enter your password.",
      422,
      "PASSWORD_REQUIRED",
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    return jsonError(
      "Enter a valid email address.",
      422,
      "INVALID_EMAIL",
    );
  }

  try {
    /**
     * --------------------------------------------------------
     * 3. LOAD PRISMA
     * --------------------------------------------------------
     */

    const { prisma } =
      await import(
        "@/lib/prisma"
      );

    /**
     * --------------------------------------------------------
     * 4. FETCH USER
     * --------------------------------------------------------
     */

    const user =
      await prisma.user.findFirst({
        where: {
          email,
        },

        select: {
          id: true,

          name: true,

          username: true,

          email: true,

          passwordHash: true,

          role: true,

          status: true,

          companyId: true,

          profileImageUrl:
            true,

          company: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

    /**
     * --------------------------------------------------------
     * 5. USER EXISTS
     * --------------------------------------------------------
     */

    if (!user) {
      console.warn(
        "LOGIN_USER_NOT_FOUND",
        {
          email,
        },
      );

      return jsonError(
        "Invalid email or password.",
        401,
        "USER_NOT_FOUND",
      );
    }

    /**
     * --------------------------------------------------------
     * 6. USER STATUS
     * --------------------------------------------------------
     */

    const userStatus =
      text(
        user.status,
      ).toUpperCase();

    if (
      userStatus !== "ACTIVE"
    ) {
      console.warn(
        "LOGIN_USER_INACTIVE",
        {
          userId:
            String(user.id),

          status:
            userStatus,
        },
      );

      return jsonError(
        "This account is not active.",
        403,
        "USER_NOT_ACTIVE",
      );
    }

    /**
     * --------------------------------------------------------
     * 7. COMPANY STATUS
     * --------------------------------------------------------
     *
     * SUPER_ADMIN can have companyId = null.
     */

    if (user.company) {
      const companyStatus =
        text(
          user.company.status,
        ).toUpperCase();

      if (
        companyStatus !==
        "ACTIVE"
      ) {
        console.warn(
          "LOGIN_COMPANY_INACTIVE",
          {
            userId:
              String(user.id),

            companyId:
              String(
                user.company.id,
              ),

            status:
              companyStatus,
          },
        );

        return jsonError(
          "Your company account is not active.",
          403,
          "COMPANY_NOT_ACTIVE",
        );
      }
    }

    /**
     * --------------------------------------------------------
     * 8. PASSWORD HASH
     * --------------------------------------------------------
     */

    const passwordHash =
      text(
        user.passwordHash,
      );

    if (
      !isValidBcryptHash(
        passwordHash,
      )
    ) {
      console.error(
        "LOGIN_INVALID_PASSWORD_HASH",
        {
          userId:
            String(user.id),

          email:
            user.email,

          hashLength:
            passwordHash.length,
        },
      );

      return jsonError(
        "The account password needs to be reset.",
        500,
        "INVALID_PASSWORD_HASH",
      );
    }

    /**
     * --------------------------------------------------------
     * 9. VERIFY PASSWORD
     * --------------------------------------------------------
     */

    let passwordMatches =
      false;

    try {
      passwordMatches =
        await bcrypt.compare(
          password,
          passwordHash,
        );
    } catch (error) {
      console.error(
        "LOGIN_PASSWORD_COMPARE_ERROR",
        {
          userId:
            String(user.id),

          error:
            errorText(
              error,
            ),
        },
      );

      return jsonError(
        "The password could not be verified.",
        500,
        "PASSWORD_COMPARE_ERROR",
      );
    }

    if (
      !passwordMatches
    ) {
      console.warn(
        "LOGIN_PASSWORD_MISMATCH",
        {
          userId:
            String(user.id),

          email:
            user.email,
        },
      );

      return jsonError(
        "Invalid email or password.",
        401,
        "PASSWORD_MISMATCH",
      );
    }

    /**
     * --------------------------------------------------------
     * 10. GET DASHBOARD FROM DATABASE ROLE
     * --------------------------------------------------------
     */

    let dashboard:
      string;

    try {
      dashboard =
        resolveDashboard(
          user.role,
        );
    } catch (error) {
      console.error(
        "LOGIN_DASHBOARD_RESOLUTION_ERROR",
        {
          userId:
            String(user.id),

          role:
            String(user.role),

          error:
            errorText(
              error,
            ),
        },
      );

      return jsonError(
        "No dashboard is configured for this account role.",
        403,
        "DASHBOARD_NOT_CONFIGURED",
      );
    }

    if (
      !dashboard ||
      !dashboard.startsWith("/")
    ) {
      console.error(
        "LOGIN_INVALID_DASHBOARD_PATH",
        {
          role:
            String(user.role),

          dashboard,
        },
      );

      return jsonError(
        "The dashboard destination is invalid.",
        500,
        "INVALID_DASHBOARD_PATH",
      );
    }

    /**
     * --------------------------------------------------------
     * 11. CREATE SESSION
     * --------------------------------------------------------
     */

    try {
      await createAuthSession(
        String(user.id),
        rememberMe,
      );
    } catch (error) {
      console.error(
        "LOGIN_SESSION_ERROR",
        {
          userId:
            String(user.id),

          error:
            errorText(
              error,
            ),
        },
      );

      return jsonError(
        "Your credentials are correct, but the login session could not be created.",
        500,
        "SESSION_CREATION_FAILED",
      );
    }

    /**
     * --------------------------------------------------------
     * 12. UPDATE LAST LOGIN
     * --------------------------------------------------------
     *
     * This should not block a successful authentication.
     */

    try {
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          lastLoginAt:
            new Date(),
        },
      });
    } catch (error) {
      console.warn(
        "LOGIN_LAST_LOGIN_UPDATE_WARNING",
        {
          userId:
            String(user.id),

          error:
            errorText(
              error,
            ),
        },
      );
    }

    /**
     * --------------------------------------------------------
     * 13. LOG SUCCESS
     * --------------------------------------------------------
     */

    console.log(
      "LOGIN_SUCCESS",
      {
        userId:
          String(user.id),

        email:
          user.email,

        role:
          String(user.role),

        dashboard,
      },
    );

    /**
     * --------------------------------------------------------
     * 14A. NATIVE FORM -> REAL HTTP REDIRECT
     * --------------------------------------------------------
     */

    if (
      shouldHttpRedirect(
        request,
      )
    ) {
      const target =
        new URL(
          dashboard,
          request.url,
        );

      return NextResponse.redirect(
        target,
        303,
      );
    }

    /**
     * --------------------------------------------------------
     * 14B. FETCH/AJAX -> JSON
     * --------------------------------------------------------
     *
     * Existing React login pages normally read redirectTo
     * and call router.replace(redirectTo).
     */

    return NextResponse.json(
      {
        success: true,
        ok: true,

        message:
          "Login successful.",

        redirectTo:
          dashboard,

        rememberMe,

        user: {
          id:
            String(user.id),

          name:
            text(
              user.name,
            ),

          username:
            text(
              user.username,
            ),

          email:
            text(
              user.email,
            ),

          role:
            text(
              user.role,
            ),

          companyId:
            user.companyId ===
            null
              ? null
              : String(
                  user.companyId,
                ),

          companyName:
            user.company
              ?.name ??
            null,

          profileImageUrl:
            user.profileImageUrl ??
            null,
        },
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
    /**
     * --------------------------------------------------------
     * 15. DATABASE / UNEXPECTED ERROR
     * --------------------------------------------------------
     */

    console.error(
      "LOGIN_FATAL_ERROR",
      error,
    );

    const message =
      errorText(
        error,
      ).toLowerCase();

    const databaseProblem =
      message.includes(
        "econnrefused",
      ) ||
      message.includes(
        "can't reach database",
      ) ||
      message.includes(
        "connection refused",
      ) ||
      message.includes(
        "p1000",
      ) ||
      message.includes(
        "p1001",
      ) ||
      message.includes(
        "p1017",
      );

    if (databaseProblem) {
      return jsonError(
        "SIMAMIA cannot connect to the database. Make sure XAMPP MySQL is running.",
        503,
        "DATABASE_UNAVAILABLE",
      );
    }

    return jsonError(
      "Login could not be completed.",
      500,
      "LOGIN_FAILED",
    );
  }
}