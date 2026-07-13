import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  accountantRouteError,
  blockingDepositStatuses,
  numberValue,
  requireAccountant,
  tanzaniaDayBounds,
  tanzaniaMonthBounds,
} from "@/lib/accountant-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sumMoney(items: any[], field: string) {
  return items.reduce(
    (total, item) => total + numberValue(item?.[field]),
    0,
  );
}

function monthBoundsByOffset(offset: number) {
  const now = new Date();

  const shifted = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + offset,
      15,
      12,
      0,
      0,
    ),
  );

  return tanzaniaMonthBounds(shifted);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-TZ", {
    month: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

function serializeUser(user: any) {
  return user
    ? {
        id: String(user.id),
        name: String(user.name ?? "User"),
        username: String(user.username ?? ""),
        email: String(user.email ?? ""),
        phone: String(user.phone ?? ""),
        role: String(user.role ?? ""),
        status: String(user.status ?? ""),
        branchId: user.branchId ? String(user.branchId) : "",
      }
    : null;
}

function hasDelegateMethod(
  db: Record<string, any>,
  delegate: string,
  method: string,
) {
  return typeof db?.[delegate]?.[method] === "function";
}

function queryErrorDetails(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as {
      code?: unknown;
      message?: unknown;
      name?: unknown;
    };

    return {
      code: value.code ? String(value.code) : "UNKNOWN",
      name: value.name ? String(value.name) : "Error",
      message: value.message
        ? String(value.message)
        : String(error),
    };
  }

  return {
    code: "UNKNOWN",
    name: "Error",
    message: String(error),
  };
}

async function safeQuery<T>(
  label: string,
  task: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const details = queryErrorDetails(error);

    console.warn(
      `[ACCOUNTANT_DASHBOARD_QUERY] ${label} failed`,
      {
        code: details.code,
        name: details.name,
        message: details.message,
      },
    );

    return fallback;
  }
}

async function safeFindMany<T = any>(
  db: Record<string, any>,
  delegate: string,
  args: Record<string, any>,
): Promise<T[]> {
  if (!hasDelegateMethod(db, delegate, "findMany")) {
    console.warn(
      `[ACCOUNTANT_DASHBOARD_QUERY] Prisma model "${delegate}" is unavailable. Returning an empty list.`,
    );

    return [];
  }

  return safeQuery<T[]>(
    delegate,
    () => db[delegate].findMany(args),
    [],
  );
}

async function safeFindUnique<T = any>(
  db: Record<string, any>,
  delegate: string,
  args: Record<string, any>,
): Promise<T | null> {
  if (!hasDelegateMethod(db, delegate, "findUnique")) {
    console.warn(
      `[ACCOUNTANT_DASHBOARD_QUERY] Prisma model "${delegate}" is unavailable.`,
    );

    return null;
  }

  return safeQuery<T | null>(
    delegate,
    () => db[delegate].findUnique(args),
    null,
  );
}

