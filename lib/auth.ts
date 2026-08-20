import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "simamia_session";

const NORMAL_SESSION_SECONDS = 12 * 60 * 60;
const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;

type SessionPayload = {
  version: 1;
  userId: string;
  expiresAt: number;
};

export type CurrentUser = {
  id: string;
  companyId: string | null;
  branchId: string | null;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  profileImageUrl: string | null;
  assignedRegion: string | null;
  companyName: string | null;
  branchName: string | null;
};

export class AuthConfigurationError extends Error {
  readonly code = "AUTH_SECRET_MISSING";

  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function cleanSecret(value: unknown): string {
  const raw = String(value ?? "").trim();

  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1).trim();
  }

  return raw;
}

const AUTH_SECRET_KEYS = [
  "AUTH_SECRET",
  "SESSION_SECRET",
  "NEXTAUTH_SECRET",
  "JWT_SECRET",
] as const;

export function getAuthConfigurationStatus(): {
  configured: boolean;
  source: string | null;
  length: number;
  strongEnough: boolean;
} {
  let firstConfigured: { source: string; length: number } | null = null;

  for (const key of AUTH_SECRET_KEYS) {
    const value = cleanSecret(process.env[key]);
    if (!value) continue;

    if (!firstConfigured) {
      firstConfigured = { source: key, length: value.length };
    }

    if (value.length >= 32) {
      return {
        configured: true,
        source: key,
        length: value.length,
        strongEnough: true,
      };
    }
  }

  if (firstConfigured) {
    return {
      configured: true,
      source: firstConfigured.source,
      length: firstConfigured.length,
      strongEnough: false,
    };
  }

  return {
    configured: false,
    source: null,
    length: 0,
    strongEnough: false,
  };
}

function getAuthSecret(): string {
  const weakKeys: string[] = [];

  for (const key of AUTH_SECRET_KEYS) {
    const secret = cleanSecret(process.env[key]);
    if (!secret) continue;

    if (process.env.NODE_ENV === "production" && secret.length < 32) {
      weakKeys.push(key);
      continue;
    }

    return secret;
  }

  if (process.env.NODE_ENV === "production" && weakKeys.length) {
    throw new AuthConfigurationError(
      `Authentication signing secrets are too short: ${weakKeys.join(", ")}. Use at least 32 characters.`,
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "AUTH_SECRET is missing. A development-only fallback secret is being used.",
    );

    return "simamia-local-development-secret-change-before-production";
  }

  throw new AuthConfigurationError(
    "Missing authentication signing secret. Add AUTH_SECRET (recommended), SESSION_SECRET, NEXTAUTH_SECRET, or JWT_SECRET to the production environment.",
  );
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeSignatureEqual(
  first: string,
  second: string,
): boolean {
  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    firstBuffer,
    secondBuffer,
  );
}

