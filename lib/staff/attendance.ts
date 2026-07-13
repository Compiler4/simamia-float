import { db } from "@/lib/db";
import { currentMinutesTz, dayBounds, settingTimeToMinutes, tzDateKey } from "./time";

async function companyCutoff(companyId: string): Promise<number> {
  const setting = await (db as any).companySetting.findUnique({
    where: { companyId_key: { companyId, key: "STAFF_RETURN_CUTOFF" } },
  });
  return settingTimeToMinutes(setting?.value, "17:00");
}

export async function markOperationalAttendance(input: {
  companyId: string;
  userId: string;
  action: "FLOAT_RECEIVED" | "FLOAT_ISSUED" | "COLLECTION_RETURNED" | "GPS_MOVEMENT";
  occurredAt?: Date;
}) {
  const occurredAt = input.occurredAt || new Date();
  const dateKey = tzDateKey(occurredAt);
  const date = new Date(`${dateKey}T12:00:00+03:00`);
  const cutoff = await companyCutoff(input.companyId);
  const actionMinutes = currentMinutesTz(occurredAt);
  const returning = input.action === "COLLECTION_RETURNED";
  const status = returning && actionMinutes > cutoff ? "LATE" : "PRESENT";

  const existing = await (db as any).attendance.findUnique({
    where: { userId_date: { userId: input.userId, date } },
  });

  const notes = [existing?.notes, input.action].filter(Boolean).join(" | ");
  return (db as any).attendance.upsert({
    where: { userId_date: { userId: input.userId, date } },
    create: {
      companyId: input.companyId,
      userId: input.userId,
      date,
      status,
      checkInAt: returning ? null : occurredAt,
      checkOutAt: returning ? occurredAt : null,
      source: "OPERATIONAL_ACTIVITY",
      notes,
    },
    update: {
      status: existing?.status === "LATE" ? "LATE" : status,
      checkInAt: existing?.checkInAt || (returning ? undefined : occurredAt),
      checkOutAt: returning ? occurredAt : existing?.checkOutAt,
      source: "OPERATIONAL_ACTIVITY",
      notes,
    },
  });
}

export async function evaluateMissingReturn(companyId: string, userId: string, now = new Date()) {
  const cutoff = await companyCutoff(companyId);
  if (currentMinutesTz(now) <= cutoff) return null;

  const dateKey = tzDateKey(now);
  const { start, end } = dayBounds(dateKey);
  const [assignedFloat, returned] = await Promise.all([
    (db as any).floatTransaction.findFirst({
      where: {
        companyId,
        toUserId: userId,
        transactionType: "ACCOUNTANT_TO_STAFF",
        createdAt: { gte: start, lte: end },
        status: { not: "REJECTED" },
      },
    }),
    (db as any).floatTransaction.findFirst({
      where: {
        companyId,
        fromUserId: userId,
        transactionType: "STAFF_RETURN_TO_ACCOUNTANT",
        createdAt: { gte: start, lte: end },
        status: { not: "REJECTED" },
      },
    }),
  ]);
  if (!assignedFloat || returned) return null;

  const date = new Date(`${dateKey}T12:00:00+03:00`);
  return (db as any).attendance.upsert({
    where: { userId_date: { userId, date } },
    create: {
      companyId,
      userId,
      date,
      status: "ABSENT",
      source: "AUTO_CUTOFF",
      notes: "No collection or float return was recorded before the configured cutoff.",
    },
    update: {
      status: "ABSENT",
      source: "AUTO_CUTOFF",
      notes: "No collection or float return was recorded before the configured cutoff.",
    },
  });
}
