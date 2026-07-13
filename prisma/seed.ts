import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  ApprovalStatus,
  AttendanceStatus,
  CompanyStatus,
  DepositStatus,
  FinancialDayStatus,
  FloatStatus,
  NotificationType,
  PrismaClient,
  Role,
  UserStatus,
} from "../generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "localhost",
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "simamia",
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("Seeding Simamia Float ERP database...");

  const company = await prisma.company.upsert({
    where: {
      code: "SIMAMIA",
    },
    update: {
      name: "Simamia Float Company",
      email: "info@simamiafloat.com",
      phone: "+255700000000",
      address: "Dar es Salaam, Tanzania",
      status: CompanyStatus.ACTIVE,
    },
    create: {
      name: "Simamia Float Company",
      code: "SIMAMIA",
      email: "info@simamiafloat.com",
      phone: "+255700000000",
      address: "Dar es Salaam, Tanzania",
      status: CompanyStatus.ACTIVE,
    },
  });

  const hqBranch = await prisma.branch.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "DSM-HQ",
      },
    },
    update: {
      name: "Dar es Salaam HQ",
      region: "Dar es Salaam",
      address: "Dar es Salaam",
    },
    create: {
      companyId: company.id,
      name: "Dar es Salaam HQ",
      code: "DSM-HQ",
      region: "Dar es Salaam",
      address: "Dar es Salaam",
    },
  });

  const znzBranch = await prisma.branch.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "ZNZ-01",
      },
    },
    update: {
      name: "Zanzibar Branch",
      region: "Zanzibar",
      address: "Zanzibar",
    },
    create: {
      companyId: company.id,
      name: "Zanzibar Branch",
      code: "ZNZ-01",
      region: "Zanzibar",
      address: "Zanzibar",
    },
  });

  const usersToSeed = [
    {
      name: "System Developer",
      username: "system_developer",
      email: "developer@simamiafloat.com",
      password: "Dev@12345",
      role: Role.SYSTEM_DEVELOPER,
      companyId: null,
      branchId: null,
    },
    {
      name: "Super Admin",
      username: "super_admin",
      email: "superadmin@simamiafloat.com",
      password: "Super@12345",
      role: Role.SUPER_ADMIN,
      companyId: null,
      branchId: null,
    },
    {
      name: "Company Admin",
      username: "company_admin",
      email: "admin@simamiafloat.com",
      password: "Admin@12345",
      role: Role.COMPANY_ADMIN,
      companyId: company.id,
      branchId: hqBranch.id,
    },
    {
      name: "Accountant",
      username: "accountant",
      email: "accountant@simamiafloat.com",
      password: "Accountant@12345",
      role: Role.ACCOUNTANT,
      companyId: company.id,
      branchId: hqBranch.id,
    },
    {
      name: "Staff Float Officer",
      username: "staff",
      email: "staff@simamiafloat.com",
      password: "Staff@12345",
      role: Role.STAFF,
      companyId: company.id,
      branchId: hqBranch.id,
    },
    {
      name: "Broker",
      username: "broker",
      email: "broker@simamiafloat.com",
      password: "Broker@12345",
      role: Role.BROKER,
      companyId: company.id,
      branchId: znzBranch.id,
    },
    {
      name: "GPS Manager",
      username: "gps_manager",
      email: "gps@simamiafloat.com",
      password: "Gps@12345",
      role: Role.GPS_MANAGER,
      companyId: company.id,
      branchId: hqBranch.id,
    },
  ];

  const seededUsers: Record<string, { id: string; name: string }> = {};

  for (const user of usersToSeed) {
    const hashedPassword = await hashPassword(user.password);

    const savedUser = await prisma.user.upsert({
      where: {
        username: user.username,
      },
      update: {
        name: user.name,
        email: user.email,
        passwordHash: hashedPassword,
        role: user.role,
        status: UserStatus.ACTIVE,
        companyId: user.companyId,
        branchId: user.branchId,
      },
      create: {
        name: user.name,
        username: user.username,
        email: user.email,
        passwordHash: hashedPassword,
        role: user.role,
        companyId: user.companyId,
        branchId: user.branchId,
        status: UserStatus.ACTIVE,
      },
    });

    seededUsers[user.username] = {
      id: savedUser.id,
      name: savedUser.name,
    };
  }

  await prisma.subscription.upsert({
    where: {
      id: "seed-subscription-simamia",
    },
    update: {
      companyId: company.id,
      plan: "Enterprise",
      amount: "2500000.00",
      isActive: true,
      startsAt: new Date(),
      endsAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    },
    create: {
      id: "seed-subscription-simamia",
      companyId: company.id,
      plan: "Enterprise",
      amount: "2500000.00",
      isActive: true,
      startsAt: new Date(),
      endsAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    },
  });

  const today = startOfToday();

  await prisma.financialDay.upsert({
    where: {
      companyId_date: {
        companyId: company.id,
        date: today,
      },
    },
    update: {
      openingBalance: "5000000.00",
      cashIn: "1250000.00",
      cashOut: "350000.00",
      closingBalance: "5900000.00",
      status: FinancialDayStatus.OPEN,
      openedById: seededUsers.accountant.id,
    },
    create: {
      companyId: company.id,
      date: today,
      openingBalance: "5000000.00",
      cashIn: "1250000.00",
      cashOut: "350000.00",
      closingBalance: "5900000.00",
      status: FinancialDayStatus.OPEN,
      openedById: seededUsers.accountant.id,
    },
  });

  for (const username of ["accountant", "staff", "broker", "gps_manager"]) {
    await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: seededUsers[username].id,
          date: today,
        },
      },
      update: {
        companyId: company.id,
        status:
          username === "broker"
            ? AttendanceStatus.LATE
            : AttendanceStatus.PRESENT,
        checkInAt: new Date(),
        source: "SEED_ACTIVITY",
        notes: "Generated from seed data",
      },
      create: {
        companyId: company.id,
        userId: seededUsers[username].id,
        date: today,
        status:
          username === "broker"
            ? AttendanceStatus.LATE
            : AttendanceStatus.PRESENT,
        checkInAt: new Date(),
        source: "SEED_ACTIVITY",
        notes: "Generated from seed data",
      },
    });
  }

  await prisma.floatTransaction.upsert({
    where: {
      id: "seed-float-001",
    },
    update: {
      companyId: company.id,
      fromUserId: seededUsers.accountant.id,
      toUserId: seededUsers.staff.id,
      amount: "1500000.00",
      purpose: "Daily staff float issue",
      status: FloatStatus.ISSUED,
    },
    create: {
      id: "seed-float-001",
      companyId: company.id,
      fromUserId: seededUsers.accountant.id,
      toUserId: seededUsers.staff.id,
      amount: "1500000.00",
      purpose: "Daily staff float issue",
      status: FloatStatus.ISSUED,
    },
  });

  await prisma.bankDeposit.upsert({
    where: {
      id: "seed-bank-deposit-001",
    },
    update: {
      companyId: company.id,
      staffId: seededUsers.staff.id,
      accountantId: seededUsers.accountant.id,
      amount: "750000.00",
      referenceNo: "SIM-DEP-001",
      bankAccount: "CRDB 015000000001",
      depositDate: today,
      status: DepositStatus.VERIFIED,
    },
    create: {
      id: "seed-bank-deposit-001",
      companyId: company.id,
      staffId: seededUsers.staff.id,
      accountantId: seededUsers.accountant.id,
      amount: "750000.00",
      referenceNo: "SIM-DEP-001",
      bankAccount: "CRDB 015000000001",
      depositDate: today,
      status: DepositStatus.VERIFIED,
    },
  });

  await prisma.expense.upsert({
    where: {
      id: "seed-expense-001",
    },
    update: {
      companyId: company.id,
      employeeId: seededUsers.staff.id,
      reviewedById: seededUsers.accountant.id,
      category: "Transport",
      amount: "25000.00",
      description: "Transport expense for field float collection",
      status: ApprovalStatus.APPROVED,
      reviewedAt: new Date(),
    },
    create: {
      id: "seed-expense-001",
      companyId: company.id,
      employeeId: seededUsers.staff.id,
      reviewedById: seededUsers.accountant.id,
      category: "Transport",
      amount: "25000.00",
      description: "Transport expense for field float collection",
      status: ApprovalStatus.APPROVED,
      reviewedAt: new Date(),
    },
  });

  await prisma.performanceRecord.upsert({
    where: {
      userId_month_year: {
        userId: seededUsers.staff.id,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      },
    },
    update: {
      totalFloatIssued: "1500000.00",
      totalCollections: "1250000.00",
      outstandingBalance: "250000.00",
      attendanceRate: "96.50",
      depositAccuracyRate: "98.00",
      gpsComplianceRate: "95.00",
      score: 88,
      rating: "Very Good",
    },
    create: {
      companyId: company.id,
      userId: seededUsers.staff.id,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      totalFloatIssued: "1500000.00",
      totalCollections: "1250000.00",
      outstandingBalance: "250000.00",
      attendanceRate: "96.50",
      depositAccuracyRate: "98.00",
      gpsComplianceRate: "95.00",
      score: 88,
      rating: "Very Good",
    },
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-notification-super-admin-001",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.super_admin.id,
      title: "New company activated",
      message: "Simamia Float Company is active and ready for management.",
      type: NotificationType.SUCCESS,
      isRead: false,
    },
    create: {
      id: "seed-notification-super-admin-001",
      companyId: company.id,
      userId: seededUsers.super_admin.id,
      title: "New company activated",
      message: "Simamia Float Company is active and ready for management.",
      type: NotificationType.SUCCESS,
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-notification-super-admin-002",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.super_admin.id,
      title: "Subscription created",
      message: "Enterprise subscription has been created for Simamia Float Company.",
      type: NotificationType.INFO,
      isRead: false,
    },
    create: {
      id: "seed-notification-super-admin-002",
      companyId: company.id,
      userId: seededUsers.super_admin.id,
      title: "Subscription created",
      message: "Enterprise subscription has been created for Simamia Float Company.",
      type: NotificationType.INFO,
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-notification-company-admin-001",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.company_admin.id,
      title: "Company setup completed",
      message: "Simamia Float Company has been created and activated.",
      type: NotificationType.SUCCESS,
      isRead: false,
    },
    create: {
      id: "seed-notification-company-admin-001",
      companyId: company.id,
      userId: seededUsers.company_admin.id,
      title: "Company setup completed",
      message: "Simamia Float Company has been created and activated.",
      type: NotificationType.SUCCESS,
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-notification-accountant-001",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.accountant.id,
      title: "Financial day opened",
      message: "Today financial day is open and ready for transactions.",
      type: NotificationType.INFO,
      isRead: false,
    },
    create: {
      id: "seed-notification-accountant-001",
      companyId: company.id,
      userId: seededUsers.accountant.id,
      title: "Financial day opened",
      message: "Today financial day is open and ready for transactions.",
      type: NotificationType.INFO,
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-notification-staff-001",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.staff.id,
      title: "Float issued",
      message: "Daily staff float has been issued by Accountant.",
      type: NotificationType.SUCCESS,
      isRead: false,
    },
    create: {
      id: "seed-notification-staff-001",
      companyId: company.id,
      userId: seededUsers.staff.id,
      title: "Float issued",
      message: "Daily staff float has been issued by Accountant.",
      type: NotificationType.SUCCESS,
      isRead: false,
    },
  });

  const db = prisma as any;

  await db.message.upsert({
    where: {
      id: "seed-message-super-admin-001",
    },
    update: {
      companyId: company.id,
      senderId: seededUsers.company_admin.id,
      receiverId: seededUsers.super_admin.id,
      subject: "Company activation request",
      body: "Please review Simamia Float Company subscription and confirm activation.",
      isRead: false,
    },
    create: {
      id: "seed-message-super-admin-001",
      companyId: company.id,
      senderId: seededUsers.company_admin.id,
      receiverId: seededUsers.super_admin.id,
      subject: "Company activation request",
      body: "Please review Simamia Float Company subscription and confirm activation.",
      isRead: false,
    },
  });

  await db.message.upsert({
    where: {
      id: "seed-message-super-admin-002",
    },
    update: {
      companyId: company.id,
      senderId: seededUsers.accountant.id,
      receiverId: seededUsers.super_admin.id,
      subject: "Financial report ready",
      body: "Today financial summary is available for global review.",
      isRead: false,
    },
    create: {
      id: "seed-message-super-admin-002",
      companyId: company.id,
      senderId: seededUsers.accountant.id,
      receiverId: seededUsers.super_admin.id,
      subject: "Financial report ready",
      body: "Today financial summary is available for global review.",
      isRead: false,
    },
  });

  await prisma.auditLog.upsert({
    where: {
      id: "seed-audit-log-001",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.system_developer.id,
      action: "DATABASE_SEEDED",
      module: "SYSTEM",
      details: "Initial Simamia Float ERP seed data created successfully.",
    },
    create: {
      id: "seed-audit-log-001",
      companyId: company.id,
      userId: seededUsers.system_developer.id,
      action: "DATABASE_SEEDED",
      module: "SYSTEM",
      details: "Initial Simamia Float ERP seed data created successfully.",
    },
  });

  await prisma.auditLog.upsert({
    where: {
      id: "seed-audit-log-super-admin-001",
    },
    update: {
      companyId: company.id,
      userId: seededUsers.super_admin.id,
      action: "SUPER_ADMIN_DASHBOARD_READY",
      module: "SUPER_ADMIN",
      details: "Super Admin dashboard seed data, notifications and messages created.",
    },
    create: {
      id: "seed-audit-log-super-admin-001",
      companyId: company.id,
      userId: seededUsers.super_admin.id,
      action: "SUPER_ADMIN_DASHBOARD_READY",
      module: "SUPER_ADMIN",
      details: "Super Admin dashboard seed data, notifications and messages created.",
    },
  });

  console.log("Seed completed successfully.");
  console.table(
    usersToSeed.map((user) => ({
      role: user.role,
      username: user.username,
      email: user.email,
      password: user.password,
    }))
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("SEED_ERROR:", error);
    await prisma.$disconnect();
    process.exit(1);
  });