function createSessionToken(
  userId: string,
  lifetimeSeconds: number,
): string {
  const payload: SessionPayload = {
    version: 1,
    userId,
    expiresAt:
      Date.now() +
      lifetimeSeconds * 1000,
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  return `${encodedPayload}.${signPayload(
    encodedPayload,
  )}`;
}

function readSessionToken(
  token: string,
): SessionPayload | null {
  const [
    encodedPayload,
    suppliedSignature,
    ...extraParts
  ] = token.split(".");

  if (
    !encodedPayload ||
    !suppliedSignature ||
    extraParts.length > 0
  ) {
    return null;
  }

  const expectedSignature =
    signPayload(encodedPayload);

  if (
    !safeSignatureEqual(
      suppliedSignature,
      expectedSignature,
    )
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(
      encodedPayload,
      "base64url",
    ).toString("utf8");

    const payload = JSON.parse(
      decoded,
    ) as Partial<SessionPayload>;

    if (
      payload.version !== 1 ||
      typeof payload.userId !== "string" ||
      !payload.userId.trim() ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export type AuthSessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    priority: "high";
    maxAge?: number;
    expires?: Date;
  };
};

export function createAuthSessionCookie(
  userId: string,
  rememberMe = false,
): AuthSessionCookie {
  const cleanedUserId = String(userId).trim();

  if (!cleanedUserId) {
    throw new Error(
      "A valid user ID is required to create an authentication session.",
    );
  }

  const lifetimeSeconds = rememberMe
    ? REMEMBERED_SESSION_SECONDS
    : NORMAL_SESSION_SECONDS;

  return {
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(cleanedUserId, lifetimeSeconds),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      priority: "high",
      ...(rememberMe
        ? {
            maxAge: lifetimeSeconds,
            expires: new Date(Date.now() + lifetimeSeconds * 1000),
          }
        : {}),
    },
  };
}

export async function createAuthSession(
  userId: string,
  rememberMe = false,
): Promise<void> {
  const sessionCookie = createAuthSessionCookie(userId, rememberMe);
  const cookieStore = await cookies();

  cookieStore.set({
    name: sessionCookie.name,
    value: sessionCookie.value,
    ...sessionCookie.options,
  });
}

export async function deleteAuthSession(): Promise<void> {
  const cookieStore =
    await cookies();

  cookieStore.set({
    name:
      SESSION_COOKIE_NAME,

    value: "",

    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "lax",
    path: "/",

    maxAge: 0,

    expires:
      new Date(0),
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore =
      await cookies();

    const token =
      cookieStore.get(
        SESSION_COOKIE_NAME,
      )?.value;

    if (!token) {
      return null;
    }

    const session =
      readSessionToken(token);

    if (!session) {
      return null;
    }

    // Select only the authentication/core identity columns here. Older
    // Hostinger/XAMPP imports may not yet contain newer optional profile
    // columns; selecting the whole User model would make every authenticated
    // page fail even though the credentials and core schema are valid.
    const user =
      await prisma.user.findFirst({
        where: {
          id:
            session.userId,

          status:
            "ACTIVE",
        },

        select: {
          id: true,
          companyId: true,
          branchId: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          company: {
            select: {
              name: true,
              status: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
      });

    if (!user) {
      return null;
    }

    if (
      user.company &&
      String(
        user.company.status,
      )
        .trim()
        .toUpperCase() !==
        "ACTIVE"
    ) {
      return null;
    }

    return {
      id:
        String(user.id),

      companyId:
        user.companyId == null
          ? null
          : String(
              user.companyId,
            ),

      branchId:
        user.branchId == null
          ? null
          : String(
              user.branchId,
            ),

      name:
        String(user.name),

      username:
        String(
          user.username,
        ),

      email:
        String(user.email),

      phone:
        user.phone == null
          ? null
          : String(
              user.phone,
            ),

      role:
        String(user.role),

      status:
        String(user.status),

      // Optional profile columns are deliberately not required for session
      // validation. Role-specific profile APIs can load them after the
      // compatibility repair has run.
      profileImageUrl: null,

      assignedRegion: null,

      companyName:
        user.company?.name ==
        null
          ? null
          : String(
              user.company.name,
            ),

      branchName:
        user.branch?.name ==
        null
          ? null
          : String(
              user.branch.name,
            ),
    };
  } catch (error) {
    console.error(
      "GET_CURRENT_USER_ERROR:",
      error,
    );

    return null;
  }
}

export async function getCurrentAuth(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

export function normalizeRole(
  role: unknown,
): string {
  return String(
    role ?? "",
  )
    .trim()
    .toUpperCase();
}

export function getRoleLabel(
  role: unknown,
): string {
  switch (
    normalizeRole(role)
  ) {
    case "SYSTEM_DEVELOPER":
      return "System Developer";

    case "SUPER_ADMIN":
      return "Super Admin";

    case "COMPANY_ADMIN":
      return "Company Admin";

    case "ACCOUNTANT":
      return "Accountant";

    case "STAFF":
      return "Float Officer";

    case "BROKER":
      return "Broker";

    case "GPS_MANAGER":
      return "GPS Manager";

    default:
      return "User";
  }
}

function extractRole(
  value: unknown,
): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "role" in value
  ) {
    return String(
      (
        value as {
          role?: unknown;
        }
      ).role ?? "",
    );
  }

  return String(
    value ?? "",
  );
}

export function roleHome(
  roleOrUser: unknown,
): string {
  const role =
    normalizeRole(
      extractRole(
        roleOrUser,
      ),
    );

  switch (role) {
    case "SYSTEM_DEVELOPER":
      return "/developer/dashboard";

    case "SUPER_ADMIN":
      return "/super-admin/dashboard";

    case "COMPANY_ADMIN":
      return "/admin/dashboard";

    case "ACCOUNTANT":
      return "/accountant/dashboard";

    case "STAFF":
      return "/staff/dashboard";

    case "BROKER":
      return "/broker/dashboard";

    case "GPS_MANAGER":
      return "/gps-manager/dashboard";

    default:
      return "/login";
  }
}

export function getDashboardPath(
  roleOrUser: unknown,
): string {
  return roleHome(
    roleOrUser,
  );
}