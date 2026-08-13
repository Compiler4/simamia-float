import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";

import { createAuthSession, getDashboardPath } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = Record<string, unknown>;

function isRecord(value: unknown): value is LoginBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes", "on"].includes(
    cleanText(value).toLowerCase(),
  );
}

function jsonError(
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return NextResponse.json(
    {
      success: false,
      ok: false,
      message,
      ...(process.env.NODE_ENV === "development" && details
        ? { details }
        : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isDatabaseConfigurationError(error: unknown): boolean {
  const message = messageFromError(error);

  return (
    message.includes("DATABASE_URL") ||
    message.includes("DATABASE_HOST") ||
    message.includes("Missing database setting") ||
    message.includes("DriverAdapterError") ||
    message.includes("pool timeout") ||
    message.includes("ECONNREFUSED") ||
    message.includes("P2010") ||
    message.includes("connect ECONNREFUSED 127.0.0.1") ||
    message.includes("connect ECONNREFUSED localhost")
  );
}

async function readBody(request: NextRequest): Promise<LoginBody> {
  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const parsed = (await request.json()) as unknown;

    if (!isRecord(parsed)) {
      throw new Error("The login JSON body must be an object.");
    }

    return parsed;
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const body: LoginBody = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        body[key] = value;
      }
    }

    return body;
  }

  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;

    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    return Object.fromEntries(new URLSearchParams(rawBody).entries());
  }

  return {};
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: LoginBody;

    try {
      body = await readBody(request);
    } catch (error) {
      return jsonError(
        error instanceof Error
          ? error.message
          : "The login request is invalid.",
        400,
      );
    }

    const identifier = cleanText(
      body.identifier ??
        body.usernameOrEmail ??
        body.emailOrUsername ??
        body.login ??
        body.email ??
        body.username,
    );

    const passwordValue =
      body.password ?? body.userPassword ?? body.pass;

    const password =
      passwordValue === null || passwordValue === undefined
        ? ""
        : String(passwordValue);

    const rememberMe = booleanValue(body.rememberMe);

    if (!identifier || !password) {
      return jsonError(
        "Enter your email or username and password.",
        422,
        {
          receivedFields: Object.keys(body),
          hasIdentifier: Boolean(identifier),
          hasPassword: Boolean(password),
        },
      );
    }

    const lowerIdentifier = identifier.toLowerCase();
    const identifierFilters = lowerIdentifier.includes("@")
      ? [{ email: lowerIdentifier }, { email: identifier }]
      : [
          { username: identifier },
          { username: lowerIdentifier },
          { email: lowerIdentifier },
        ];

    const user = await prisma.user.findFirst({
      where: {
        OR: identifierFilters,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
        passwordHash: true,
        profileImageUrl: true,
        company: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return jsonError("Invalid email, username or password.", 401);
    }

    if (String(user.status).trim().toUpperCase() !== "ACTIVE") {
      return jsonError("This user account is not active.", 403);
    }

    if (
      user.company &&
      String(user.company.status).trim().toUpperCase() !== "ACTIVE"
    ) {
      return jsonError("The company account is not active.", 403);
    }

    const passwordHash = String(user.passwordHash ?? "");

    if (!/^\$2[aby]\$\d{2}\$/.test(passwordHash)) {
      console.error("LOGIN_INVALID_PASSWORD_HASH:", {
        userId: user.id,
      });

      return jsonError(
        "The stored account password is invalid. Reset this user's password.",
        500,
      );
    }

    const passwordMatches = await bcrypt
      .compare(password, passwordHash)
      .catch((error) => {
        console.error("BCRYPT_COMPARE_ERROR:", error);
        return false;
      });

    if (!passwordMatches) {
      return jsonError("Invalid email, username or password.", 401);
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    await createAuthSession(String(user.id), rememberMe);

    return NextResponse.json(
      {
        success: true,
        ok: true,
        message: "Login successful.",
        redirectTo: getDashboardPath(user.role),
        rememberMe,
        user: {
          id: String(user.id),
          name: String(user.name),
          username: String(user.username),
          email: String(user.email),
          role: String(user.role),
          companyId:
            user.companyId == null ? null : String(user.companyId),
          companyName: user.company?.name ?? null,
          profileImageUrl: user.profileImageUrl ?? null,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("AUTH_LOGIN_ERROR:", error);

    if (isDatabaseConfigurationError(error)) {
      return jsonError(
        "The server database is not connected. Add the real reachable MySQL/MariaDB DATABASE_URL in the hosting environment, redeploy, then try again.",
        503,
        {
          error: messageFromError(error),
        },
      );
    }

    return jsonError("Login could not be completed.", 500, {
      error: messageFromError(error),
    });
  }
}
