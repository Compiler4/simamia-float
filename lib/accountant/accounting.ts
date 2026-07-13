import { db } from "@/lib/db";

export function asDate(value: unknown): Date {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return date;
}

export function dayBounds(value: unknown) {
  const date = asDate(value);
  const start = new Date(date);
  const end = new Date(date);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function monthKey(value: unknown): string {
  const date = asDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function assertPeriodOpen(
  companyId: string,
  value: unknown,
  client: any = db,
) {
  const delegate = (client as any).accountingPeriod;
  if (!delegate?.findFirst) {
    throw new Error("ACCOUNTING_PERIOD_MODEL_MISSING");
  }

  const period = await delegate.findFirst({
    where: {
      companyId,
      periodKey: monthKey(value),
      status: "LOCKED",
    },
  });

  if (period) {
    throw new Error("ACCOUNTING_PERIOD_LOCKED");
  }
}

export type JournalLineInput = {
  accountCode: string;
  accountName: string;
  debit?: number;
  credit?: number;
};

export async function postBalancedEntry(input: {
  companyId: string;
  transactionDate: Date;
  reference: string;
  description: string;
  sourceType: string;
  sourceId: string;
  postedById: string;
  lines: JournalLineInput[];
  cashBook?: {
    type: string;
    account: string;
    debit: number;
    credit: number;
  };
}) {
  const totalDebit = input.lines.reduce(
    (sum, line) => sum + Number(line.debit ?? 0),
    0,
  );
  const totalCredit = input.lines.reduce(
    (sum, line) => sum + Number(line.credit ?? 0),
    0,
  );

  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error("UNBALANCED_JOURNAL_ENTRY");
  }

  return (db as any).$transaction(async (tx: any) => {
    await assertPeriodOpen(input.companyId, input.transactionDate, tx);

    const existing = await tx.journalEntry.findFirst({
      where: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });

    if (existing) {
      throw new Error("TRANSACTION_ALREADY_POSTED");
    }

    const entry = await tx.journalEntry.create({
      data: {
        companyId: input.companyId,
        transactionDate: input.transactionDate,
        reference: input.reference,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        postedById: input.postedById,
        status: "POSTED",
        lines: {
          create: input.lines.map((line) => ({
            accountCode: line.accountCode,
            accountName: line.accountName,
            debit: Number(line.debit ?? 0),
            credit: Number(line.credit ?? 0),
          })),
        },
      },
      include: { lines: true },
    });

    if (input.cashBook) {
      const previous = await tx.cashBookEntry.findFirst({
        where: { companyId: input.companyId },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      });

      const runningBalance =
        Number(previous?.runningBalance ?? 0) +
        Number(input.cashBook.debit) -
        Number(input.cashBook.credit);

      await tx.cashBookEntry.create({
        data: {
          companyId: input.companyId,
          journalEntryId: entry.id,
          transactionDate: input.transactionDate,
          reference: input.reference,
          description: input.description,
          account: input.cashBook.account,
          type: input.cashBook.type,
          debit: Number(input.cashBook.debit),
          credit: Number(input.cashBook.credit),
          runningBalance,
          postedById: input.postedById,
        },
      });

      const { start, end } = dayBounds(input.transactionDate);
      const financialDay = await tx.financialDay.findFirst({
        where: {
          companyId: input.companyId,
          date: { gte: start, lte: end },
          status: "OPEN",
        },
      });

      if (financialDay) {
        const cashIn =
          Number(financialDay.cashIn ?? 0) + Number(input.cashBook.debit);
        const cashOut =
          Number(financialDay.cashOut ?? 0) + Number(input.cashBook.credit);
        const closingBalance =
          Number(financialDay.openingBalance ?? 0) + cashIn - cashOut;

        await tx.financialDay.update({
          where: { id: financialDay.id },
          data: { cashIn, cashOut, closingBalance },
        });
      }
    }

    return entry;
  });
}

export async function createAuditLog(input: {
  companyId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
}) {
  const delegate = (db as any).auditLog;
  if (!delegate?.create) return;

  await delegate.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description ?? null,
    },
  });
}

export async function notifyCompanyRoles(input: {
  companyId: string;
  roles: string[];
  title: string;
  message: string;
  type?: string;
  dedupeKey?: string;
}) {
  const users = await (db as any).user.findMany({
    where: {
      companyId: input.companyId,
      role: { in: input.roles },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  for (const user of users) {
    const dedupeKey = input.dedupeKey
      ? `${input.dedupeKey}:${user.id}`
      : null;

    if (dedupeKey) {
      const existing = await (db as any).notification.findFirst({
        where: { companyId: input.companyId, dedupeKey },
      });
      if (existing) continue;
    }

    await (db as any).notification.create({
      data: {
        companyId: input.companyId,
        recipientId: user.id,
        title: input.title,
        message: input.message,
        type: input.type ?? "WARNING",
        dedupeKey,
      },
    });
  }
}

export async function ensureAttendanceMissingNotifications(
  companyId: string,
  value: unknown = new Date(),
) {
  const date = asDate(value);
  const { start, end } = dayBounds(date);
  const users = await (db as any).user.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      role: { in: ["ACCOUNTANT", "COMPANY_ADMIN", "STAFF", "BROKER", "GPS_MANAGER"] },
    },
    select: { id: true, name: true },
  });

  const records = await (db as any).attendance.findMany({
    where: { companyId, date: { gte: start, lte: end } },
    select: { userId: true },
  });

  const completed = new Set(records.map((item: any) => String(item.userId)));
  const missing = users.filter((item: any) => !completed.has(String(item.id)));

  if (!missing.length) return { missing: 0 };

  const key = `${start.toISOString().slice(0, 10)}:attendance-missing`;
  await notifyCompanyRoles({
    companyId,
    roles: ["COMPANY_ADMIN", "ACCOUNTANT", "STAFF"],
    title: "Attendance not completed",
    message: `${missing.length} user(s) do not have attendance for ${start.toLocaleDateString("en-GB")}. Open Attendance Management and mark ✓ or ✕.`,
    type: "WARNING",
    dedupeKey: key,
  });

  return { missing: missing.length };
}