export async function GET() {
  try {
    const accountant = await requireAccountant(false);

    const companyId = accountant.companyId;
    const db = prisma as any;

    const accountingPeriodsAvailable = hasDelegateMethod(
      db,
      "accountingPeriod",
      "findMany",
    );

    const [
      company,
      users,
      branches,
      financialDays,
      expensesRaw,
      depositsRaw,
      floatsRaw,
      attendanceRaw,
      notifications,
      serviceActivitiesRaw,
      customersRaw,
      periodsRaw,
      settingsRaw,
      auditLogsRaw,
    ] = await Promise.all([
      safeFindUnique(db, "company", {
        where: {
          id: companyId,
        },
      }),

      safeFindMany(db, "user", {
        where: {
          companyId,
          status: {
            not: "REMOVED",
          },
        },
        orderBy: [
          {
            role: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),

      safeFindMany(db, "branch", {
        where: {
          companyId,
        },
        orderBy: {
          name: "asc",
        },
      }),

      safeFindMany(db, "financialDay", {
        where: {
          companyId,
        },
        orderBy: [
          {
            date: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 730,
      }),

      safeFindMany(db, "expense", {
        where: {
          companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5000,
      }),

      /**
       * Do not add:
       *
       * include: {
       *   holdClearedBy: true
       * }
       *
       * because your current BankDeposit Prisma model does not
       * contain the holdClearedBy relation.
       */
      safeFindMany(db, "bankDeposit", {
        where: {
          companyId,
        },
        orderBy: [
          {
            depositDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 5000,
      }),

      safeFindMany(db, "floatTransaction", {
        where: {
          companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5000,
      }),

      safeFindMany(db, "attendance", {
        where: {
          companyId,
        },
        orderBy: [
          {
            date: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 20000,
      }),

      safeFindMany(db, "notification", {
        where: {
          companyId,
          userId: accountant.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 250,
      }),

      safeFindMany(db, "serviceActivity", {
        where: {
          companyId,
        },
        orderBy: {
          servedAt: "desc",
        },
        take: 10000,
      }),

      safeFindMany(db, "customer", {
        where: {
          companyId,
        },
        orderBy: {
          name: "asc",
        },
        take: 10000,
      }),

      accountingPeriodsAvailable
        ? safeFindMany(db, "accountingPeriod", {
            where: {
              companyId,
            },
            orderBy: {
              startsAt: "desc",
            },
            take: 120,
          })
        : Promise.resolve([]),

      safeFindMany(db, "companySetting", {
        where: {
          companyId,
        },
      }),

      safeFindMany(db, "auditLog", {
        where: {
          companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 250,
      }),
    ]);

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The accountant company could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const now = new Date();
    const today = tanzaniaDayBounds(now);
    const month = tanzaniaMonthBounds(now);

    /*
     * Relations are resolved manually.
     *
     * This prevents Prisma validation errors when a relation
     * does not exist in the generated Prisma Client.
     */
    const userById = new Map(
      users.map((item: any) => [
        String(item.id),
        item,
      ]),
    );

    const branchById = new Map(
      branches.map((item: any) => [
        String(item.id),
        item,
      ]),
    );

    const customerById = new Map(
      customersRaw.map((item: any) => [
        String(item.id),
        item,
      ]),
    );

    const expenses = expensesRaw.map((item: any) => ({
      ...item,

      amount: numberValue(item.amount),

      employee: serializeUser(
        item.employee ??
          userById.get(
            String(item.employeeId ?? ""),
          ),
      ),

      reviewedBy: serializeUser(
        item.reviewedBy ??
          userById.get(
            String(item.reviewedById ?? ""),
          ),
      ),
    }));

    const deposits = depositsRaw.map((item: any) => ({
      ...item,

      amount: numberValue(item.amount),

      staff: serializeUser(
        item.staff ??
          userById.get(
            String(item.staffId ?? ""),
          ),
      ),

      accountant: serializeUser(
        item.accountant ??
          userById.get(
            String(item.accountantId ?? ""),
          ),
      ),

      /*
       * Resolve the user manually from holdClearedById.
       * This does not require a Prisma relation include.
       */
      holdClearedBy: serializeUser(
        item.holdClearedBy ??
          userById.get(
            String(item.holdClearedById ?? ""),
          ),
      ),
    }));

    const floats = floatsRaw.map((item: any) => ({
      ...item,

      amount: numberValue(item.amount),

      fromUser: serializeUser(
        item.fromUser ??
          userById.get(
            String(item.fromUserId ?? ""),
          ),
      ),

      toUser: serializeUser(
        item.toUser ??
          userById.get(
            String(item.toUserId ?? ""),
          ),
      ),
    }));

    const attendance = attendanceRaw.map(
      (item: any) => ({
        ...item,

        user: serializeUser(
          item.user ??
            userById.get(
              String(item.userId ?? ""),
            ),
        ),
      }),
    );

    const serviceActivities =
      serviceActivitiesRaw.map((item: any) => {
        const customer =
          item.customer ??
          customerById.get(
            String(item.customerId ?? ""),
          );

        return {
          ...item,

          amount: numberValue(item.amount),

          staff: serializeUser(
            item.staff ??
              userById.get(
                String(item.staffId ?? ""),
              ),
          ),

          broker: serializeUser(
            item.broker ??
              userById.get(
                String(item.brokerId ?? ""),
              ),
          ),

          customer: customer
            ? {
                id: String(customer.id),

                name: String(
                  customer.name ?? "Customer",
                ),

                phone: String(
                  customer.phone ?? "",
                ),

                email: String(
                  customer.email ?? "",
                ),
              }
            : null,
        };
      });

    const currentDay =
      financialDays.find(
        (item: any) =>
          new Date(item.date) >= today.start &&
          new Date(item.date) <= today.end,
      ) ?? null;

    const latestFinancialDay =
      financialDays[0] ?? null;

    const approvedExpenses = expenses.filter(
      (item: any) =>
        item.status === "APPROVED",
    );

    const verifiedDeposits = deposits.filter(
      (item: any) =>
        item.status === "VERIFIED",
    );

    const completedServices =
      serviceActivities.filter(
        (item: any) =>
          item.status === "COMPLETED",
      );

    const monthlyExpenses =
      approvedExpenses.filter(
        (item: any) =>
          new Date(item.createdAt) >=
            month.start &&
          new Date(item.createdAt) <=
            month.end,
      );

    const monthlyDeposits =
      verifiedDeposits.filter(
        (item: any) =>
          new Date(item.depositDate) >=
            month.start &&
          new Date(item.depositDate) <=
            month.end,
      );

    const monthlyServices =
      completedServices.filter(
        (item: any) =>
          new Date(item.servedAt) >=
            month.start &&
          new Date(item.servedAt) <=
            month.end,
      );

    const monthlyIncome = sumMoney(
      monthlyServices,
      "amount",
    );

    const monthlyExpenseTotal = sumMoney(
      monthlyExpenses,
      "amount",
    );

    const monthlyDepositTotal = sumMoney(
      monthlyDeposits,
      "amount",
    );

    const netProfit =
      monthlyIncome - monthlyExpenseTotal;

    const calculatedBalance =
      sumMoney(verifiedDeposits, "amount") -
      sumMoney(approvedExpenses, "amount");

    const totalBalance = latestFinancialDay
      ? latestFinancialDay.status === "CLOSED"
        ? numberValue(
            latestFinancialDay.closingBalance,
          )
        : numberValue(
            latestFinancialDay.openingBalance,
          ) +
          numberValue(
            latestFinancialDay.cashIn,
          ) -
          numberValue(
            latestFinancialDay.cashOut,
          )
      : calculatedBalance;

    const unresolvedDeposits =
      deposits.filter((item: any) =>
        blockingDepositStatuses.includes(
          item.status,
        ),
      );

    const pendingExpenses = expenses.filter(
      (item: any) =>
        item.status === "PENDING",
    );

    const pendingDeposits = deposits.filter(
      (item: any) =>
        item.status === "PENDING",
    );

    const pendingFloats = floats.filter(
      (item: any) =>
        [
          "PENDING",
          "ISSUED",
          "CONFIRMED",
        ].includes(item.status),
    );

    const monthlySeries = Array.from(
      {
        length: 8,
      },
      (_, index) => {
        const offset = index - 7;
        const bounds =
          monthBoundsByOffset(offset);

        const income = completedServices
          .filter(
            (item: any) =>
              new Date(item.servedAt) >=
                bounds.start &&
              new Date(item.servedAt) <=
                bounds.end,
          )
          .reduce(
            (
              total: number,
              item: any,
            ) =>
              total +
              numberValue(item.amount),
            0,
          );

        const expense = approvedExpenses
          .filter(
            (item: any) =>
              new Date(item.createdAt) >=
                bounds.start &&
              new Date(item.createdAt) <=
                bounds.end,
          )
          .reduce(
            (
              total: number,
              item: any,
            ) =>
              total +
              numberValue(item.amount),
            0,
          );

        const deposit = verifiedDeposits
          .filter(
            (item: any) =>
              new Date(item.depositDate) >=
                bounds.start &&
              new Date(item.depositDate) <=
                bounds.end,
          )
          .reduce(
            (
              total: number,
              item: any,
            ) =>
              total +
              numberValue(item.amount),
            0,
          );

        return {
          key: bounds.start.toISOString(),
          label: monthLabel(bounds.start),
          income,
          expense,
          deposit,
          profit: income - expense,
        };
      },
    );

    const categoryMap =
      new Map<string, number>();

    approvedExpenses.forEach(
      (item: any) => {
        const category = String(
          item.category || "Other",
        );

        categoryMap.set(
          category,
          (categoryMap.get(category) ?? 0) +
            numberValue(item.amount),
        );
      },
    );

    const spendingBreakdown =
      Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
        }))
        .sort(
          (a, b) =>
            b.amount - a.amount,
        );

    const cashBook = [
      ...verifiedDeposits.map(
        (item: any) => ({
          id: `deposit-${item.id}`,

          date: item.depositDate,

          reference:
            item.referenceNo ||
            item.id,

          description:
            `Verified bank deposit by ${
              item.staff?.name || "staff"
            }`,

          account:
            item.bankAccount || "Bank",

          debit: numberValue(
            item.amount,
          ),

          credit: 0,

          type: "DEPOSIT",

          status: item.status,
        }),
      ),

      ...approvedExpenses.map(
        (item: any) => ({
          id: `expense-${item.id}`,

          date:
            item.reviewedAt ||
            item.createdAt,

          reference: item.id,

          description:
            `${item.category} expense — ${
              item.employee?.name ||
              "employee"
            }`,

          account: item.category,

          debit: 0,

          credit: numberValue(
            item.amount,
          ),

          type: "EXPENSE",

          status: item.status,
        }),
      ),
    ].sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime(),
    );

    let runningBalance = 0;

    const cashBookWithBalance = [
      ...cashBook,
    ]
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime(),
      )
      .map((entry) => {
        runningBalance +=
          entry.debit - entry.credit;

        return {
          ...entry,
          balance: runningBalance,
        };
      })
      .reverse();

    const ledgerMap = new Map<
      string,
      {
        account: string;
        debit: number;
        credit: number;
      }
    >();

    const postLedger = (
      account: string,
      debit: number,
      credit: number,
    ) => {
      const current =
        ledgerMap.get(account) ?? {
          account,
          debit: 0,
          credit: 0,
        };

      current.debit += debit;
      current.credit += credit;

      ledgerMap.set(
        account,
        current,
      );
    };

    completedServices.forEach(
      (item: any) => {
        const amount = numberValue(
          item.amount,
        );

        postLedger(
          "Accounts Receivable / Cash",
          amount,
          0,
        );

        postLedger(
          "Service Revenue",
          0,
          amount,
        );
      },
    );

    approvedExpenses.forEach(
      (item: any) => {
        const amount = numberValue(
          item.amount,
        );

        postLedger(
          `Expense — ${item.category}`,
          amount,
          0,
        );

        postLedger(
          "Bank / Cash",
          0,
          amount,
        );
      },
    );

    const ledger = Array.from(
      ledgerMap.values(),
    ).map((item) => ({
      ...item,
      balance:
        item.debit - item.credit,
    }));

    const totalDebit = ledger.reduce(
      (total, item) =>
        total + item.debit,
      0,
    );

    const totalCredit = ledger.reduce(
      (total, item) =>
        total + item.credit,
      0,
    );

    const outstandingFloat =
      pendingFloats.reduce(
        (
          total: number,
          item: any,
        ) =>
          total +
          numberValue(item.amount),
        0,
      );

    const financeStatements = {
      balanceSheet: {
        cashAndBank: totalBalance,

        staffFloatReceivable:
          outstandingFloat,

        totalAssets:
          totalBalance +
          outstandingFloat,

        liabilities: 0,

        equity:
          totalBalance +
          outstandingFloat,
      },

      profitAndLoss: {
        revenue: sumMoney(
          completedServices,
          "amount",
        ),

        expenses: sumMoney(
          approvedExpenses,
          "amount",
        ),

        netProfit:
          sumMoney(
            completedServices,
            "amount",
          ) -
          sumMoney(
            approvedExpenses,
            "amount",
          ),
      },

      monthlyProfitAndLoss: {
        revenue: monthlyIncome,
        expenses:
          monthlyExpenseTotal,
        netProfit,
      },

      cashFlow: {
        operatingInflow: sumMoney(
          verifiedDeposits,
          "amount",
        ),

        operatingOutflow: sumMoney(
          approvedExpenses,
          "amount",
        ),

        netCashFlow:
          sumMoney(
            verifiedDeposits,
            "amount",
          ) -
          sumMoney(
            approvedExpenses,
            "amount",
          ),
      },
    };

    const recentTransactions = [
      ...cashBookWithBalance.slice(
        0,
        10,
      ),

      ...floats
        .slice(0, 5)
        .map((item: any) => ({
          id: `float-${item.id}`,

          date: item.createdAt,

          reference: item.id,

          description:
            `Float: ${
              item.fromUser?.name ||
              "Company"
            } → ${
              item.toUser?.name ||
              "Staff"
            }`,

          account: "Staff Float",

          debit: 0,

          credit: numberValue(
            item.amount,
          ),

          balance: 0,

          type: "FLOAT",

          status: item.status,
        })),
    ]
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime(),
      )
      .slice(0, 12);

    const holdMap =
      new Map<string, any>();

    unresolvedDeposits.forEach(
      (deposit: any) => {
        const staffId = String(
          deposit.staffId ?? "",
        );

        const current =
          holdMap.get(staffId) ?? {
            staffId,
            staff: deposit.staff,
            count: 0,
            amount: 0,
            statuses:
              new Set<string>(),
          };

        current.count += 1;

        current.amount +=
          numberValue(
            deposit.amount,
          );

        current.statuses.add(
          deposit.status,
        );

        holdMap.set(
          staffId,
          current,
        );
      },
    );

    const financialHolds =
      Array.from(
        holdMap.values(),
      ).map((item: any) => ({
        ...item,
        statuses: Array.from(
          item.statuses,
        ),
      }));

    const settingMap =
      Object.fromEntries(
        settingsRaw.map(
          (item: any) => [
            item.key,
            item.value,
          ],
        ),
      );

    return NextResponse.json({
      success: true,

      accountant: {
        id: accountant.id,
        name: accountant.name,
        role: accountant.role,
      },

      company: {
        id: String(company.id),

        name: String(company.name),

        code: String(
          company.code ?? "",
        ),

        email: String(
          company.email ?? "",
        ),

        phone: String(
          company.phone ?? "",
        ),

        address: String(
          company.address ?? "",
        ),

        status: String(
          company.status ?? "",
        ),
      },

      features: {
        accountingPeriods:
          accountingPeriodsAvailable,
      },

      stats: {
        totalBalance,

        monthlyIncome,

        monthlyExpenses:
          monthlyExpenseTotal,

        monthlyDeposits:
          monthlyDepositTotal,

        netProfit,

        pendingExpenses:
          pendingExpenses.length,

        pendingDeposits:
          pendingDeposits.length,

        unresolvedMismatches:
          unresolvedDeposits.length,

        pendingFloats:
          pendingFloats.length,

        outstandingFloat,

        unreadNotifications:
          notifications.filter(
            (item: any) =>
              !item.isRead,
          ).length,
      },

      currentDay: currentDay
        ? {
            ...currentDay,

            openingBalance:
              numberValue(
                currentDay.openingBalance,
              ),

            cashIn: numberValue(
              currentDay.cashIn,
            ),

            cashOut: numberValue(
              currentDay.cashOut,
            ),

            closingBalance:
              numberValue(
                currentDay.closingBalance,
              ),
          }
        : null,

      financialDays:
        financialDays.map(
          (item: any) => ({
            ...item,

            openingBalance:
              numberValue(
                item.openingBalance,
              ),

            cashIn:
              numberValue(
                item.cashIn,
              ),

            cashOut:
              numberValue(
                item.cashOut,
              ),

            closingBalance:
              numberValue(
                item.closingBalance,
              ),
          }),
        ),

      users: users.map(
        (item: any) => {
          const branch =
            item.branch ??
            branchById.get(
              String(
                item.branchId ?? "",
              ),
            );

          return {
            ...serializeUser(item),

            branchName:
              branch?.name ?? "",

            branchCode:
              branch?.code ?? "",
          };
        },
      ),

      branches,

      expenses,

      deposits,

      floats,

      attendance,

      notifications,

      serviceActivities,

      periods: periodsRaw.map(
        (item: any) => ({
          ...item,

          lockedBy:
            serializeUser(
              item.lockedBy ??
                userById.get(
                  String(
                    item.lockedById ??
                      "",
                  ),
                ),
            ),
        }),
      ),

      auditLogs:
        auditLogsRaw.map(
          (item: any) => ({
            ...item,

            user: serializeUser(
              item.user ??
                userById.get(
                  String(
                    item.userId ?? "",
                  ),
                ),
            ),
          }),
        ),

      monthlySeries,

      spendingBreakdown,

      cashBook:
        cashBookWithBalance,

      ledger,

      trialBalance: {
        rows: ledger,

        totalDebit,

        totalCredit,

        balanced:
          Math.abs(
            totalDebit -
              totalCredit,
          ) < 0.01,
      },

      statements:
        financeStatements,

      recentTransactions,

      financialHolds,

      settings: settingMap,
    });
  } catch (error) {
    return accountantRouteError(
      error,
    );
  }
}