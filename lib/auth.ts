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

function getAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "AUTH_SECRET is missing. A development-only fallback secret is being used.",
    );

    return "simamia-local-development-secret-change-before-production";
  }

  throw new Error(
    "Missing AUTH_SECRET. Add a long random AUTH_SECRET value to the environment.",
  );
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeSignatureEqual(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function createSessionToken(
  userId: string,
  lifetimeSeconds: number,
): string {
  const payload: SessionPayload = {
    version: 1,
    userId,
    expiresAt: Date.now() + lifetimeSeconds * 1000,
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function readSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, suppliedSignature, ...extraParts] = token.split(".");

  if (!encodedPayload || !suppliedSignature || extraParts.length > 0) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (!safeSignatureEqual(suppliedSignature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<SessionPayload>;

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

export async function createAuthSession(
  userId: string,
  rememberMe = false,
): Promise<void> {
  const cleanedUserId = String(userId).trim();

  if (!cleanedUserId) {
    throw new Error(
      "A valid user ID is required to create an authentication session.",
    );
  }

  const lifetimeSeconds = rememberMe
    ? REMEMBERED_SESSION_SECONDS
    : NORMAL_SESSION_SECONDS;

  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(cleanedUserId, lifetimeSeconds),
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
  });
}

export async function deleteAuthSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const session = readSessionToken(token);

    if (!session) {
      return null;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: session.userId,
        status: "ACTIVE",
      },
      include: {
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
      String(user.company.status).trim().toUpperCase() !== "ACTIVE"
    ) {
      return null;
    }

    return {
      id: String(user.id),
      companyId:
        user.companyId == null ? null : String(user.companyId),
      branchId:
        user.branchId == null ? null : String(user.branchId),
      name: String(user.name),
      username: String(user.username),
      email: String(user.email),
      phone: user.phone == null ? null : String(user.phone),
      role: String(user.role),
      status: String(user.status),
      profileImageUrl:
        user.profileImageUrl == null
          ? null
          : String(user.profileImageUrl),
      assignedRegion:
        user.assignedRegion == null
          ? null
          : String(user.assignedRegion),
      companyName:
        user.company?.name == null ? null : String(user.company.name),
      branchName:
        user.branch?.name == null ? null : String(user.branch.name),
    };
  } catch (error) {
    console.error("GET_CURRENT_USER_ERROR:", error);
    return null;
  }
}

export async function getCurrentAuth(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

export function getRoleLabel(role: unknown): string {
  switch (String(role ?? "").trim().toUpperCase()) {
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

function extractRole(value: unknown): string {
  if (typeof value === "object" && value !== null && "role" in value) {
    return String((value as { role?: unknown }).role ?? "");
  }

  return String(value ?? "");
}

export function roleHome(roleOrUser: unknown): string {
  switch (extractRole(roleOrUser).trim().toUpperCase()) {
    case "SYSTEM_DEVELOPER":
      return "/developer";
    case "SUPER_ADMIN":
      return "/super-admin";
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

export function getDashboardPath(roleOrUser: unknown): string {
  return roleHome(roleOrUser);
}
