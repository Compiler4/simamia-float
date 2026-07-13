import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  AccountantHttpError,
  accountantRouteError,
  accountingPeriodDetails,
  blockingDepositStatuses,
  createAudit,
  decimalValue,
  ensurePeriodOpen,
  notifyRoles,
  notifyUser,
  numberValue,
  requireAccountant,
  text,
  tanzaniaDateKey,
  tanzaniaDayBounds,
} from "@/lib/accountant-server";

export const runtime = "nodejs";

async function recalculateFinancialDay(
  db: any,
  companyId: string,
  date: Date,
) {
  const bounds = tanzaniaDayBounds(date);
  const day = await db.financialDay.findUnique({
    where: {
      companyId_date: {
        companyId,
        date: bounds.start,
      },
    },
  });

  if (!day) return null;

  const [depositAggregate, expenseAggregate] = await Promise.all([
    db.bankDeposit.aggregate({
      where: {
        companyId,
        status: "VERIFIED",
        depositDate: {
          gte: bounds.start,
          lte: bounds.end,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        status: "APPROVED",
        OR: [
          {
            reviewedAt: {
              gte: bounds.start,
              lte: bounds.end,
            },
          },
          {
            reviewedAt: null,
            createdAt: {
              gte: bounds.start,
              lte: bounds.end,
            },
          },
        ],
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const cashIn = numberValue(depositAggregate._sum.amount);
  const cashOut = numberValue(expenseAggregate._sum.amount);
  const openingBalance = numberValue(day.openingBalance);
  const closingBalance = openingBalance + cashIn - cashOut;

  return db.financialDay.update({
    where: { id: day.id },
    data: {
      cashIn: cashIn.toFixed(2),
      cashOut: cashOut.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
    },
  });
}

async function blockFinancialDay(
  db: any,
  companyId: string,
  date: Date,
  reason: string,
) {
  const bounds = tanzaniaDayBounds(date);

  await db.financialDay.updateMany({
    where: {
      companyId,
      date: bounds.start,
      status: {
        in: ["OPEN", "BLOCKED"],
      },
    },
    data: {
      status: "BLOCKED",
      blockedReason: reason,
    },
  });
}

async function tryUnblockFinancialDay(
  db: any,
  companyId: string,
  date: Date,
) {
  const unresolved = await db.bankDeposit.count({
    where: {
      companyId,
      status: {
        in: [...blockingDepositStatuses],
      },
    },
  });

  if (unresolved > 0) return;

  const bounds = tanzaniaDayBounds(date);

  await db.financialDay.updateMany({
    where: {
      companyId,
      date: bounds.start,
      status: "BLOCKED",
    },
    data: {
      status: "OPEN",
      blockedReason: null,
    },
  });
}

function sameText(left: unknown, right: unknown) {
  return text(left).trim().toLowerCase() ===
    text(right).trim().toLowerCase();
}

function sameDate(left: unknown, right: unknown) {
  if (!left || !right) return false;

  return (
    tanzaniaDateKey(new Date(String(left))) ===
    tanzaniaDateKey(new Date(String(right)))
  );
}

async function handleOpenDay(
  db: any,
  accountant: any,
  body: any,
) {
  const date = body.date ? new Date(body.date) : new Date();
  const bounds = tanzaniaDayBounds(date);

  await ensurePeriodOpen(accountant.companyId, bounds.start);

  const existing = await db.financialDay.findUnique({
    where: {
      companyId_date: {
        companyId: accountant.companyId,
        date: bounds.start,
      },
    },
  });

  if (existing) {
    throw new AccountantHttpError(
      `The financial day is already ${String(existing.status).toLowerCase()}.`,
      409,
    );
  }

  const latestClosed = await db.financialDay.findFirst({
    where: {
      companyId: accountant.companyId,
      status: "CLOSED",
      date: {
        lt: bounds.start,
      },
    },
    orderBy: { date: "desc" },
  });

  const openingBalance =
    body.openingBalance !== undefined &&
    text(body.openingBalance) !== ""
      ? decimalValue(body.openingBalance)
      : numberValue(latestClosed?.closingBalance).toFixed(2);

  const day = await db.financialDay.create({
    data: {
      companyId: accountant.companyId,
      date: bounds.start,
      openingBalance,
      closingBalance: openingBalance,
      status: "OPEN",
      openedById: accountant.id,
      openedAt: new Date(),
    },
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: "OPEN_FINANCIAL_DAY",
    module: "ACCOUNTING",
    details: `Opened ${tanzaniaDateKey(bounds.start)} with TZS ${openingBalance}.`,
  });

  await notifyRoles({
    companyId: accountant.companyId,
    roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
    title: "Financial day opened",
    message: `${accountant.name} opened the financial day for ${tanzaniaDateKey(
      bounds.start,
    )}.`,
    type: "SUCCESS",
    excludeUserId: accountant.id,
  });

  return {
    message: "Financial day opened successfully.",
    data: day,
  };
}

async function handleCloseDay(
  db: any,
  accountant: any,
  body: any,
) {
  const date = body.date ? new Date(body.date) : new Date();
  const bounds = tanzaniaDayBounds(date);

  const day = body.financialDayId
    ? await db.financialDay.findFirst({
        where: {
          id: text(body.financialDayId),
          companyId: accountant.companyId,
        },
      })
    : await db.financialDay.findUnique({
        where: {
          companyId_date: {
            companyId: accountant.companyId,
            date: bounds.start,
          },
        },
      });

  if (!day) {
    throw new AccountantHttpError(
      "Open the financial day before closing it.",
      404,
    );
  }

  if (day.status === "CLOSED") {
    throw new AccountantHttpError(
      "This financial day is already closed.",
      409,
    );
  }

  const unresolvedDeposits = await db.bankDeposit.findMany({
    where: {
      companyId: accountant.companyId,
      status: {
        in: [...blockingDepositStatuses],
      },
    },
    select: {
      id: true,
      referenceNo: true,
      status: true,
    },
    take: 20,
  });

  if (unresolvedDeposits.length > 0) {
    const reason = `${unresolvedDeposits.length} unresolved bank deposit mismatch(es) block day closing.`;

    await db.financialDay.update({
      where: { id: day.id },
      data: {
        status: "BLOCKED",
        blockedReason: reason,
      },
    });

    await notifyRoles({
      companyId: accountant.companyId,
      roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
      title: "Day closing blocked",
      message: reason,
      type: "ERROR",
    });

    throw new AccountantHttpError(reason, 409);
  }

  const recalculated = await recalculateFinancialDay(
    db,
    accountant.companyId,
    day.date,
  );

  const closingBalance = numberValue(
    recalculated?.closingBalance ?? day.closingBalance,
  );

  const closed = await db.financialDay.update({
    where: { id: day.id },
    data: {
      status: "CLOSED",
      blockedReason: null,
      closingBalance: closingBalance.toFixed(2),
      closedById: accountant.id,
      closedAt: new Date(),
    },
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: "CLOSE_FINANCIAL_DAY",
    module: "ACCOUNTING",
    details: `Closed ${tanzaniaDateKey(day.date)} at TZS ${closingBalance.toFixed(
      2,
    )}.`,
  });

  await notifyRoles({
    companyId: accountant.companyId,
    roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
    title: "Financial day closed",
    message: `${accountant.name} closed the financial day with TZS ${closingBalance.toLocaleString()}.`,
    type: "SUCCESS",
    excludeUserId: accountant.id,
  });

  return {
    message: "Financial day closed successfully.",
    data: closed,
  };
}

async function handleOpeningBalance(
  db: any,
  accountant: any,
  body: any,
) {
  const id = text(body.financialDayId);
  const amount = decimalValue(body.openingBalance);

  const day = await db.financialDay.findFirst({
    where: {
      id,
      companyId: accountant.companyId,
    },
  });

  if (!day) {
    throw new AccountantHttpError("Financial day not found.", 404);
  }

  if (day.status === "CLOSED") {
    throw new AccountantHttpError(
      "A closed financial day cannot be edited.",
      409,
    );
  }

  await ensurePeriodOpen(accountant.companyId, day.date);

  const updated = await db.financialDay.update({
    where: { id },
    data: {
      openingBalance: amount,
    },
  });

  await recalculateFinancialDay(
    db,
    accountant.companyId,
    day.date,
  );

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: "UPDATE_OPENING_BALANCE",
    module: "ACCOUNTING",
    details: `${tanzaniaDateKey(day.date)} opening balance set to TZS ${amount}.`,
  });

  return {
    message: "Opening balance updated.",
    data: updated,
  };
}

async function handleExpenseDecision(
  db: any,
  accountant: any,
  body: any,
  status: "APPROVED" | "REJECTED",
) {
  const expense = await db.expense.findFirst({
    where: {
      id: text(body.expenseId),
      companyId: accountant.companyId,
    },
    include: {
      employee: true,
    },
  });

  if (!expense) {
    throw new AccountantHttpError("Expense request not found.", 404);
  }

  if (expense.status !== "PENDING") {
    throw new AccountantHttpError(
      `This expense is already ${String(expense.status).toLowerCase()}.`,
      409,
    );
  }

  await ensurePeriodOpen(
    accountant.companyId,
    new Date(expense.createdAt),
  );

  const updated = await db.expense.update({
    where: { id: expense.id },
    data: {
      status,
      reviewedById: accountant.id,
      reviewedAt: new Date(),
      reviewNote: text(body.reviewNote).trim() || null,
    },
  });

  if (status === "APPROVED") {
    await recalculateFinancialDay(
      db,
      accountant.companyId,
      new Date(),
    );
  }

  await notifyUser({
    companyId: accountant.companyId,
    userId: expense.employeeId,
    title: `Expense ${status.toLowerCase()}`,
    message: `${accountant.name} ${status.toLowerCase()} your ${
      expense.category
    } expense of TZS ${numberValue(expense.amount).toLocaleString()}.`,
    type: status === "APPROVED" ? "SUCCESS" : "ERROR",
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: `EXPENSE_${status}`,
    module: "EXPENSES",
    details: `${expense.category}, TZS ${numberValue(
      expense.amount,
    )}, employee ${expense.employee?.name ?? expense.employeeId}.`,
  });

  return {
    message: `Expense ${status.toLowerCase()} successfully.`,
    data: updated,
  };
}

async function handleDepositReview(
  db: any,
  accountant: any,
  body: any,
) {
  const deposit = await db.bankDeposit.findFirst({
    where: {
      id: text(body.depositId),
      companyId: accountant.companyId,
    },
    include: {
      staff: true,
    },
  });

  if (!deposit) {
    throw new AccountantHttpError("Bank deposit not found.", 404);
  }

  await ensurePeriodOpen(
    accountant.companyId,
    new Date(deposit.depositDate),
  );

  const bankStatementUrl =
    text(body.bankStatementUrl).trim() ||
    text(deposit.bankStatementUrl).trim();

  let status:
    | "VERIFIED"
    | "AMOUNT_MISMATCH"
    | "MISSING_RECEIPT"
    | "DUPLICATE_DEPOSIT"
    | "MISSING_BANK_RECORD" = "VERIFIED";

  const mismatchReasons: string[] = [];

  if (!deposit.depositSlipUrl || !deposit.bankReceiptUrl) {
    status = "MISSING_RECEIPT";
    mismatchReasons.push(
      "The deposit slip or bank receipt is missing.",
    );
  }

  if (!bankStatementUrl) {
    status = "MISSING_BANK_RECORD";
    mismatchReasons.push("The accountant bank statement is missing.");
  }

  const duplicate = deposit.referenceNo
    ? await db.bankDeposit.findFirst({
        where: {
          companyId: accountant.companyId,
          id: {
            not: deposit.id,
          },
          referenceNo: deposit.referenceNo,
          amount: deposit.amount,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (duplicate) {
    status = "DUPLICATE_DEPOSIT";
    mismatchReasons.push(
      "Another deposit has the same reference number and amount.",
    );
  }

  const statementAmount =
    body.statementAmount === undefined ||
    text(body.statementAmount) === ""
      ? numberValue(deposit.amount)
      : numberValue(body.statementAmount);

  if (
    Math.abs(statementAmount - numberValue(deposit.amount)) > 0.009
  ) {
    status = "AMOUNT_MISMATCH";
    mismatchReasons.push(
      `Amount mismatch: staff ${numberValue(
        deposit.amount,
      )}, statement ${statementAmount}.`,
    );
  }

  if (
    body.statementReference &&
    !sameText(body.statementReference, deposit.referenceNo)
  ) {
    status = "AMOUNT_MISMATCH";
    mismatchReasons.push("Reference number does not match.");
  }

  if (
    body.statementDate &&
    !sameDate(body.statementDate, deposit.depositDate)
  ) {
    status = "AMOUNT_MISMATCH";
    mismatchReasons.push("Deposit date does not match.");
  }

  if (
    body.statementBankAccount &&
    !sameText(body.statementBankAccount, deposit.bankAccount)
  ) {
    status = "AMOUNT_MISMATCH";
    mismatchReasons.push("Bank account does not match.");
  }

  const updated = await db.bankDeposit.update({
    where: { id: deposit.id },
    data: {
      accountantId: accountant.id,
      bankStatementUrl: bankStatementUrl || null,
      status,
      mismatchReason:
        status === "VERIFIED"
          ? null
          : mismatchReasons.join(" "),
      reviewedAt: new Date(),
      ...(status === "VERIFIED"
        ? {
            holdClearedAt: new Date(),
            holdClearedById: accountant.id,
          }
        : {
            holdClearedAt: null,
            holdClearedById: null,
          }),
    },
  });

  if (status === "VERIFIED") {
    await recalculateFinancialDay(
      db,
      accountant.companyId,
      deposit.depositDate,
    );
    await tryUnblockFinancialDay(
      db,
      accountant.companyId,
      deposit.depositDate,
    );
  } else {
    await blockFinancialDay(
      db,
      accountant.companyId,
      deposit.depositDate,
      `Deposit ${deposit.referenceNo || deposit.id}: ${mismatchReasons.join(
        " ",
      )}`,
    );
  }

  await notifyUser({
    companyId: accountant.companyId,
    userId: deposit.staffId,
    title:
      status === "VERIFIED"
        ? "Deposit verified"
        : "Bank deposit mismatch",
    message:
      status === "VERIFIED"
        ? `Your deposit of TZS ${numberValue(
            deposit.amount,
          ).toLocaleString()} was verified.`
        : `Your deposit requires investigation: ${mismatchReasons.join(
            " ",
          )}`,
    type: status === "VERIFIED" ? "SUCCESS" : "ERROR",
  });

  await notifyRoles({
    companyId: accountant.companyId,
    roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
    title:
      status === "VERIFIED"
        ? "Deposit verified"
        : "Financial hold created",
    message:
      status === "VERIFIED"
        ? `${accountant.name} verified deposit ${
            deposit.referenceNo || deposit.id
          }.`
        : `${deposit.staff?.name ?? "Staff"} is on financial hold: ${mismatchReasons.join(
            " ",
          )}`,
    type: status === "VERIFIED" ? "SUCCESS" : "ERROR",
    excludeUserId: accountant.id,
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: `BANK_DEPOSIT_${status}`,
    module: "BANK_RECONCILIATION",
    details: `${deposit.referenceNo || deposit.id}: ${
      mismatchReasons.join(" ") || "Verified successfully."
    }`,
  });

  return {
    message:
      status === "VERIFIED"
        ? "Deposit verified and financial records updated."
        : `Deposit marked ${status.toLowerCase().replaceAll("_", " ")}.`,
    data: updated,
  };
}

async function handleClearHold(
  db: any,
  accountant: any,
  body: any,
) {
  const deposit = await db.bankDeposit.findFirst({
    where: {
      id: text(body.depositId),
      companyId: accountant.companyId,
    },
  });

  if (!deposit) {
    throw new AccountantHttpError("Bank deposit not found.", 404);
  }

  if (!blockingDepositStatuses.includes(deposit.status)) {
    throw new AccountantHttpError(
      "This deposit does not currently create a financial hold.",
      409,
    );
  }

  if (!text(body.investigationNote).trim()) {
    throw new AccountantHttpError(
      "An investigation note is required to clear a financial hold.",
      422,
    );
  }

  const updated = await db.bankDeposit.update({
    where: { id: deposit.id },
    data: {
      status: "VERIFIED",
      mismatchReason: `Resolved: ${text(
        body.investigationNote,
      ).trim()}`,
      accountantId: accountant.id,
      reviewedAt: new Date(),
      holdClearedAt: new Date(),
      holdClearedById: accountant.id,
    },
  });

  await recalculateFinancialDay(
    db,
    accountant.companyId,
    deposit.depositDate,
  );
  await tryUnblockFinancialDay(
    db,
    accountant.companyId,
    deposit.depositDate,
  );

  await notifyUser({
    companyId: accountant.companyId,
    userId: deposit.staffId,
    title: "Financial hold cleared",
    message: `${accountant.name} cleared your bank-deposit financial hold after investigation.`,
    type: "SUCCESS",
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: "CLEAR_FINANCIAL_HOLD",
    module: "BANK_RECONCILIATION",
    details: text(body.investigationNote).trim(),
  });

  return {
    message: "Financial hold cleared.",
    data: updated,
  };
}

async function handleFloatDecision(
  db: any,
  accountant: any,
  body: any,
  status: "APPROVED" | "REJECTED",
) {
  const float = await db.floatTransaction.findFirst({
    where: {
      id: text(body.floatId),
      companyId: accountant.companyId,
    },
  });

  if (!float) {
    throw new AccountantHttpError(
      "Float transaction not found.",
      404,
    );
  }

  const updated = await db.floatTransaction.update({
    where: { id: float.id },
    data: {
      status,
      ...(status === "APPROVED"
        ? {
            confirmedAt: new Date(),
          }
        : {}),
    },
  });

  const recipientId = float.toUserId || float.fromUserId;

  if (recipientId) {
    await notifyUser({
      companyId: accountant.companyId,
      userId: recipientId,
      title: `Float ${status.toLowerCase()}`,
      message: `${accountant.name} ${status.toLowerCase()} float of TZS ${numberValue(
        float.amount,
      ).toLocaleString()}.`,
      type: status === "APPROVED" ? "SUCCESS" : "ERROR",
    });
  }

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: `FLOAT_${status}`,
    module: "FLOAT",
    details: `TZS ${numberValue(float.amount)}.`,
  });

  return {
    message: `Float ${status.toLowerCase()}.`,
    data: updated,
  };
}

async function handleAttendanceAdjustment(
  db: any,
  accountant: any,
  body: any,
) {
  const userId = text(body.userId);
  const status = text(body.status);
  const allowed = [
    "PRESENT",
    "LATE",
    "ABSENT",
    "ON_LEAVE",
    "HOLIDAY",
    "SUSPENDED",
  ];

  if (!allowed.includes(status)) {
    throw new AccountantHttpError(
      "Invalid attendance status.",
      422,
    );
  }

  const user = await db.user.findFirst({
    where: {
      id: userId,
      companyId: accountant.companyId,
    },
  });

  if (!user) {
    throw new AccountantHttpError("Company user not found.", 404);
  }

  const bounds = tanzaniaDayBounds(
    body.date ? new Date(body.date) : new Date(),
  );

  const attendance = await db.attendance.upsert({
    where: {
      userId_date: {
        userId,
        date: bounds.start,
      },
    },
    update: {
      companyId: accountant.companyId,
      status,
      source: "ACCOUNTANT_APPROVED_ADJUSTMENT",
      notes: text(body.notes).trim() || null,
      checkInAt: body.checkInAt
        ? new Date(body.checkInAt)
        : undefined,
      checkOutAt: body.checkOutAt
        ? new Date(body.checkOutAt)
        : undefined,
    },
    create: {
      companyId: accountant.companyId,
      userId,
      date: bounds.start,
      status,
      source: "ACCOUNTANT_APPROVED_ADJUSTMENT",
      notes: text(body.notes).trim() || null,
      checkInAt: body.checkInAt
        ? new Date(body.checkInAt)
        : null,
      checkOutAt: body.checkOutAt
        ? new Date(body.checkOutAt)
        : null,
    },
  });

  await notifyUser({
    companyId: accountant.companyId,
    userId,
    title: "Attendance adjusted",
    message: `${accountant.name} approved an attendance adjustment to ${status.replaceAll(
      "_",
      " ",
    )} for ${tanzaniaDateKey(bounds.start)}.`,
    type: status === "ABSENT" ? "WARNING" : "INFO",
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: "ADJUST_ATTENDANCE",
    module: "ATTENDANCE",
    details: `${user.name}: ${status}, ${tanzaniaDateKey(bounds.start)}.`,
  });

  return {
    message: "Attendance adjustment saved.",
    data: attendance,
  };
}

async function handleAttendanceSync(
  db: any,
  accountant: any,
  body: any,
) {
  const bounds = tanzaniaDayBounds(
    body.date ? new Date(body.date) : new Date(),
  );
  const cutoffHour = Number(body.cutoffHour ?? 18);
  const shiftedCutoff = new Date(
    bounds.start.getTime() +
      cutoffHour * 60 * 60 * 1000,
  );

  const users = await db.user.findMany({
    where: {
      companyId: accountant.companyId,
      role: {
        in: ["STAFF", "BROKER", "GPS_MANAGER"],
      },
      status: "ACTIVE",
    },
  });

  const floats = await db.floatTransaction.findMany({
    where: {
      companyId: accountant.companyId,
      createdAt: {
        gte: bounds.start,
        lte: bounds.end,
      },
    },
  });

  const gpsRows = await db.gpsTracking.findMany({
    where: {
      companyId: accountant.companyId,
      recordedAt: {
        gte: bounds.start,
        lte: bounds.end,
      },
    },
  });

  let updatedCount = 0;

  for (const user of users) {
    const userFloats = floats.filter(
      (item: any) =>
        item.fromUserId === user.id || item.toUserId === user.id,
    );
    const received = userFloats.find(
      (item: any) => item.toUserId === user.id,
    );
    const returned = userFloats
      .filter(
        (item: any) =>
          item.fromUserId === user.id &&
          ["RETURNED", "DEPOSITED", "APPROVED"].includes(item.status),
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.confirmedAt || b.updatedAt).getTime() -
          new Date(a.confirmedAt || a.updatedAt).getTime(),
      )[0];
    const gpsMovement = gpsRows.some(
      (item: any) => item.userId === user.id,
    );

    let status:
      | "PRESENT"
      | "LATE"
      | "ABSENT" = "ABSENT";
    let source = "AUTOMATIC_NO_ACTIVITY";
    let checkInAt: Date | null = null;
    let checkOutAt: Date | null = null;

    if (received) {
      checkInAt = new Date(received.createdAt);
      status = "PRESENT";
      source = gpsMovement
        ? "FLOAT_RECEIVED_AND_GPS"
        : "FLOAT_RECEIVED";
    }

    if (returned) {
      checkOutAt = new Date(
        returned.confirmedAt || returned.updatedAt,
      );
      status =
        checkOutAt <= shiftedCutoff ? "PRESENT" : "LATE";
      source = gpsMovement
        ? "FLOAT_RETURN_AND_GPS"
        : "FLOAT_RETURN";
    } else if (received && new Date() > shiftedCutoff) {
      status = "ABSENT";
      source = "FLOAT_NOT_RETURNED_BY_CUTOFF";
    }

    await db.attendance.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: bounds.start,
        },
      },
      update: {
        companyId: accountant.companyId,
        status,
        checkInAt,
        checkOutAt,
        source,
        notes: gpsMovement
          ? "GPS movement confirmed during assignment."
          : null,
      },
      create: {
        companyId: accountant.companyId,
        userId: user.id,
        date: bounds.start,
        status,
        checkInAt,
        checkOutAt,
        source,
        notes: gpsMovement
          ? "GPS movement confirmed during assignment."
          : null,
      },
    });

    if (status === "LATE" || status === "ABSENT") {
      await notifyUser({
        companyId: accountant.companyId,
        userId: user.id,
        title: "Attendance warning",
        message: `Automatic attendance marked you ${status.toLowerCase()} for ${tanzaniaDateKey(
          bounds.start,
        )}.`,
        type: "WARNING",
      });
    }

    updatedCount += 1;
  }

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action: "SYNC_AUTOMATIC_ATTENDANCE",
    module: "ATTENDANCE",
    details: `${updatedCount} users evaluated for ${tanzaniaDateKey(
      bounds.start,
    )}.`,
  });

  return {
    message: `Automatic attendance generated for ${updatedCount} users.`,
    data: {
      updatedCount,
    },
  };
}

