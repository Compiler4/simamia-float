import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: string;
  companyId: string | null;
  companyName?: string | null;
};

export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireCompanyMember(
  allowedRoles?: string[],
): Promise<SessionUser> {
  const user = (await getCurrentUser()) as SessionUser | null;

  if (!user) {
    throw new HttpError("You must sign in first.", 401);
  }

  if (!user.companyId) {
    throw new HttpError("Your account is not assigned to a company.", 403);
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    throw new HttpError("You are not allowed to perform this action.", 403);
  }

  return user;
}

export async function requireCompanyAdmin(): Promise<SessionUser> {
  return requireCompanyMember(["COMPANY_ADMIN"]);
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function normalizeDate(value: string | Date): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError("Invalid date value.", 422);
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function createNotification(input: {
  companyId: string;
  targetUserId?: string | null;
  targetRole?: string | null;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}) {
  const db = prisma as any;
  return db.companyNotification.create({
    data: {
      companyId: input.companyId,
      targetUserId: input.targetUserId ?? null,
      targetRole: input.targetRole ?? null,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
      link: input.link ?? null,
    },
  });
}

export async function createAudit(input: {
  companyId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  details?: string | null;
}) {
  const db = prisma as any;
  return db.companyAuditEvent.create({
    data: {
      ...input,
      details: input.details ?? null,
    },
  });
}

export function routeError(error: unknown) {
  console.error("COMPANY_ADMIN_API_ERROR", error);

  if (error instanceof HttpError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json(
    {
      success: false,
      message: "The request could not be completed.",
      error: process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status: 500 },
  );
}
