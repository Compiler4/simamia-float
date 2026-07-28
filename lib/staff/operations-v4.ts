import "server-only";

import { prisma } from "@/lib/prisma";

export const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export type PeriodName = "DAY" | "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

export function cleanText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function positiveAmount(value: unknown, name = "amount"): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`INVALID_${name.toUpperCase()}`);
  }
  return parsed;
}

export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") return Number(item);
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { toNumber?: unknown }).toNumber === "function"
      ) {
        return (item as { toNumber: () => number }).toNumber();
      }
      return item;
    }),
  );
}

export function localDateKey(value: unknown = new Date()): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return [
    local.getUTCFullYear(),
    String(local.getUTCMonth() + 1).padStart(2, "0"),
    String(local.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function localHour(value: Date = new Date()): number {
  return new Date(value.getTime() + TZ_OFFSET_MS).getUTCHours();
}

function localMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function parseDateKey(value: string): { year: number; month: number; day: number } {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  const now = new Date(Date.now() + TZ_OFFSET_MS);
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

export function periodBounds(
  rawPeriod: unknown,
  rawAnchor: unknown,
  rawFrom?: unknown,
  rawTo?: unknown,
): { period: PeriodName; start: Date; end: Date; label: string } {
  const period = cleanText(rawPeriod).toUpperCase() as PeriodName;
  const safePeriod: PeriodName = ["DAY", "WEEK", "MONTH", "YEAR", "CUSTOM"].includes(period)
    ? period
    : "DAY";

  if (safePeriod === "CUSTOM") {
    const from = parseDateKey(cleanText(rawFrom) || localDateKey());
    const to = parseDateKey(cleanText(rawTo) || cleanText(rawFrom) || localDateKey());
    const first = localMidnightUtc(from.year, from.month, from.day);
    const lastStart = localMidnightUtc(to.year, to.month, to.day);
    const start = first <= lastStart ? first : lastStart;
    const endStart = first <= lastStart ? lastStart : first;
    const end = new Date(endStart.getTime() + 86_400_000 - 1);
    return {
      period: safePeriod,
      start,
      end,
      label: `${localDateKey(start)} to ${localDateKey(end)}`,
    };
  }

  const anchorKey = cleanText(rawAnchor) || localDateKey();
  const { year, month, day } = parseDateKey(anchorKey);

  if (safePeriod === "YEAR") {
    const start = localMidnightUtc(year, 1, 1);
    const end = new Date(localMidnightUtc(year + 1, 1, 1).getTime() - 1);
    return { period: safePeriod, start, end, label: String(year) };
  }

  if (safePeriod === "MONTH") {
    const start = localMidnightUtc(year, month, 1);
    const next = month === 12
      ? localMidnightUtc(year + 1, 1, 1)
      : localMidnightUtc(year, month + 1, 1);
    return {
      period: safePeriod,
      start,
      end: new Date(next.getTime() - 1),
      label: new Intl.DateTimeFormat("en-TZ", {
        month: "long",
        year: "numeric",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(start),
    };
  }

  if (safePeriod === "WEEK") {
    const localAnchor = new Date(Date.UTC(year, month - 1, day));
    const weekday = localAnchor.getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const monday = addDays(localAnchor, mondayOffset);
    const start = localMidnightUtc(
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate(),
    );
    return {
      period: safePeriod,
      start,
      end: new Date(addDays(start, 7).getTime() - 1),
      label: `Week ${localDateKey(start)} to ${localDateKey(addDays(start, 6))}`,
    };
  }

  const start = localMidnightUtc(year, month, day);
  return {
    period: "DAY",
    start,
    end: new Date(addDays(start, 1).getTime() - 1),
    label: anchorKey,
  };
}

export function isoWeekKey(value: unknown): string {
  const source = value instanceof Date ? value : new Date(String(value));
  const local = new Date(source.getTime() + TZ_OFFSET_MS);
  const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function requireOwnedStaffFile(
  companyId: string,
  staffId: string,
  url: unknown,
  allowedKinds: string[],
): Promise<{ id: string; url: string; storagePath: string; mimeType: string } | null> {
  const proofUrl = cleanText(url);
  if (!proofUrl) return null;

  const match = proofUrl.match(/^\/api\/staff\/files\/([^/?#]+)$/);
  if (!match) throw new Error("INVALID_PROOF_URL");

  const db = prisma as any;
  const file = await db.staffFile.findFirst({
    where: {
      id: match[1],
      companyId,
      ownerUserId: staffId,
      kind: { in: allowedKinds },
    },
    select: {
      id: true,
      storagePath: true,
      mimeType: true,
    },
  });

  if (!file) throw new Error("FILE_NOT_OWNED");
  return {
    id: String(file.id),
    url: proofUrl,
    storagePath: String(file.storagePath),
    mimeType: String(file.mimeType),
  };
}

export function parseProofText(textValue: unknown): {
  referenceNo: string;
  transactionId: string;
  senderName: string;
  receiverName: string;
  amount: number;
} {
  const text = cleanText(textValue).replace(/\s+/g, " ");

  const reference =
    text.match(
      /\b(?:REF(?:ERENCE)?|KUMBUKUMBU(?:\s+NAMBA)?|MUAMALA(?:\s+NAMBA)?|TRANSACTION(?:\s+ID)?|TXN(?:\s+ID)?|TRX(?:\s+ID)?|ID)\s*[:#-]?\s*([A-Z0-9/_-]{5,})\b/i,
    )?.[1] ??
    text.match(/\b([A-Z0-9]{10,})\b/i)?.[1] ??
    "";

  const amountText =
    text.match(
      /\b(?:TZS|TSH|T\.SH|SHS?|\/=)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    )?.[1] ??
    text.match(
      /\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:TZS|TSH|T\.SH|SHS?|\/=)\b/i,
    )?.[1] ??
    "";

  const explicitFromTo = text.match(
    /\b(?:FROM|KUTOKA)\s+(.+?)\s+(?:TO|KWA|KWENDA)\s+(.+?)(?=\s+(?:REF|REFERENCE|TXN|TRANSACTION|ID|KUMBUKUMBU|MUAMALA|TZS|TSH|T\.SH|SHS?|ON|AT|TAREHE|SALIO|BALANCE)\b|$)/i,
  );

  const sent = text.match(
    /\b(?:YOU\s+HAVE\s+)?(?:SENT|TRANSFERRED|PAID|UMETUMA|UMELIPA)\b[\s\S]*?\b(?:TO|KWA|KWENDA)\s+(.+?)(?=\s+(?:REF|REFERENCE|TXN|TRANSACTION|ID|KUMBUKUMBU|MUAMALA|SALIO|BALANCE|TAREHE|ON|AT)\b|$)/i,
  );

  const received = text.match(
    /\b(?:YOU\s+HAVE\s+)?(?:RECEIVED|UMEPOKEA|UMEPATA)\b[\s\S]*?\b(?:FROM|KUTOKA|TOKA)\s+(.+?)(?=\s+(?:REF|REFERENCE|TXN|TRANSACTION|ID|KUMBUKUMBU|MUAMALA|SALIO|BALANCE|TAREHE|ON|AT)\b|$)/i,
  );

  return {
    referenceNo: cleanText(reference).toUpperCase(),
    transactionId: cleanText(reference).toUpperCase(),
    senderName: cleanText(explicitFromTo?.[1] ?? received?.[1] ?? ""),
    receiverName: cleanText(explicitFromTo?.[2] ?? sent?.[1] ?? ""),
    amount: Number(amountText.replaceAll(",", "")) || 0,
  };
}

export async function assignedBrokerCustomers(companyId: string, staffId: string) {
  const db = prisma as any;
  const staff = await db.user.findFirst({
    where: { id: staffId, companyId, status: "ACTIVE" },
    select: { assignedRegion: true },
  });

  const explicit = await db.staffBrokerCustomerAssignment.findMany({
    where: {
      companyId,
      staffId,
      status: "ACTIVE",
    },
    include: {
      broker: {
        include: {
          agentAccounts: {
            where: { status: "ACTIVE" },
            orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
          },
        },
      },
    },
    orderBy: [{ assignedArea: "asc" }, { startedAt: "desc" }],
  });

  if (explicit.length) {
    return explicit
      .map((row: any) => ({
        ...row.broker,
        assignedArea: row.assignedArea,
        assignmentId: row.id,
      }))
      .filter((broker: any) => broker.status === "ACTIVE");
  }

  const area = cleanText(staff?.assignedRegion);
  if (!area) return [];

  return db.brokerCustomer.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      OR: [
        { region: { contains: area } },
        { district: { contains: area } },
        { ward: { contains: area } },
        { location: { contains: area } },
        { address: { contains: area } },
      ],
    },
    include: {
      agentAccounts: {
        where: { status: "ACTIVE" },
        orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
      },
    },
    orderBy: [{ location: "asc" }, { name: "asc" }],
  });
}

export async function requireAssignedBroker(
  companyId: string,
  staffId: string,
  brokerCustomerId: string,
) {
  const brokers = await assignedBrokerCustomers(companyId, staffId);
  const broker = brokers.find((item: any) => String(item.id) === brokerCustomerId);
  if (!broker) throw new Error("BROKER_NOT_ASSIGNED");
  return broker;
}

export async function autoAttendanceFromLocation(
  companyId: string,
  staffId: string,
  capturedAt: Date,
): Promise<void> {
  const db = prisma as any;
  const dateKey = localDateKey(capturedAt);
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
  const hour = localHour(capturedAt);

  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId: staffId, date } },
  });

  if (!existing) {
    await db.attendance.create({
      data: {
        companyId,
        userId: staffId,
        date,
        status: hour <= 9 ? "PRESENT" : "LATE",
        checkInAt: capturedAt,
        checkOutAt: hour >= 15 ? capturedAt : null,
        source: "LIVE_GPS",
        notes: "Automatically recorded from the staff live-location journey.",
      },
    });
    return;
  }

  const data: Record<string, unknown> = {
    source: "LIVE_GPS",
  };

  if (!existing.checkInAt) data.checkInAt = capturedAt;
  if (hour >= 15) data.checkOutAt = capturedAt;

  await db.attendance.update({
    where: { id: existing.id },
    data,
  });
}

export function responseError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Authentication is required."],
    AUTH_REQUIRED: [401, "Authentication is required."],
    "Authentication is required.": [401, "Authentication is required."],
    FORBIDDEN: [403, "Staff access is required."],
    COMPANY_REQUIRED: [403, "Your account is not assigned to a company."],
    INVALID_AMOUNT: [422, "Enter an amount greater than zero."],
    INVALID_FLOATAMOUNT: [422, "Enter a valid float amount."],
    INVALID_CASHAMOUNT: [422, "Enter a valid cash amount."],
    INVALID_PROOF_URL: [422, "Upload a valid proof file first."],
    PROOF_CONTENT_REQUIRED: [422, "Upload a receipt/screenshot or paste the complete SMS transaction text."],
    FILE_NOT_OWNED: [403, "The uploaded file does not belong to this staff account."],
    BROKER_NOT_ASSIGNED: [403, "This broker is not assigned to your service area."],
    NETWORK_LINE_NOT_OWNED: [403, "The selected network line does not belong to your staff account."],
    SERVICE_VISIT_NOT_OWNED: [403, "The selected service visit does not belong to your staff account."],
    FUNDING_NOT_FOUND: [404, "The selected float and cash receipt was not found."],
    FUNDING_ALREADY_HANDLED: [409, "This receipt has already been confirmed or rejected."],
    PROOF_FIELDS_MISSING: [422, "Reference/transaction ID, sender, receiver and amount are required."],
    DUPLICATE_REFERENCE: [409, "This reference or transaction ID is already registered."],
    SERVICE_LOCATION_REQUIRED: [422, "Current staff coordinates are required to update a service visit."],
    NO_VALUE: [422, "Enter a float amount, cash amount, or both."],
    UNSUPPORTED_ACTION: [400, "The requested staff operation is not supported."],
  };
  const found = known[message];
  return found ? { status: found[0], message: found[1] } : { status: 500, message };
}
