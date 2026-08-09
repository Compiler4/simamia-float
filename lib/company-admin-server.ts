import { NextResponse } from "next/server";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function toNumber(value: unknown): number {
  if (value == null || value === "") {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function normalizeDate(value: unknown): Date {
  const date = value instanceof Date ? new Date(value) : new Date(text(value));

  if (Number.isNaN(date.getTime())) {
    throw new HttpError("A valid date is required.", 422);
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeRoleList(roles?: string[]): string[] | null {
  if (!roles?.length) {
    return null;
  }

  return roles.map((role) => text(role).trim().toUpperCase());
}

export async function requireCompanyMember(
  roles?: string[],
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new HttpError("Authentication is required.", 401);
  }

  if (!user.companyId) {
    throw new HttpError(
      "Your account is not assigned to a company.",
      403,
    );
  }

  const allowed = normalizeRoleList(roles);
  const currentRole = text(user.role).trim().toUpperCase();

  if (allowed && !allowed.includes(currentRole)) {
    throw new HttpError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return user;
}

export async function requireCompanyAdmin(): Promise<CurrentUser> {
  return requireCompanyMember(["COMPANY_ADMIN"]);
}

type AuditInput = {
  companyId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  module: string;
  details?: string | null;
};

export async function createAudit(input: AuditInput): Promise<void> {
  const db = prisma as any;

  if (db.companyAuditEvent?.create) {
    await db.companyAuditEvent.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId || null,
        actorName: input.actorName || null,
        actorRole: input.actorRole || null,
        action: input.action,
        module: input.module,
        details: input.details || null,
      },
    });
    return;
  }

  if (db.auditLog?.create) {
    await db.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorId || null,
        action: input.action,
        module: input.module,
        details: input.details || null,
      },
    });
  }
}

type NotificationInput = {
  companyId: string;
  targetUserId?: string | null;
  targetRole?: string | null;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
};

export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  const db = prisma as any;

  if (!db.companyNotification?.create) {
    console.warn("companyNotification Prisma delegate is unavailable.");
    return;
  }

  await db.companyNotification.create({
    data: {
      companyId: input.companyId,
      targetUserId: input.targetUserId || null,
      targetRole: input.targetRole || null,
      title: input.title,
      message: input.message,
      type: input.type || "INFO",
      link: input.link || null,
      isRead: false,
    },
  });
}

export function routeError(error: unknown): Response {
  if (error instanceof HttpError) {
    if (error.status >= 500) {
      console.error("COMPANY_ADMIN_ROUTE_ERROR", error);
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message,
        details:
          process.env.NODE_ENV === "development"
            ? error.details
            : undefined,
      },
      { status: error.status },
    );
  }

  console.error("COMPANY_ADMIN_ROUTE_ERROR", error);

  return NextResponse.json(
    {
      success: false,
      message: "The server could not complete the request.",
      error:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : undefined,
    },
    { status: 500 },
  );
}
