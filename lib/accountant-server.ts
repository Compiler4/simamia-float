import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const TANZANIA_OFFSET_MS = 3 * 60 * 60 * 1000;

export class AccountantHttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AccountantHttpError";
    this.status = status;
  }
}

export async function requireAccountant(
  allowCompanyAdmin = true,
): Promise<any> {
  const session = (await getCurrentUser()) as any;

  if (!session) {
    throw new AccountantHttpError("Authentication is required.", 401);
  }

  const allowedRoles = allowCompanyAdmin
    ? ["ACCOUNTANT", "COMPANY_ADMIN"]
    : ["ACCOUNTANT"];

  if (!allowedRoles.includes(String(session.role))) {
    throw new AccountantHttpError(
      "Only an Accountant or Company Admin may perform this action.",
      403,
    );
  }

  if (!session.companyId) {
    throw new AccountantHttpError(
      "The authenticated account is not assigned to a company.",
      403,
    );
  }

  return {
    ...session,
    id: String(session.id),
    name: String(session.name ?? session.username ?? "Accountant"),
    role: String(session.role),
    companyId: String(session.companyId),
  };
}

export function accountantRouteError(error: unknown) {
  if (error instanceof AccountantHttpError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("ACCOUNTANT_ROUTE_ERROR", error);

  return NextResponse.json(
    {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "An unexpected accounting error occurred.",
    },
    { status: 500 },
  );
}

export function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function decimalValue(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed < 0) {
    throw new AccountantHttpError("Money values cannot be negative.", 422);
  }

  return parsed.toFixed(2);
}

export function tanzaniaDayBounds(value: Date | string = new Date()) {
  const instant = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(instant.getTime())) {
    throw new AccountantHttpError("A valid date is required.", 422);
  }

  const shifted = new Date(instant.getTime() + TANZANIA_OFFSET_MS);
  const startUtc =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - TANZANIA_OFFSET_MS;

  return {
    start: new Date(startUtc),
    end: new Date(startUtc + 24 * 60 * 60 * 1000 - 1),
  };
}

export function tanzaniaMonthBounds(value: Date | string = new Date()) {
  const instant = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(instant.getTime())) {
    throw new AccountantHttpError("A valid month is required.", 422);
  }

  const shifted = new Date(instant.getTime() + TANZANIA_OFFSET_MS);
  const startUtc =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ) - TANZANIA_OFFSET_MS;
  const endUtc =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    ) -
    TANZANIA_OFFSET_MS -
    1;

  return {
    start: new Date(startUtc),
    end: new Date(endUtc),
  };
}

export function tanzaniaDateKey(value: Date | string = new Date()) {
  const instant = value instanceof Date ? value : new Date(value);
  const shifted = new Date(instant.getTime() + TANZANIA_OFFSET_MS);

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function accountingPeriodDetails(periodKey: string) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new AccountantHttpError(
      "Accounting period must use YYYY-MM format.",
      422,
    );
  }

  const [yearText, monthText] = periodKey.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    throw new AccountantHttpError("Invalid accounting month.", 422);
  }

  const startsAt = new Date(
    Date.UTC(year, monthIndex, 1) - TANZANIA_OFFSET_MS,
  );
  const endsAt = new Date(
    Date.UTC(year, monthIndex + 1, 1) -
      TANZANIA_OFFSET_MS -
      1,
  );

  return {
    periodKey,
    startsAt,
    endsAt,
    label: new Intl.DateTimeFormat("en-TZ", {
      month: "long",
      year: "numeric",
      timeZone: "Africa/Dar_es_Salaam",
    }).format(startsAt),
  };
}

export async function createAudit(input: {
  companyId: string;
  userId?: string | null;
  action: string;
  module: string;
  details?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        action: input.action,
        module: input.module,
        details: input.details ?? null,
      },
    });
  } catch (error) {
    console.error("ACCOUNTANT_AUDIT_WRITE_FAILED", error);
  }
}

