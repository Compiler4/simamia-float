import "dotenv/config";

import { prisma } from "../lib/prisma";

const db = prisma as any;
const TZ_OFFSET = 3 * 60 * 60 * 1000;

function dayStart(offsetDays = 0) {
  const now = new Date();
  const shifted = new Date(now.getTime() + TZ_OFFSET);
  const utc =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + offsetDays,
    ) - TZ_OFFSET;

  return new Date(utc);
}

function monthDate(offsetMonths: number, day = 15) {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + offsetMonths,
      day,
      9,
      0,
      0,
    ),
  );
}

async function main() {
  const accountant = await db.user.findFirst({
    where: {
      role: "ACCOUNTANT",
      companyId: {
        not: null,
      },
      status: "ACTIVE",
    },
    include: {
      company: true,
    },
  });

  if (!accountant?.companyId || !accountant.company) {
    throw new Error(
      "Create an active ACCOUNTANT assigned to a company before running this seed.",
    );
  }

  const companyId = accountant.companyId;
  const staffUsers = await db.user.findMany({
    where: {
      companyId,
      role: {
        in: ["STAFF", "BROKER", "GPS_MANAGER"],
      },
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
    take: 8,
  });

  if (!staffUsers.length) {
    throw new Error(
      "The accountant company needs at least one active operational user.",
    );
  }

  const staff = staffUsers[0];
  const secondStaff = staffUsers[1] ?? staff;
  const thirdStaff = staffUsers[2] ?? staff;

  const customers = [
    {
      id: "accountant-demo-customer-1",
      name: "Mwananchi Traders",
      phone: "+255 712 100 001",
      email: "mwananchi@example.com",
      region: "Dar es Salaam",
    },
    {
      id: "accountant-demo-customer-2",
      name: "Kilimanjaro Services",
      phone: "+255 713 100 002",
      email: "kilimanjaro@example.com",
      region: "Kilimanjaro",
    },
    {
      id: "accountant-demo-customer-3",
      name: "Zanzibar Digital",
      phone: "+255 714 100 003",
      email: "zanzibar@example.com",
      region: "Zanzibar",
    },
  ];

  for (const customer of customers) {
    await db.customer.upsert({
      where: { id: customer.id },
      update: {
        companyId,
        ...customer,
      },
      create: {
        companyId,
        ...customer,
      },
    });
  }

  for (let offset = -7; offset <= 0; offset += 1) {
    const serviceDate = monthDate(offset, 12 + Math.abs(offset));

    await db.serviceActivity.upsert({
      where: {
        id: `accountant-demo-service-${offset + 8}`,
      },
      update: {
        companyId,
        staffId: staffUsers[Math.abs(offset) % staffUsers.length].id,
        customerId: customers[Math.abs(offset) % customers.length].id,
        serviceType:
          offset % 2 === 0 ? "Float Service" : "Customer Collection",
        amount: String(1_200_000 + (offset + 8) * 185_000),
        status: "COMPLETED",
        servedAt: serviceDate,
        notes: "[DEMO] Accountant portal monthly income record.",
      },
      create: {
        id: `accountant-demo-service-${offset + 8}`,
        companyId,
        staffId: staffUsers[Math.abs(offset) % staffUsers.length].id,
        customerId: customers[Math.abs(offset) % customers.length].id,
        serviceType:
          offset % 2 === 0 ? "Float Service" : "Customer Collection",
        amount: String(1_200_000 + (offset + 8) * 185_000),
        status: "COMPLETED",
        servedAt: serviceDate,
        notes: "[DEMO] Accountant portal monthly income record.",
      },
    });
  }

  const expenses = [
    {
      id: "accountant-demo-expense-1",
      employeeId: staff.id,
      category: "Fuel",
      amount: "185000.00",
      description: "[DEMO] Field motorcycle fuel.",
      receiptUrl: "/demo/receipts/fuel.pdf",
      status: "PENDING",
    },
    {
      id: "accountant-demo-expense-2",
      employeeId: secondStaff.id,
      category: "Airtime",
      amount: "65000.00",
      description: "[DEMO] Customer communication bundle.",
      receiptUrl: "/demo/receipts/airtime.pdf",
      status: "APPROVED",
    },
    {
      id: "accountant-demo-expense-3",
      employeeId: thirdStaff.id,
      category: "Repairs",
      amount: "320000.00",
      description: "[DEMO] GPS device repair.",
      receiptUrl: "/demo/receipts/repair.pdf",
      status: "REJECTED",
    },
  ];

  for (const expense of expenses) {
    await db.expense.upsert({
      where: { id: expense.id },
      update: {
        companyId,
        ...expense,
        reviewedById:
          expense.status === "PENDING" ? null : accountant.id,
        reviewedAt:
          expense.status === "PENDING" ? null : new Date(),
        reviewNote:
          expense.status === "PENDING"
            ? null
            : "[DEMO] Accountant review completed.",
      },
      create: {
        companyId,
        ...expense,
        reviewedById:
          expense.status === "PENDING" ? null : accountant.id,
        reviewedAt:
          expense.status === "PENDING" ? null : new Date(),
        reviewNote:
          expense.status === "PENDING"
            ? null
            : "[DEMO] Accountant review completed.",
      },
    });
  }

  const deposits = [
    {
      id: "accountant-demo-deposit-1",
      staffId: staff.id,
      amount: "2500000.00",
      referenceNo: "ACC-DEMO-001",
      bankAccount: "CRDB-OPERATIONS-001",
      depositDate: dayStart(-1),
      depositSlipUrl: "/demo/deposits/slip-001.pdf",
      bankReceiptUrl: "/demo/deposits/receipt-001.pdf",
      bankStatementUrl: "/demo/statements/statement-001.pdf",
      status: "VERIFIED",
      mismatchReason: null,
    },
    {
      id: "accountant-demo-deposit-2",
      staffId: secondStaff.id,
      amount: "1780000.00",
      referenceNo: "ACC-DEMO-002",
      bankAccount: "NMB-COLLECTION-002",
      depositDate: dayStart(0),
      depositSlipUrl: "/demo/deposits/slip-002.pdf",
      bankReceiptUrl: "/demo/deposits/receipt-002.pdf",
      bankStatementUrl: null,
      status: "PENDING",
      mismatchReason: null,
    },
    {
      id: "accountant-demo-deposit-3",
      staffId: thirdStaff.id,
      amount: "920000.00",
      referenceNo: "ACC-DEMO-003",
      bankAccount: "NBC-COLLECTION-003",
      depositDate: dayStart(-2),
      depositSlipUrl: "/demo/deposits/slip-003.pdf",
      bankReceiptUrl: "/demo/deposits/receipt-003.pdf",
      bankStatementUrl: "/demo/statements/statement-003.pdf",
      status: "AMOUNT_MISMATCH",
      mismatchReason: "[DEMO] Statement amount differs from staff upload.",
    },
  ];

  for (const deposit of deposits) {
    await db.bankDeposit.upsert({
      where: { id: deposit.id },
      update: {
        companyId,
        ...deposit,
        accountantId:
          deposit.status === "PENDING" ? null : accountant.id,
        reviewedAt:
          deposit.status === "PENDING" ? null : new Date(),
      },
      create: {
        companyId,
        ...deposit,
        accountantId:
          deposit.status === "PENDING" ? null : accountant.id,
        reviewedAt:
          deposit.status === "PENDING" ? null : new Date(),
      },
    });
  }

  const floats = [
    {
      id: "accountant-demo-float-1",
      toUserId: staff.id,
      amount: "800000.00",
      purpose: "[DEMO] Daily customer service float.",
      status: "ISSUED",
    },
    {
      id: "accountant-demo-float-2",
      toUserId: secondStaff.id,
      amount: "650000.00",
      purpose: "[DEMO] Broker operational float.",
      status: "APPROVED",
    },
  ];

  for (const item of floats) {
    await db.floatTransaction.upsert({
      where: { id: item.id },
      update: {
        companyId,
        fromUserId: accountant.id,
        ...item,
        confirmedAt:
          item.status === "APPROVED" ? new Date() : null,
      },
      create: {
        companyId,
        fromUserId: accountant.id,
        ...item,
        confirmedAt:
          item.status === "APPROVED" ? new Date() : null,
      },
    });
  }

  for (let offset = -13; offset <= 0; offset += 1) {
    const date = dayStart(offset);

    for (let index = 0; index < staffUsers.length; index += 1) {
      const user = staffUsers[index];
      const status =
        (offset + index) % 9 === 0
          ? "ABSENT"
          : (offset + index) % 5 === 0
            ? "LATE"
            : "PRESENT";

      await db.attendance.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date,
          },
        },
        update: {
          companyId,
          status,
          source: "DEMO_FLOAT_AND_GPS",
          notes: "[DEMO] Generated from operational activity.",
        },
        create: {
          companyId,
          userId: user.id,
          date,
          status,
          source: "DEMO_FLOAT_AND_GPS",
          notes: "[DEMO] Generated from operational activity.",
        },
      });
    }
  }

  for (let offset = -7; offset <= 0; offset += 1) {
    const date = monthDate(offset, 1);
    const opening = 2_000_000 + (offset + 7) * 350_000;
    const cashIn = 1_000_000 + (offset + 7) * 180_000;
    const cashOut = 250_000 + (offset + 7) * 35_000;
    const closing = opening + cashIn - cashOut;

    await db.financialDay.upsert({
      where: {
        companyId_date: {
          companyId,
          date,
        },
      },
      update: {
        openingBalance: String(opening),
        cashIn: String(cashIn),
        cashOut: String(cashOut),
        closingBalance: String(closing),
        status: "CLOSED",
        openedById: accountant.id,
        closedById: accountant.id,
        closedAt: new Date(date.getTime() + 8 * 60 * 60 * 1000),
      },
      create: {
        companyId,
        date,
        openingBalance: String(opening),
        cashIn: String(cashIn),
        cashOut: String(cashOut),
        closingBalance: String(closing),
        status: "CLOSED",
        openedById: accountant.id,
        closedById: accountant.id,
        closedAt: new Date(date.getTime() + 8 * 60 * 60 * 1000),
      },
    });
  }

  await db.financialDay.upsert({
    where: {
      companyId_date: {
        companyId,
        date: dayStart(0),
      },
    },
    update: {
      openingBalance: "3281068.00",
      cashIn: "1780000.00",
      cashOut: "65000.00",
      closingBalance: "4996068.00",
      status: "OPEN",
      openedById: accountant.id,
      closedById: null,
      closedAt: null,
    },
    create: {
      companyId,
      date: dayStart(0),
      openingBalance: "3281068.00",
      cashIn: "1780000.00",
      cashOut: "65000.00",
      closingBalance: "4996068.00",
      status: "OPEN",
      openedById: accountant.id,
    },
  });

  const notifications = [
    {
      id: "accountant-demo-notification-1",
      title: "Expense approval required",
      message: "A fuel expense is waiting for accountant review.",
      type: "INFO",
    },
    {
      id: "accountant-demo-notification-2",
      title: "Bank mismatch",
      message: "Deposit ACC-DEMO-003 created a financial hold.",
      type: "ERROR",
    },
    {
      id: "accountant-demo-notification-3",
      title: "Day opened",
      message: "Today's financial day is open.",
      type: "SUCCESS",
    },
  ];

  for (const notice of notifications) {
    await db.notification.upsert({
      where: { id: notice.id },
      update: {
        companyId,
        userId: accountant.id,
        ...notice,
      },
      create: {
        companyId,
        userId: accountant.id,
        ...notice,
      },
    });
  }

  console.log("Accountant portal demo records created.");
  console.log(`Company: ${accountant.company.name}`);
  console.log(`Accountant: ${accountant.email}`);
  console.log(`Operational users: ${staffUsers.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
