import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireStaff,
} from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ_OFFSET_MS =
  3 * 60 * 60 * 1000;

function numberValue(
  value: unknown,
): number {
  const parsed = Number(
    value ?? 0,
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function serialize<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(
      value,
      (_key, item) => {
        if (
          typeof item ===
          "bigint"
        ) {
          return Number(item);
        }

        if (
          item &&
          typeof item ===
            "object" &&
          typeof item.toNumber ===
            "function"
        ) {
          return item.toNumber();
        }

        return item;
      },
    ),
  );
}

function parseDateKey(
  value: string,
): {
  year: number;
  month: number;
  day: number;
} {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    );

  if (!match) {
    const now =
      new Date(
        Date.now() +
          TZ_OFFSET_MS,
      );

    return {
      year:
        now.getUTCFullYear(),
      month:
        now.getUTCMonth() +
        1,
      day:
        now.getUTCDate(),
    };
  }

  return {
    year:
      Number(match[1]),
    month:
      Number(match[2]),
    day:
      Number(match[3]),
  };
}

function localDateKey(
  value: unknown,
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(
          String(value),
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const local =
    new Date(
      date.getTime() +
        TZ_OFFSET_MS,
    );

  return [
    local.getUTCFullYear(),
    String(
      local.getUTCMonth() +
        1,
    ).padStart(2, "0"),
    String(
      local.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function localMidnightUtc(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      -3,
      0,
      0,
      0,
    ),
  );
}

function addDays(
  date: Date,
  days: number,
): Date {
  return new Date(
    date.getTime() +
      days *
        24 *
        60 *
        60 *
        1000,
  );
}

function periodBounds(
  period: string,
  anchorKey: string,
) {
  const {
    year,
    month,
    day,
  } = parseDateKey(
    anchorKey,
  );

  const localAnchor =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (period === "YEAR") {
    const start =
      localMidnightUtc(
        year,
        1,
        1,
      );

    return {
      start,
      end: new Date(
        localMidnightUtc(
          year + 1,
          1,
          1,
        ).getTime() - 1,
      ),
      label:
        String(year),
    };
  }

  if (period === "MONTH") {
    const start =
      localMidnightUtc(
        year,
        month,
        1,
      );

    const nextMonth =
      month === 12
        ? localMidnightUtc(
            year + 1,
            1,
            1,
          )
        : localMidnightUtc(
            year,
            month + 1,
            1,
          );

    return {
      start,
      end: new Date(
        nextMonth.getTime() -
          1,
      ),
      label:
        new Intl.DateTimeFormat(
          "en-TZ",
          {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          },
        ).format(
          localAnchor,
        ),
    };
  }

  if (period === "WEEK") {
    const weekday =
      localAnchor.getUTCDay();

    const mondayOffset =
      weekday === 0
        ? -6
        : 1 - weekday;

    const mondayLocal =
      addDays(
        localAnchor,
        mondayOffset,
      );

    const start =
      localMidnightUtc(
        mondayLocal.getUTCFullYear(),
        mondayLocal.getUTCMonth() +
          1,
        mondayLocal.getUTCDate(),
      );

    return {
      start,
      end: new Date(
        addDays(
          start,
          7,
        ).getTime() - 1,
      ),
      label:
        `Week of ${localDateKey(start)}`,
    };
  }

  const start =
    localMidnightUtc(
      year,
      month,
      day,
    );

  return {
    start,
    end: new Date(
      addDays(
        start,
        1,
      ).getTime() - 1,
    ),
    label:
      anchorKey,
  };
}

function currentWeekBounds() {
  const nowLocal =
    new Date(
      Date.now() +
        TZ_OFFSET_MS,
    );

  const weekday =
    nowLocal.getUTCDay();

  const mondayOffset =
    weekday === 0
      ? -6
      : 1 - weekday;

  const mondayLocal =
    new Date(
      Date.UTC(
        nowLocal.getUTCFullYear(),
        nowLocal.getUTCMonth(),
        nowLocal.getUTCDate() +
          mondayOffset,
      ),
    );

  const start =
    localMidnightUtc(
      mondayLocal.getUTCFullYear(),
      mondayLocal.getUTCMonth() +
        1,
      mondayLocal.getUTCDate(),
    );

  return {
    start,
    end: new Date(
      addDays(
        start,
        7,
      ).getTime() - 1,
    ),
  };
}

function inRange(
  value: unknown,
  start: Date,
  end: Date,
): boolean {
  const date =
    new Date(
      String(value),
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return false;
  }

  return (
    date >= start &&
    date <= end
  );
}

function personFromFloat(
  row: any,
  staffId: string,
) {
  if (
    row.brokerCustomer
  ) {
    return row.brokerCustomer;
  }

  if (
    row.fromUserId ===
    staffId
  ) {
    return row.toUser;
  }

  return row.fromUser;
}

function buildTransactionRows(
  input: {
    staffId: string;
    floats: any[];
    collections: any[];
    deposits: any[];
    expenses: any[];
  },
) {
  const floatRows =
    input.floats.map(
      (row) => ({
        id: row.id,
        date:
          row.returnedAt ??
          row.confirmedAt ??
          row.issuedAt ??
          row.createdAt,
        kind: "FLOAT",
        type:
          row.transactionType,
        reference:
          row.referenceNo ??
          row.id,
        description:
          row.purpose ??
          row.transactionType,
        amount:
          numberValue(
            row.returnedAmount ??
              row.amount,
          ),
        status:
          row.status,
        receiptUrl:
          row.receiptUrl,
        person:
          personFromFloat(
            row,
            input.staffId,
          ),
        locked:
          [
            "CONFIRMED",
            "APPROVED",
            "RETURNED",
            "DEPOSITED",
            "REJECTED",
          ].includes(
            row.status,
          ),
      }),
    );

  const collectionRows =
    input.collections.map(
      (row) => ({
        id: row.id,
        date:
          row.collectionDate,
        kind:
          "COLLECTION",
        type:
          "BROKER_COLLECTION",
        reference:
          row.referenceNo,
        description:
          row.description ??
          "Broker collection",
        amount:
          numberValue(
            row.amount,
          ),
        status:
          row.status,
        receiptUrl:
          row.receiptUrl,
        person:
          row.brokerCustomer ??
          row.broker,
        locked:
          row.status !==
          "PENDING",
      }),
    );

  const depositRows =
    input.deposits.map(
      (row) => ({
        id: row.id,
        date:
          row.depositDate,
        kind:
          "BANK_DEPOSIT",
        type:
          "BANK_DEPOSIT",
        reference:
          row.referenceNo ??
          row.id,
        description:
          row.bankAccount ??
          "Bank deposit",
        amount:
          numberValue(
            row.amount,
          ),
        status:
          row.status,
        receiptUrl:
          row.bankReceiptUrl ??
          row.depositSlipUrl,
        person:
          row.accountant,
        locked:
          row.status ===
          "VERIFIED",
      }),
    );

  const expenseRows =
    input.expenses.map(
      (row) => ({
        id: row.id,
        date:
          row.expenseDate,
        kind:
          "EXPENSE",
        type:
          row.category,
        reference:
          row.id,
        description:
          row.description ??
          row.category,
        amount:
          numberValue(
            row.amount,
          ),
        status:
          row.status,
        receiptUrl:
          row.receiptUrl,
        person:
          row.reviewedBy,
        locked:
          row.status !==
          "PENDING",
      }),
    );

  return [
    ...floatRows,
    ...collectionRows,
    ...depositRows,
    ...expenseRows,
  ].sort(
    (left, right) =>
      new Date(
        String(right.date),
      ).getTime() -
      new Date(
        String(left.date),
      ).getTime(),
  );
}

function buildFlowSeries(
  input: {
    start: Date;
    end: Date;
    period: string;
    staffId: string;
    floats: any[];
    collections: any[];
    deposits: any[];
  },
) {
  const rows:
    Array<Record<
      string,
      unknown
    >> = [];

  if (
    input.period ===
    "YEAR"
  ) {
    const localStart =
      new Date(
        input.start.getTime() +
          TZ_OFFSET_MS,
      );

    const year =
      localStart.getUTCFullYear();

    for (
      let month = 0;
      month < 12;
      month += 1
    ) {
      const matches =
        (value: unknown) => {
          const date =
            new Date(
              String(value),
            );

          const local =
            new Date(
              date.getTime() +
                TZ_OFFSET_MS,
            );

          return (
            local.getUTCFullYear() ===
              year &&
            local.getUTCMonth() ===
              month
          );
        };

      rows.push({
        key:
          `${year}-${String(
            month + 1,
          ).padStart(
            2,
            "0",
          )}`,
        label:
          new Intl.DateTimeFormat(
            "en-TZ",
            {
              month:
                "short",
              timeZone:
                "UTC",
            },
          ).format(
            new Date(
              Date.UTC(
                year,
                month,
                1,
              ),
            ),
          ),
        received:
          input.floats
            .filter(
              (row) =>
                row.transactionType ===
                  "ACCOUNTANT_TO_STAFF" &&
                row.toUserId ===
                  input.staffId &&
                matches(
                  row.createdAt,
                ),
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        issued:
          input.floats
            .filter(
              (row) =>
                row.transactionType ===
                  "STAFF_TO_BROKER" &&
                row.fromUserId ===
                  input.staffId &&
                matches(
                  row.createdAt,
                ),
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        collections:
          input.collections
            .filter(
              (row) =>
                matches(
                  row.collectionDate,
                ),
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        deposited:
          input.deposits
            .filter(
              (row) =>
                matches(
                  row.depositDate,
                ),
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
      });
    }

    return rows;
  }

  let cursor =
    new Date(input.start);

  let guard = 0;

  while (
    cursor <= input.end &&
    guard < 370
  ) {
    const key =
      localDateKey(
        cursor,
      );

    const dateMatches =
      (value: unknown) =>
        localDateKey(
          value,
        ) === key;

    rows.push({
      key,
      label:
        input.period ===
        "WEEK"
          ? new Intl.DateTimeFormat(
              "en-TZ",
              {
                weekday:
                  "short",
                timeZone:
                  "Africa/Dar_es_Salaam",
              },
            ).format(cursor)
          : key.slice(5),
      received:
        input.floats
          .filter(
            (row) =>
              row.transactionType ===
                "ACCOUNTANT_TO_STAFF" &&
              row.toUserId ===
                input.staffId &&
              dateMatches(
                row.createdAt,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
      issued:
        input.floats
          .filter(
            (row) =>
              row.transactionType ===
                "STAFF_TO_BROKER" &&
              row.fromUserId ===
                input.staffId &&
              dateMatches(
                row.createdAt,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
      collections:
        input.collections
          .filter(
            (row) =>
              dateMatches(
                row.collectionDate,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
      deposited:
        input.deposits
          .filter(
            (row) =>
              dateMatches(
                row.depositDate,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
    });

    cursor =
      addDays(
        cursor,
        1,
      );

    guard += 1;
  }

  return rows;
}

function buildDailyFlowSeries(
  input: {
    dayKey: string;
    staffId: string;
    floats: any[];
    collections: any[];
    deposits: any[];
  },
) {
  const rows = [];

  for (
    let startHour = 0;
    startHour < 24;
    startHour += 3
  ) {
    const matches =
      (value: unknown) => {
        const date =
          new Date(
            String(value),
          );

        const local =
          new Date(
            date.getTime() +
              TZ_OFFSET_MS,
          );

        return (
          localDateKey(
            date,
          ) ===
            input.dayKey &&
          local.getUTCHours() >=
            startHour &&
          local.getUTCHours() <
            startHour + 3
        );
      };

    rows.push({
      key:
        String(
          startHour,
        ).padStart(
          2,
          "0",
        ),
      label:
        `${String(
          startHour,
        ).padStart(
          2,
          "0",
        )}:00`,
      received:
        input.floats
          .filter(
            (row) =>
              row.transactionType ===
                "ACCOUNTANT_TO_STAFF" &&
              row.toUserId ===
                input.staffId &&
              matches(
                row.createdAt,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
      issued:
        input.floats
          .filter(
            (row) =>
              row.transactionType ===
                "STAFF_TO_BROKER" &&
              row.fromUserId ===
                input.staffId &&
              matches(
                row.createdAt,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
      collections:
        input.collections
          .filter(
            (row) =>
              matches(
                row.collectionDate,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
      deposited:
        input.deposits
          .filter(
            (row) =>
              matches(
                row.depositDate,
              ),
          )
          .reduce(
            (sum, row) =>
              sum +
              numberValue(
                row.amount,
              ),
            0,
          ),
    });
  }

  return rows;
}

export async function GET(
  request: Request,
) {
  try {
    const session =
      await requireStaff();

    const url =
      new URL(request.url);

    const requestedPeriod =
      (
        url.searchParams.get(
          "period",
        ) ||
        "DAY"
      ).toUpperCase();

    const period =
      [
        "DAY",
        "WEEK",
        "MONTH",
        "YEAR",
      ].includes(
        requestedPeriod,
      )
        ? requestedPeriod
        : "DAY";

    const anchor =
      url.searchParams.get(
        "date",
      ) ||
      localDateKey(
        new Date(),
      );

    const report =
      periodBounds(
        period,
        anchor,
      );

    const todayKey =
      localDateKey(
        new Date(),
      );

    const today =
      periodBounds(
        "DAY",
        todayKey,
      );

    const currentWeek =
      currentWeekBounds();

    const [
      staff,
      company,
      accountants,
      brokers,
      customers,
      floats,
      collections,
      deposits,
      expenses,
      attendance,
      weekAttendance,
      notifications,
      services,
      devices,
      gpsAlerts,
      currentFinancialDay,
      performanceRecords,
    ] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: session.id,
          companyId:
            session.companyId,
          role: "STAFF",
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
          profileImageUrl:
            true,
          assignedRegion:
            true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              region: true,
            },
          },
        },
      }),

      prisma.company.findUnique({
        where: {
          id:
            session.companyId,
        },
      }),

      prisma.user.findMany({
        where: {
          companyId:
            session.companyId,
          role:
            "ACCOUNTANT",
          status:
            "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImageUrl:
            true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.brokerCustomer.findMany({
        where: {
          companyId:
            session.companyId,
          status:
            "ACTIVE",
        },
        orderBy: [
          {
            location:
              "asc",
          },
          {
            name: "asc",
          },
        ],
      }),

      prisma.customer.findMany({
        where: {
          companyId:
            session.companyId,
          status:
            "ACTIVE",
        },
        orderBy: [
          {
            region: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),

      prisma.floatTransaction.findMany({
        where: {
          companyId:
            session.companyId,
          OR: [
            {
              fromUserId:
                session.id,
            },
            {
              toUserId:
                session.id,
            },
          ],
        },
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              role: true,
              profileImageUrl:
                true,
            },
          },
          toUser: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              role: true,
              profileImageUrl:
                true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          brokerCustomer:
            true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1000,
      }),

      prisma.staffCollection.findMany({
        where: {
          companyId:
            session.companyId,
          staffId:
            session.id,
        },
        include: {
          broker: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              profileImageUrl:
                true,
            },
          },
          brokerCustomer:
            true,
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          collectionDate:
            "desc",
        },
        take: 1000,
      }),

      prisma.bankDeposit.findMany({
        where: {
          companyId:
            session.companyId,
          staffId:
            session.id,
        },
        include: {
          accountant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          holdClearedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          depositDate:
            "desc",
        },
        take: 1000,
      }),

      prisma.expense.findMany({
        where: {
          companyId:
            session.companyId,
          employeeId:
            session.id,
        },
        include: {
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          expenseDate:
            "desc",
        },
        take: 1000,
      }),

      prisma.attendance.findMany({
        where: {
          companyId:
            session.companyId,
          userId:
            session.id,
          date: {
            gte:
              report.start,
            lte:
              report.end,
          },
        },
        orderBy: {
          date: "desc",
        },
      }),

      prisma.attendance.findMany({
        where: {
          companyId:
            session.companyId,
          userId:
            session.id,
          date: {
            gte:
              currentWeek.start,
            lte:
              currentWeek.end,
          },
        },
        orderBy: {
          date: "asc",
        },
      }),

      prisma.notification.findMany({
        where: {
          companyId:
            session.companyId,
          userId:
            session.id,
        },
        orderBy: {
          createdAt:
            "desc",
        },
        take: 100,
      }),

      prisma.serviceActivity.findMany({
        where: {
          companyId:
            session.companyId,
          staffId:
            session.id,
        },
        include: {
          brokerCustomer:
            true,
          customer: true,
        },
        orderBy: {
          servedAt:
            "desc",
        },
        take: 1000,
      }),

      prisma.companyGpsDevice.findMany({
        where: {
          companyId:
            session.companyId,
          ownerUserId:
            session.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              profileImageUrl:
                true,
            },
          },
          pings: {
            where: {
              capturedAt: {
                gte:
                  report.start,
                lte:
                  report.end,
              },
            },
            orderBy: {
              capturedAt:
                "desc",
            },
            take: 500,
          },
        },
        orderBy: {
          updatedAt:
            "desc",
        },
      }),

      prisma.gpsAlert.findMany({
        where: {
          companyId:
            session.companyId,
          userId:
            session.id,
        },
        orderBy: {
          createdAt:
            "desc",
        },
        take: 100,
      }),

      prisma.financialDay.findFirst({
        where: {
          companyId:
            session.companyId,
          date: {
            gte:
              today.start,
            lte:
              today.end,
          },
        },
        orderBy: {
          date: "desc",
        },
      }),

      prisma.performanceRecord.findMany({
        where: {
          companyId:
            session.companyId,
          userId:
            session.id,
        },
        orderBy: [
          {
            year: "desc",
          },
          {
            month: "desc",
          },
        ],
        take: 24,
      }),
    ]);

    if (!staff) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The active staff account could not be loaded.",
        },
        { status: 404 },
      );
    }

    const ownTransactions =
      buildTransactionRows({
        staffId:
          session.id,
        floats,
        collections,
        deposits,
        expenses,
      });

    const reportRows =
      ownTransactions.filter(
        (row) =>
          inRange(
            row.date,
            report.start,
            report.end,
          ),
      );

    const dailyTransactions =
      ownTransactions.filter(
        (row) =>
          inRange(
            row.date,
            today.start,
            today.end,
          ),
      );

    const dailyDeposits =
      deposits.filter(
        (row) =>
          inRange(
            row.depositDate,
            today.start,
            today.end,
          ),
      );

    const reportFloats =
      floats.filter(
        (row) =>
          inRange(
            row.createdAt,
            report.start,
            report.end,
          ),
      );

    const reportCollections =
      collections.filter(
        (row) =>
          inRange(
            row.collectionDate,
            report.start,
            report.end,
          ),
      );

    const reportDeposits =
      deposits.filter(
        (row) =>
          inRange(
            row.depositDate,
            report.start,
            report.end,
          ),
      );

    const reportExpenses =
      expenses.filter(
        (row) =>
          inRange(
            row.expenseDate,
            report.start,
            report.end,
          ),
      );

    const reportServices =
      services.filter(
        (row) =>
          inRange(
            row.servedAt,
            report.start,
            report.end,
          ),
      );

    const todayFloats =
      floats.filter(
        (row) =>
          inRange(
            row.createdAt,
            today.start,
            today.end,
          ),
      );

    const todayCollections =
      collections.filter(
        (row) =>
          inRange(
            row.collectionDate,
            today.start,
            today.end,
          ),
      );

    const totalReceived =
      reportFloats
        .filter(
          (row) =>
            row.transactionType ===
              "ACCOUNTANT_TO_STAFF" &&
            row.toUserId ===
              session.id &&
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const totalIssued =
      reportFloats
        .filter(
          (row) =>
            row.transactionType ===
              "STAFF_TO_BROKER" &&
            row.fromUserId ===
              session.id &&
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const totalCollections =
      reportCollections
        .filter(
          (row) =>
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const totalReturned =
      reportFloats
        .filter(
          (row) =>
            row.transactionType ===
              "STAFF_RETURN_TO_ACCOUNTANT" &&
            row.fromUserId ===
              session.id &&
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.returnedAmount ??
                row.amount,
            ),
          0,
        );

    const totalBanked =
      reportDeposits
        .filter(
          (row) =>
            row.status !==
              "DUPLICATE_DEPOSIT",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const totalExpenses =
      reportExpenses
        .filter(
          (row) =>
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const allReceived =
      floats
        .filter(
          (row) =>
            row.transactionType ===
              "ACCOUNTANT_TO_STAFF" &&
            row.toUserId ===
              session.id &&
            [
              "CONFIRMED",
              "APPROVED",
              "RETURNED",
              "DEPOSITED",
            ].includes(
              row.status,
            ),
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const allIssued =
      floats
        .filter(
          (row) =>
            row.transactionType ===
              "STAFF_TO_BROKER" &&
            row.fromUserId ===
              session.id &&
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const allCollections =
      collections
        .filter(
          (row) =>
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const allReturned =
      floats
        .filter(
          (row) =>
            row.transactionType ===
              "STAFF_RETURN_TO_ACCOUNTANT" &&
            row.fromUserId ===
              session.id &&
            row.status !==
              "REJECTED",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.returnedAmount ??
                row.amount,
            ),
          0,
        );

    const allBanked =
      deposits
        .filter(
          (row) =>
            row.status !==
              "DUPLICATE_DEPOSIT",
        )
        .reduce(
          (sum, row) =>
            sum +
            numberValue(
              row.amount,
            ),
          0,
        );

    const availableBalance =
      Math.max(
        0,
        allReceived +
          allCollections -
          allIssued -
          allReturned -
          allBanked,
      );

    const attendedDates =
      new Set(
        weekAttendance
          .filter(
            (row) =>
              [
                "PRESENT",
                "LATE",
              ].includes(
                row.status,
              ),
          )
          .map((row) =>
            localDateKey(
              row.date,
            ),
          ),
      );

    const requiredDays = 5;
    const attendedDays =
      Math.min(
        requiredDays,
        attendedDates.size,
      );

    const missedDays =
      Math.max(
        0,
        requiredDays -
          attendedDays,
      );

    const attendanceRate =
      Math.round(
        (attendedDays /
          requiredDays) *
          100,
      );

    const verifiedDeposits =
      reportDeposits.filter(
        (row) =>
          row.status ===
          "VERIFIED",
      ).length;

    const depositAccuracyRate =
      reportDeposits.length
        ? Math.round(
            (verifiedDeposits /
              reportDeposits.length) *
              100,
          )
        : 100;

    const gpsPingCount =
      devices.reduce(
        (sum, device) =>
          sum +
          device.pings.length,
        0,
      );

    const gpsComplianceRate =
      gpsPingCount > 0
        ? 100
        : 0;

    const outstandingBalance =
      Math.max(
        0,
        totalReceived +
          totalCollections -
          totalIssued -
          totalReturned -
          totalBanked,
      );

    const bankMismatches =
      reportDeposits.filter(
        (row) =>
          ![
            "VERIFIED",
            "PENDING",
          ].includes(
            row.status,
          ),
      ).length;

    const attendanceScore =
      attendanceRate;

    const outstandingScore =
      totalReceived +
        totalCollections >
      0
        ? Math.max(
            0,
            100 -
              (outstandingBalance /
                (totalReceived +
                  totalCollections)) *
                100,
          )
        : 100;

    const mismatchScore =
      reportDeposits.length
        ? Math.max(
            0,
            100 -
              (bankMismatches /
                reportDeposits.length) *
                100,
          )
        : 100;

    const performanceScore =
      Math.round(
        attendanceScore *
          0.35 +
          depositAccuracyRate *
            0.25 +
          gpsComplianceRate *
            0.15 +
          mismatchScore *
            0.15 +
          outstandingScore *
            0.1,
      );

    const performanceRating =
      performanceScore >= 90
        ? "Excellent"
        : performanceScore >=
            80
          ? "Very Good"
          : performanceScore >=
              70
            ? "Good"
            : performanceScore >=
                60
              ? "Fair"
              : "Needs Improvement";

    const brokerMap =
      new Map<
        string,
        any
      >();

    for (
      const broker
      of brokers
    ) {
      brokerMap.set(
        broker.id,
        {
          brokerCustomer:
            broker,
          broker,
          brokerCustomerId:
            broker.id,
          visits: 0,
          timesServed: 0,
          amount: 0,
          totalFloat: 0,
          location:
            broker.latitude !=
              null &&
            broker.longitude !=
              null
              ? {
                  latitude:
                    broker.latitude,
                  longitude:
                    broker.longitude,
                }
              : null,
        },
      );
    }

    for (
      const row
      of reportFloats
    ) {
      if (
        row.brokerCustomerId &&
        row.transactionType ===
          "STAFF_TO_BROKER"
      ) {
        const item =
          brokerMap.get(
            row.brokerCustomerId,
          );

        if (item) {
          item.timesServed +=
            1;
          item.totalFloat +=
            numberValue(
              row.amount,
            );
        }
      }
    }

    for (
      const row
      of reportCollections
    ) {
      if (
        row.brokerCustomerId
      ) {
        const item =
          brokerMap.get(
            row.brokerCustomerId,
          );

        if (item) {
          item.amount +=
            numberValue(
              row.amount,
            );
        }
      }
    }

    for (
      const row
      of reportServices
    ) {
      if (
        row.brokerCustomerId
      ) {
        const item =
          brokerMap.get(
            row.brokerCustomerId,
          );

        if (item) {
          item.visits += 1;
          item.amount +=
            numberValue(
              row.amount,
            );
        }
      }
    }

    const customerMap =
      new Map<
        string,
        any
      >();

    for (
      const customer
      of customers
    ) {
      customerMap.set(
        customer.id,
        {
          customer,
          visits: 0,
          amount: 0,
        },
      );
    }

    for (
      const row
      of reportServices
    ) {
      if (row.customerId) {
        const item =
          customerMap.get(
            row.customerId,
          );

        if (item) {
          item.visits += 1;
          item.amount +=
            numberValue(
              row.amount,
            );
        }
      }
    }

    const brokerStats =
      Array.from(
        brokerMap.values(),
      )
        .filter(
          (item) =>
            item.timesServed >
              0 ||
            item.visits > 0 ||
            item.amount > 0,
        )
        .sort(
          (left, right) =>
            right.totalFloat -
            left.totalFloat,
        );

    const customerStats =
      Array.from(
        customerMap.values(),
      )
        .filter(
          (item) =>
            item.visits > 0 ||
            item.amount > 0,
        )
        .sort(
          (left, right) =>
            right.visits -
            left.visits,
        );

    const brokersServed =
      new Set(
        [
          ...reportFloats
            .map(
              (row) =>
                row.brokerCustomerId,
            ),
          ...reportCollections
            .map(
              (row) =>
                row.brokerCustomerId,
            ),
          ...reportServices
            .map(
              (row) =>
                row.brokerCustomerId,
            ),
        ].filter(Boolean),
      ).size;

    const customersServed =
      new Set(
        reportServices
          .map(
            (row) =>
              row.customerId,
          )
          .filter(Boolean),
      ).size;

    const flowSeries =
      buildFlowSeries({
        start:
          report.start,
        end:
          report.end,
        period,
        staffId:
          session.id,
        floats:
          reportFloats,
        collections:
          reportCollections,
        deposits:
          reportDeposits,
      });

    const dailyFlowSeries =
      buildDailyFlowSeries({
        dayKey:
          todayKey,
        staffId:
          session.id,
        floats:
          todayFloats,
        collections:
          todayCollections,
        deposits:
          dailyDeposits,
      });

    const liveLocations =
      devices.map(
        (device) => ({
          id: device.id,
          name:
            device.name,
          owner:
            device.owner,
          status:
            device.status,
          latitude:
            device.lastLatitude,
          longitude:
            device.lastLongitude,
          accuracy:
            device.gpsAccuracy,
          batteryLevel:
            device.batteryLevel,
          speedKph:
            device.speedKph,
          lastSeenAt:
            device.lastSeenAt,
        }),
      );

    const financialHold =
      deposits.find(
        (row) =>
          row.holdActive,
      ) ?? null;

    const currentPerformance =
      {
        totalFloatIssued:
          totalIssued,
        totalFloatReceived:
          totalReceived,
        totalCollections,
        totalReturned,
        totalBanked,
        outstandingBalance,
        averageReturnMinutes:
          0,
        depositAccuracyRate,
        bankMismatches,
        attendanceRate,
        gpsComplianceRate,
        customerVisits:
          customersServed,
        brokerVisits:
          brokersServed,
        transactionsCompleted:
          reportRows.length,
        approvalComplianceRate:
          100,
        score:
          Math.max(
            0,
            Math.min(
              100,
              performanceScore,
            ),
          ),
        rating:
          performanceRating,
      };

    const reportSummary =
      {
        period,
        label:
          report.label,
        totalFloatReceived:
          totalReceived,
        totalFloatIssued:
          totalIssued,
        totalCollections,
        totalReturned,
        totalBanked,
        totalExpenses,
        dailyReturn:
          totalReturned +
          totalBanked,
        outstandingBalance,
        brokersServed,
        customersServed,
        bankMismatches,
        attendanceRate,
        requiredAttendanceDays:
          requiredDays,
        attendedDays,
      };

    return NextResponse.json({
      success: true,
      staff,
      company,
      brokers,
      accountants,
      customers,
      assignments: {
        brokerCount:
          brokers.length,
        customerCount:
          customers.length,
      },
      floats,
      collections,
      deposits:
        deposits.map(
          (row) => ({
            ...row,
            comparison:
              row.comparisonJson
                ? (() => {
                    try {
                      return JSON.parse(
                        row.comparisonJson,
                      );
                    } catch {
                      return null;
                    }
                  })()
                : null,
          }),
        ),
      expenses,
      attendance,
      attendanceSummary: {
        requiredDays,
        attendedDays,
        missedDays,
        rate:
          attendanceRate,
        period:
          "CURRENT_WEEK",
        rule:
          "Staff is expected to supply float Monday to Friday.",
      },
      notifications,
      services,
      devices,
      liveLocations,
      gpsAlerts,
      currentFinancialDay,
      latestPerformanceRecords:
        performanceRecords,
      currentPerformance,
      ranking: [
        {
          id:
            staff.id,
          rank: 1,
          totalStaff: 1,
          name:
            staff.name,
          email:
            staff.email,
          profileImageUrl:
            staff.profileImageUrl,
          score:
            currentPerformance.score,
          rating:
            currentPerformance.rating,
        },
      ],
      brokerStats,
      customerStats,
      assignedTransactions:
        ownTransactions,
      dailyTransactions,
      dailyDeposits,
      dailyFlowSeries,
      reportSummary,
      reportRows,
      flowSeries,
      financialHold,
      stats: {
        todayFloatReceived:
          todayFloats
            .filter(
              (row) =>
                row.transactionType ===
                  "ACCOUNTANT_TO_STAFF" &&
                row.toUserId ===
                  session.id &&
                row.status !==
                  "REJECTED",
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        todayIssued:
          todayFloats
            .filter(
              (row) =>
                row.transactionType ===
                  "STAFF_TO_BROKER" &&
                row.fromUserId ===
                  session.id &&
                row.status !==
                  "REJECTED",
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        todayCollections:
          todayCollections
            .filter(
              (row) =>
                row.status !==
                  "REJECTED",
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        todayReturned:
          todayFloats
            .filter(
              (row) =>
                row.transactionType ===
                  "STAFF_RETURN_TO_ACCOUNTANT" &&
                row.fromUserId ===
                  session.id &&
                row.status !==
                  "REJECTED",
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.returnedAmount ??
                    row.amount,
                ),
              0,
            ),
        todayBanked:
          dailyDeposits
            .filter(
              (row) =>
                row.status !==
                  "DUPLICATE_DEPOSIT",
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.amount,
                ),
              0,
            ),
        brokersServed,
        customersServed,
        pendingApprovals:
          ownTransactions.filter(
            (row) =>
              [
                "PENDING",
                "ISSUED",
              ].includes(
                row.status,
              ),
          ).length,
        availableBalance,
        performanceScore:
          currentPerformance.score,
        attendanceRate,
        gpsCompliance:
          gpsComplianceRate,
      },
    });
  } catch (error) {
    const code =
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error
        ? String(
            (error as {
              code?: unknown;
            }).code ?? "",
          )
        : "";

    const details =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "STAFF_DASHBOARD_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          code === "P2021" ||
          code === "P2022"
            ? "The staff dashboard database is not synchronized."
            : "The staff dashboard could not load.",
        code,
        details,
      },
      { status: 500 },
    );
  }
}