async function handlePeriodStatus(
  db: any,
  accountant: any,
  body: any,
  status: "LOCKED" | "OPEN",
) {
  if (typeof db.accountingPeriod?.upsert !== "function") {
    throw new AccountantHttpError(
      "Accounting period locking is not installed in the generated Prisma Client. Add the AccountingPeriod model, run the migration, run prisma generate, delete .next and restart Next.js.",
      503,
    );
  }

  const details = accountingPeriodDetails(text(body.periodKey));

  if (status === "LOCKED") {
    const openDays = await db.financialDay.count({
      where: {
        companyId: accountant.companyId,
        date: {
          gte: details.startsAt,
          lte: details.endsAt,
        },
        status: {
          in: ["OPEN", "BLOCKED"],
        },
      },
    });

    if (openDays > 0) {
      throw new AccountantHttpError(
        `Close or resolve ${openDays} financial day(s) before locking ${details.label}.`,
        409,
      );
    }
  }

  const period = await db.accountingPeriod.upsert({
    where: {
      companyId_periodKey: {
        companyId: accountant.companyId,
        periodKey: details.periodKey,
      },
    },
    update: {
      label: details.label,
      startsAt: details.startsAt,
      endsAt: details.endsAt,
      status,
      reason: text(body.reason).trim() || null,
      ...(status === "LOCKED"
        ? {
            lockedById: accountant.id,
            lockedAt: new Date(),
            unlockedAt: null,
          }
        : {
            unlockedAt: new Date(),
          }),
    },
    create: {
      companyId: accountant.companyId,
      periodKey: details.periodKey,
      label: details.label,
      startsAt: details.startsAt,
      endsAt: details.endsAt,
      status,
      reason: text(body.reason).trim() || null,
      lockedById:
        status === "LOCKED" ? accountant.id : null,
      lockedAt: status === "LOCKED" ? new Date() : null,
      unlockedAt: status === "OPEN" ? new Date() : null,
    },
  });

  await createAudit({
    companyId: accountant.companyId,
    userId: accountant.id,
    action:
      status === "LOCKED"
        ? "LOCK_ACCOUNTING_PERIOD"
        : "UNLOCK_ACCOUNTING_PERIOD",
    module: "ACCOUNTING",
    details: `${details.label}: ${text(body.reason).trim() || "No reason supplied"}.`,
  });

  await notifyRoles({
    companyId: accountant.companyId,
    roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
    title:
      status === "LOCKED"
        ? "Accounting period locked"
        : "Accounting period reopened",
    message: `${accountant.name} ${
      status === "LOCKED" ? "locked" : "reopened"
    } ${details.label}.`,
    type: status === "LOCKED" ? "WARNING" : "INFO",
    excludeUserId: accountant.id,
  });

  return {
    message:
      status === "LOCKED"
        ? "Accounting period locked."
        : "Accounting period reopened.",
    data: period,
  };
}