async function postNotificationWebhook(
  url: string | undefined,
  payload: Record<string, unknown>,
) {
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NOTIFICATION_WEBHOOK_SECRET
          ? {
              Authorization: `Bearer ${process.env.NOTIFICATION_WEBHOOK_SECRET}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error(
        "ACCOUNTANT_NOTIFICATION_WEBHOOK_FAILED",
        response.status,
        await response.text(),
      );
    }
  } catch (error) {
    console.error("ACCOUNTANT_NOTIFICATION_WEBHOOK_ERROR", error);
  }
}

export async function notifyUser(input: {
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}) {
  try {
    const db = prisma as any;

    const [recipient, settings] = await Promise.all([
      db.user.findFirst({
        where: {
          id: input.userId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),
      db.companyAdminSetting.findUnique({
        where: {
          companyId: input.companyId,
        },
      }),
    ]);

    if (!recipient) return;

    if (!settings || settings.inApp !== false) {
      await db.notification.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type ?? "INFO",
        },
      });
    }

    const basePayload = {
      companyId: input.companyId,
      userId: input.userId,
      recipientName: recipient.name,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
    };

    const jobs: Promise<void>[] = [];

    if (
      settings?.email !== false &&
      recipient.email &&
      process.env.EMAIL_NOTIFICATION_WEBHOOK_URL
    ) {
      jobs.push(
        postNotificationWebhook(
          process.env.EMAIL_NOTIFICATION_WEBHOOK_URL,
          {
            ...basePayload,
            channel: "email",
            to: recipient.email,
          },
        ),
      );
    }

    if (
      settings?.sms !== false &&
      recipient.phone &&
      process.env.SMS_NOTIFICATION_WEBHOOK_URL
    ) {
      jobs.push(
        postNotificationWebhook(
          process.env.SMS_NOTIFICATION_WEBHOOK_URL,
          {
            ...basePayload,
            channel: "sms",
            to: recipient.phone,
          },
        ),
      );
    }

    await Promise.allSettled(jobs);
  } catch (error) {
    console.error("ACCOUNTANT_NOTIFICATION_WRITE_FAILED", error);
  }
}

export async function notifyRoles(input: {
  companyId: string;
  roles: Array<"ACCOUNTANT" | "COMPANY_ADMIN" | "STAFF" | "BROKER" | "GPS_MANAGER">;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  excludeUserId?: string;
}) {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        companyId: input.companyId,
        role: {
          in: input.roles,
        },
        status: "ACTIVE",
        ...(input.excludeUserId
          ? {
              NOT: {
                id: input.excludeUserId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    await Promise.allSettled(
      recipients.map((recipient) =>
        notifyUser({
          companyId: input.companyId,
          userId: recipient.id,
          title: input.title,
          message: input.message,
          type: input.type,
        }),
      ),
    );
  } catch (error) {
    console.error("ACCOUNTANT_ROLE_NOTIFICATION_FAILED", error);
  }
}

export const blockingDepositStatuses = [
  "AMOUNT_MISMATCH",
  "MISSING_RECEIPT",
  "DUPLICATE_DEPOSIT",
  "MISSING_BANK_RECORD",
] as const;

export async function ensurePeriodOpen(
  companyId: string,
  date: Date,
) {
  const db = prisma as any;

  // Keep the rest of the Accountant portal working while a newly-added
  // AccountingPeriod model is waiting for migration/client generation.
  if (typeof db.accountingPeriod?.findUnique !== "function") {
    return;
  }

  const key = tanzaniaDateKey(date).slice(0, 7);
  const period = await db.accountingPeriod.findUnique({
    where: {
      companyId_periodKey: {
        companyId,
        periodKey: key,
      },
    },
  });

  if (period?.status === "LOCKED") {
    throw new AccountantHttpError(
      `${period.label} is locked. Unlock the period before posting transactions.`,
      409,
    );
  }
}
