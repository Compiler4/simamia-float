import { prisma } from "../lib/prisma";

const db = prisma as any;

function dayOffset(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

async function main() {
  const company = await db.company.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!company) {
    throw new Error(
      "No company exists. Create a company and its Company Admin first.",
    );
  }

  const users = await db.user.findMany({
    where: {
      companyId: company.id,
      NOT: {
        role: {
          in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"],
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  if (!users.length) {
    throw new Error(
      "The selected company has no users. Seed company users first.",
    );
  }

  const admin =
    users.find((item: any) => item.role === "COMPANY_ADMIN") ?? users[0];

  const expenses = [
    {
      id: "demo-expense-fuel",
      category: "Fuel",
      amount: 185000,
      description: "[DEMO] Motorcycle fuel for field collection.",
      expenseDate: dayOffset(-1),
      status: "PENDING",
      user: users[1] ?? admin,
    },
    {
      id: "demo-expense-airtime",
      category: "Airtime",
      amount: 45000,
      description: "[DEMO] Staff communication bundle.",
      expenseDate: dayOffset(-2),
      status: "APPROVED",
      user: admin,
    },
    {
      id: "demo-expense-repairs",
      category: "Repairs",
      amount: 320000,
      description: "[DEMO] GPS motorcycle service.",
      expenseDate: dayOffset(-3),
      status: "APPROVED",
      user: users[2] ?? admin,
    },
    {
      id: "demo-expense-meals",
      category: "Meals",
      amount: 78000,
      description: "[DEMO] Field team lunch.",
      expenseDate: dayOffset(-4),
      status: "REJECTED",
      user: users[3] ?? admin,
    },
  ];

  for (const expense of expenses) {
    await db.companyExpense.upsert({
      where: { id: expense.id },
      update: {
        companyId: company.id,
        createdById: expense.user.id,
        createdByName: expense.user.name,
        createdByRole: expense.user.role,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        expenseDate: expense.expenseDate,
        status: expense.status,
        reviewedById:
          expense.status === "PENDING" ? null : admin.id,
        reviewedByName:
          expense.status === "PENDING" ? null : admin.name,
        reviewedAt:
          expense.status === "PENDING" ? null : new Date(),
      },
      create: {
        id: expense.id,
        companyId: company.id,
        createdById: expense.user.id,
        createdByName: expense.user.name,
        createdByRole: expense.user.role,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        expenseDate: expense.expenseDate,
        status: expense.status,
        reviewedById:
          expense.status === "PENDING" ? null : admin.id,
        reviewedByName:
          expense.status === "PENDING" ? null : admin.name,
        reviewedAt:
          expense.status === "PENDING" ? null : new Date(),
      },
    });
  }

  const bankRecords = [
    {
      id: "demo-bank-verified",
      amount: 2_500_000,
      referenceNumber: "SIM-DEMO-2501",
      depositDate: dayOffset(-1),
      bankAccount: "CRDB •••• 1042",
      status: "VERIFIED",
      uploader: users[1] ?? admin,
    },
    {
      id: "demo-bank-pending",
      amount: 1_780_000,
      referenceNumber: "SIM-DEMO-2502",
      depositDate: dayOffset(0),
      bankAccount: "NMB •••• 8801",
      status: "PENDING",
      uploader: users[2] ?? admin,
    },
    {
      id: "demo-bank-mismatch",
      amount: 920_000,
      referenceNumber: "SIM-DEMO-2503",
      depositDate: dayOffset(-2),
      bankAccount: "NBC •••• 7720",
      status: "AMOUNT_MISMATCH",
      uploader: users[3] ?? admin,
    },
  ];

  for (const record of bankRecords) {
    await db.companyBankVerification.upsert({
      where: { id: record.id },
      update: {
        companyId: company.id,
        uploadedById: record.uploader.id,
        uploadedByName: record.uploader.name,
        uploadedByRole: record.uploader.role,
        amount: record.amount,
        referenceNumber: record.referenceNumber,
        depositDate: record.depositDate,
        bankAccount: record.bankAccount,
        status: record.status,
        isSeenByAdmin: record.status !== "PENDING",
        verifiedById:
          record.status === "PENDING" ? null : admin.id,
        verifiedByName:
          record.status === "PENDING" ? null : admin.name,
        verifiedAt:
          record.status === "PENDING" ? null : new Date(),
      },
      create: {
        id: record.id,
        companyId: company.id,
        uploadedById: record.uploader.id,
        uploadedByName: record.uploader.name,
        uploadedByRole: record.uploader.role,
        amount: record.amount,
        referenceNumber: record.referenceNumber,
        depositDate: record.depositDate,
        bankAccount: record.bankAccount,
        status: record.status,
        isSeenByAdmin: record.status !== "PENDING",
        verifiedById:
          record.status === "PENDING" ? null : admin.id,
        verifiedByName:
          record.status === "PENDING" ? null : admin.name,
        verifiedAt:
          record.status === "PENDING" ? null : new Date(),
      },
    });
  }

  for (let day = -13; day <= 0; day += 1) {
    for (let index = 0; index < users.length; index += 1) {
      const user = users[index];
      const date = dayOffset(day);
      const weekday = date.getUTCDay();
      const mark =
        weekday === 0
          ? "HOLIDAY"
          : (day + index) % 11 === 0
            ? "ABSENT"
            : (day + index) % 6 === 0
              ? "LATE"
              : "PRESENT";

      await db.companyAttendance.upsert({
        where: {
          companyId_userId_attendanceDate: {
            companyId: company.id,
            userId: user.id,
            attendanceDate: date,
          },
        },
        update: {
          userName: user.name,
          userRole: user.role,
          mark,
          source: "DEMO_SEED",
        },
        create: {
          companyId: company.id,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          attendanceDate: date,
          mark,
          source: "DEMO_SEED",
        },
      });
    }
  }

  const gpsDevice = await db.companyGpsDevice.upsert({
    where: { id: "demo-gps-phone" },
    update: {
      companyId: company.id,
      name: "Demo Staff Phone",
      deviceType: "PHONE",
      ownerUserId: (users[1] ?? admin).id,
      ownerName: (users[1] ?? admin).name,
      status: "ACTIVE",
      lastSeenAt: new Date(),
      lastLatitude: -6.7924,
      lastLongitude: 39.2083,
      batteryLevel: 78,
      gpsAccuracy: 12,
      speedKph: 4.6,
    },
    create: {
      id: "demo-gps-phone",
      companyId: company.id,
      name: "Demo Staff Phone",
      deviceType: "PHONE",
      ownerUserId: (users[1] ?? admin).id,
      ownerName: (users[1] ?? admin).name,
      deviceToken: "demo-device-token-change-me",
      status: "ACTIVE",
      lastSeenAt: new Date(),
      lastLatitude: -6.7924,
      lastLongitude: 39.2083,
      batteryLevel: 78,
      gpsAccuracy: 12,
      speedKph: 4.6,
    },
  });

  await db.companyGpsPing.deleteMany({
    where: {
      deviceId: gpsDevice.id,
      capturedAt: {
        gte: dayOffset(-1),
      },
    },
  });

  for (let index = 0; index < 8; index += 1) {
    await db.companyGpsPing.create({
      data: {
        deviceId: gpsDevice.id,
        companyId: company.id,
        latitude: -6.7924 + index * 0.0008,
        longitude: 39.2083 + index * 0.0007,
        accuracy: 10 + index,
        batteryLevel: 85 - index,
        speedKph: 3 + index * 1.2,
        capturedAt: new Date(Date.now() - (7 - index) * 5 * 60 * 1000),
      },
    });
  }

  await db.companyAdminSetting.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      sms: true,
      email: true,
      inApp: true,
      gpsAlerts: true,
      dayClosingLock: true,
      attendanceApproval: true,
      bankMismatchHold: true,
      lowCashAlert: true,
      accent: "TEAL",
      currency: "TZS",
      timezone: "Africa/Dar_es_Salaam",
    },
  });

  const notifications = [
    {
      id: "demo-notice-bank",
      title: "New bank verification uploaded",
      message: "A demo bank record is awaiting Company Admin review.",
      type: "BANK",
      link: "/admin/dashboard?section=bank",
    },
    {
      id: "demo-notice-expense",
      title: "Expense approval required",
      message: "A fuel expense is waiting for approval.",
      type: "EXPENSE",
      link: "/admin/dashboard?section=expenses",
    },
    {
      id: "demo-notice-gps",
      title: "GPS tracker online",
      message: "Demo Staff Phone is sending live location.",
      type: "GPS",
      link: "/admin/dashboard?section=gps",
    },
  ];

  for (const notice of notifications) {
    await db.companyNotification.upsert({
      where: { id: notice.id },
      update: {
        companyId: company.id,
        targetRole: "COMPANY_ADMIN",
        title: notice.title,
        message: notice.message,
        type: notice.type,
        link: notice.link,
      },
      create: {
        id: notice.id,
        companyId: company.id,
        targetRole: "COMPANY_ADMIN",
        title: notice.title,
        message: notice.message,
        type: notice.type,
        link: notice.link,
      },
    });
  }

  await db.companyAuditEvent.create({
    data: {
      companyId: company.id,
      actorId: admin.id,
      actorName: admin.name,
      actorRole: admin.role,
      action: "SEED_DEMO_DATA",
      module: "SYSTEM",
      details: "Created Company Admin real-data simulation records.",
    },
  });

  console.log("Company Admin simulation data created.");
  console.log(`Company: ${company.name} (${company.id})`);
  console.log(`Users included: ${users.length}`);
  console.log("Demo phone token: demo-device-token-change-me");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