async function handleNotification(
  db: any,
  accountant: any,
  body: any,
  all: boolean,
) {
  if (all) {
    const result = await db.notification.updateMany({
      where: {
        companyId: accountant.companyId,
        userId: accountant.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      message: `${result.count} notification(s) marked as read.`,
      data: result,
    };
  }

  const notification = await db.notification.findFirst({
    where: {
      id: text(body.notificationId),
      companyId: accountant.companyId,
      userId: accountant.id,
    },
  });

  if (!notification) {
    throw new AccountantHttpError(
      "Notification not found.",
      404,
    );
  }

  const updated = await db.notification.update({
    where: { id: notification.id },
    data: {
      isRead: true,
    },
  });

  return {
    message: "Notification marked as read.",
    data: updated,
  };
}

export async function POST(request: NextRequest) {
  try {
    const accountant = await requireAccountant(true);
    const body = await request.json();
    const action = text(body.action).toUpperCase();
    const db = prisma as any;

    let result: {
      message: string;
      data?: unknown;
    };

    switch (action) {
      case "OPEN_DAY":
        result = await handleOpenDay(db, accountant, body);
        break;

      case "CLOSE_DAY":
        result = await handleCloseDay(db, accountant, body);
        break;

      case "UPDATE_OPENING_BALANCE":
        result = await handleOpeningBalance(db, accountant, body);
        break;

      case "APPROVE_EXPENSE":
        result = await handleExpenseDecision(
          db,
          accountant,
          body,
          "APPROVED",
        );
        break;

      case "REJECT_EXPENSE":
        result = await handleExpenseDecision(
          db,
          accountant,
          body,
          "REJECTED",
        );
        break;

      case "REVIEW_DEPOSIT":
        result = await handleDepositReview(
          db,
          accountant,
          body,
        );
        break;

      case "CLEAR_FINANCIAL_HOLD":
        result = await handleClearHold(
          db,
          accountant,
          body,
        );
        break;

      case "APPROVE_FLOAT":
        result = await handleFloatDecision(
          db,
          accountant,
          body,
          "APPROVED",
        );
        break;

      case "REJECT_FLOAT":
        result = await handleFloatDecision(
          db,
          accountant,
          body,
          "REJECTED",
        );
        break;

      case "ADJUST_ATTENDANCE":
        result = await handleAttendanceAdjustment(
          db,
          accountant,
          body,
        );
        break;

      case "SYNC_ATTENDANCE":
        result = await handleAttendanceSync(
          db,
          accountant,
          body,
        );
        break;

      case "LOCK_PERIOD":
        result = await handlePeriodStatus(
          db,
          accountant,
          body,
          "LOCKED",
        );
        break;

      case "UNLOCK_PERIOD":
        result = await handlePeriodStatus(
          db,
          accountant,
          body,
          "OPEN",
        );
        break;

      case "MARK_NOTIFICATION_READ":
        result = await handleNotification(
          db,
          accountant,
          body,
          false,
        );
        break;

      case "MARK_ALL_NOTIFICATIONS_READ":
        result = await handleNotification(
          db,
          accountant,
          body,
          true,
        );
        break;

      default:
        throw new AccountantHttpError(
          `Unsupported accountant action: ${action || "EMPTY"}.`,
          422,
        );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return accountantRouteError(error);
  }
}
