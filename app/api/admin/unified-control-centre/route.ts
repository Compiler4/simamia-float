import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_ROLES = new Set(["COMPANY_ADMIN", "SUPER_ADMIN", "SYSTEM_DEVELOPER"]);
const BANK_SETTING_KEY = "unified_control_bank_accounts";
const TARGET_TYPES = new Set(["STAFF_PROOF", "BANK_DEPOSIT", "EXPENSE", "OTHER"]);

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function numberValue(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function errorResponse(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
  const message = error instanceof Error ? error.message : "The control centre request failed.";

  console.error("UNIFIED_CONTROL_CENTRE_ERROR:", error);
  return NextResponse.json(
    {
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status },
  );
}

function httpError(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

async function requireAdmin() {
  const user = (await getCurrentUser()) as any;
  if (!user) httpError("Authentication is required.", 401);
  if (!ADMIN_ROLES.has(text(user.role).toUpperCase())) {
    httpError("Company Admin access is required.", 403);
  }
  if (!user.companyId) {
    httpError("The signed-in administrator is not assigned to a company.", 403);
  }

  return {
    id: text(user.id),
    name: text(user.name || user.username || user.email || "Company Admin"),
    email: text(user.email),
    role: text(user.role).toUpperCase(),
    companyId: text(user.companyId),
  };
}

function areaName(area: {
  region?: unknown;
  district?: unknown;
  ward?: unknown;
  street?: unknown;
}) {
  return [area.region, area.district, area.ward, area.street]
    .map(text)
    .filter(Boolean)
    .join(" / ");
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildLocationTree(rows: Array<Record<string, unknown>>) {
  const regionMap = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    const region = text(row.region || row.city || row.location);
    if (!region) continue;

    const district = text(row.district) || "All districts";
    const ward = text(row.ward || row.street);

    if (!regionMap.has(region)) regionMap.set(region, new Map());
    const districtMap = regionMap.get(region)!;
    if (!districtMap.has(district)) districtMap.set(district, new Set());
    if (ward) districtMap.get(district)!.add(ward);
  }

  return Array.from(regionMap.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([region, districts]) => ({
      region,
      districts: Array.from(districts.entries())
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([district, wards]) => ({
          district,
          wards: Array.from(wards).sort((first, second) => first.localeCompare(second)),
        })),
    }));
}

async function loadBankAccounts(db: any, companyId: string, importedStatements: any[]) {
  const setting = await db.companySetting.findUnique({
    where: { companyId_key: { companyId, key: BANK_SETTING_KEY } },
  });
  let configured: any[] = [];

  try {
    configured = JSON.parse(text(setting?.value) || "[]");
  } catch {
    configured = [];
  }

  const existingKeys = new Set(
    configured.map((account) => `${text(account.bankName)}|${text(account.accountNumber)}`),
  );
  const fromStatements = importedStatements
    .filter((statement: any) => {
      const key = `${text(statement.bankName)}|${text(statement.accountNumber)}`;
      if (!text(statement.bankName) || !text(statement.accountNumber) || existingKeys.has(key)) {
        return false;
      }
      existingKeys.add(key);
      return true;
    })
    .map((statement: any) => ({
      id: `statement-${statement.id}`,
      bankName: text(statement.bankName),
      bankCode: null,
      accountName: text(statement.accountName),
      accountNumber: text(statement.accountNumber),
      branchName: text(statement.branchName) || null,
      swiftCode: null,
      currency: text(statement.currency) || "TZS",
      status: "ACTIVE",
      notes: "Imported from bank statement.",
      createdAt: statement.importedAt || statement.createdAt,
    }));

  return [...configured, ...fromStatements];
}

async function saveBankAccounts(db: any, companyId: string, accounts: any[]) {
  await db.companySetting.upsert({
    where: { companyId_key: { companyId, key: BANK_SETTING_KEY } },
    create: {
      companyId,
      key: BANK_SETTING_KEY,
      value: JSON.stringify(accounts),
    },
    update: {
      value: JSON.stringify(accounts),
    },
  });
}

async function loadData(companyId: string) {
  const db = prisma as any;

  const [
    company,
    staff,
    accountants,
    workAreasRaw,
    brokersRaw,
    brokerAssignmentsRaw,
    customers,
    customerAssignments,
    importedStatements,
    bankVerifications,
    verificationPackets,
    floatTransactions,
    collections,
    visits,
    branches,
  ] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, code: true } }),
    db.user.findMany({
      where: { companyId, role: "STAFF", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        profileImageUrl: true,
        assignedRegion: true,
        branch: { select: { id: true, name: true, code: true, region: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    db.user.findMany({
      where: { companyId, role: "ACCOUNTANT", status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    db.staffWorkArea.findMany({
      where: { companyId },
      include: { staff: { select: { id: true, name: true, email: true, profileImageUrl: true, assignedRegion: true } } },
      orderBy: [{ status: "asc" }, { region: "asc" }, { district: "asc" }, { ward: "asc" }],
      take: 10000,
    }),
    db.brokerCustomer.findMany({
      where: { companyId, status: "ACTIVE" },
      orderBy: [{ region: "asc" }, { district: "asc" }, { name: "asc" }],
      take: 10000,
    }),
    db.staffBrokerCustomerAssignment.findMany({
      where: { companyId },
      include: {
        staff: { select: { id: true, name: true, email: true } },
        brokerCustomer: true,
        workArea: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10000,
    }),
    db.customer.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { id: true, name: true, email: true, phone: true, region: true, address: true },
      orderBy: { name: "asc" },
      take: 10000,
    }),
    db.staffCustomerAssignment.findMany({
      where: { companyId },
      include: {
        staff: { select: { id: true, name: true, email: true, assignedRegion: true, profileImageUrl: true } },
        customer: { select: { id: true, name: true, email: true, phone: true, region: true, address: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10000,
    }),
    db.importedBankStatement.findMany({
      where: { companyId },
      orderBy: [{ periodEnd: "desc" }, { importedAt: "desc" }],
      take: 1000,
    }),
    db.companyBankVerification.findMany({
      where: { companyId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 1000,
    }),
    db.verificationPacket.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    db.floatTransaction.findMany({
      where: { companyId },
      include: { fromUser: true, toUser: true, brokerCustomer: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    db.staffCollection.findMany({
      where: { companyId },
      include: { staff: true, brokerCustomer: true },
      orderBy: { collectionDate: "desc" },
      take: 1000,
    }),
    db.brokerServiceVisit.findMany({
      where: { companyId },
      include: { staff: true, brokerCustomer: true },
      orderBy: { startedAt: "desc" },
      take: 1000,
    }),
    db.branch.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { region: true, address: true },
      take: 1000,
    }),
  ]);

  const activeAssignmentByBroker = new Map<string, any>();
  for (const assignment of brokerAssignmentsRaw) {
    if (text(assignment.status).toUpperCase() === "ACTIVE") {
      activeAssignmentByBroker.set(text(assignment.brokerCustomerId), assignment);
    }
  }

  const workAreas = workAreasRaw.map((area: any) => ({
    ...area,
    areaLabel: area.name || areaName(area),
  }));

  const brokers = brokersRaw.map((broker: any) => {
    const assignment = activeAssignmentByBroker.get(text(broker.id));
    return {
      ...broker,
      activeAssignment: assignment
        ? {
            id: assignment.id,
            staffId: assignment.staffId,
            staffName: assignment.staff?.name || "Staff",
            workAreaId: assignment.workAreaId,
            assignedArea: assignment.assignedArea || assignment.workArea?.name || null,
            startedAt: assignment.startedAt,
          }
        : null,
    };
  });

  const bankAccounts = await loadBankAccounts(db, companyId, importedStatements);
  const locationTree = buildLocationTree([
    ...brokersRaw,
    ...workAreas,
    ...customers,
    ...branches.map((branch: any) => ({ region: branch.region, district: branch.address })),
  ]);

  return serialize({
    success: true,
    company: company || { id: companyId, name: "Company", code: "" },
    summary: {
      staff: staff.length,
      activeAreas: workAreas.filter((area: any) => area.status === "ACTIVE").length,
      brokers: brokers.length,
      assignedBrokers: brokerAssignmentsRaw.filter((row: any) => row.status === "ACTIVE").length,
      customers: customers.length,
      bankAccounts: bankAccounts.length,
      pendingVerification: verificationPackets.filter((row: any) => row.status === "PENDING").length,
      importedStatements: importedStatements.length,
    },
    staff,
    accountants,
    locationTree,
    workAreas,
    brokers,
    customers,
    customerAssignments,
    bankAccounts,
    importedStatements,
    bankVerifications,
    verificationPackets: verificationPackets.map((packet: any) => ({
      ...packet,
      category: packet.targetType,
      attachmentName: packet.attachmentUrl ? packet.attachmentUrl.split("/").pop() : null,
    })),
    staffOperations: {
      floatTransactions,
      collections,
      visits: visits.map((visit: any) => ({ ...visit, broker: visit.brokerCustomer })),
    },
  });
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    return NextResponse.json(await loadData(admin.companyId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const db = prisma as any;
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action).toUpperCase();

    if (action === "ASSIGN_AREAS") {
      const staffId = text(body.staffId);
      const areas = Array.isArray(body.areas) ? body.areas : [];
      if (!staffId) httpError("Choose a staff user.", 422);
      if (!areas.length) httpError("Add at least one area before saving.", 422);

      const staff = await db.user.findFirst({
        where: { id: staffId, companyId: admin.companyId, role: "STAFF", status: "ACTIVE" },
        select: { id: true, name: true },
      });
      if (!staff) httpError("The selected active staff user was not found.", 404);

      const created = await db.$transaction(
        areas.map((area: any) => {
          const name = areaName(area);
          if (!name) httpError("Every work area needs at least a region.", 422);
          return db.staffWorkArea.create({
            data: {
              companyId: admin.companyId,
              staffId,
              name,
              region: text(area.region) || null,
              district: text(area.district) || null,
              ward: text(area.ward) || null,
              street: text(area.street) || null,
              status: "ACTIVE",
            },
          });
        }),
      );

      return NextResponse.json({
        success: true,
        message: `${created.length} staff work area${created.length === 1 ? "" : "s"} saved for ${staff.name}.`,
        areaIds: created.map((area: any) => area.id),
      });
    }

    if (action === "UNASSIGN_AREA") {
      const areaId = text(body.areaId);
      const area = await db.staffWorkArea.findFirst({ where: { id: areaId, companyId: admin.companyId } });
      if (!area) httpError("The selected work area was not found.", 404);

      await db.$transaction([
        db.staffWorkArea.update({
          where: { id: area.id },
          data: { status: "INACTIVE", endedAt: new Date() },
        }),
        ...(body.releaseBrokers
          ? [
              db.staffBrokerCustomerAssignment.updateMany({
                where: { companyId: admin.companyId, workAreaId: area.id, status: "ACTIVE" },
                data: { status: "INACTIVE", endedAt: new Date() },
              }),
            ]
          : []),
      ]);

      return NextResponse.json({ success: true, message: `${area.name} was removed.` });
    }

    if (action === "ASSIGN_BROKERS") {
      const staffId = text(body.staffId);
      const brokerIds = Array.isArray(body.brokerIds)
        ? Array.from(new Set(body.brokerIds.map(text).filter(Boolean)))
        : [];
      const workAreaIds = Array.isArray(body.workAreaIds)
        ? body.workAreaIds.map(text).filter(Boolean)
        : [];
      if (!staffId || !brokerIds.length) {
        httpError("Choose a staff user and at least one broker.", 422);
      }

      const staff = await db.user.findFirst({
        where: { id: staffId, companyId: admin.companyId, role: "STAFF", status: "ACTIVE" },
        select: { id: true, name: true },
      });
      if (!staff) httpError("The selected active staff user was not found.", 404);

      const workArea = workAreaIds.length
        ? await db.staffWorkArea.findFirst({
            where: { id: workAreaIds[0], companyId: admin.companyId, staffId },
          })
        : null;
      const brokers = await db.brokerCustomer.findMany({
        where: { id: { in: brokerIds }, companyId: admin.companyId, status: "ACTIVE" },
        select: { id: true, name: true, region: true, district: true, ward: true, location: true },
      });
      if (!brokers.length) httpError("No active broker was found for this assignment.", 404);

      await db.$transaction(
        brokers.map((broker: any) =>
          db.staffBrokerCustomerAssignment.upsert({
            where: {
              companyId_brokerCustomerId: {
                companyId: admin.companyId,
                brokerCustomerId: broker.id,
              },
            },
            create: {
              companyId: admin.companyId,
              staffId,
              brokerCustomerId: broker.id,
              workAreaId: workArea?.id ?? null,
              assignedById: admin.id,
              assignedArea: workArea?.name || areaName(broker) || null,
              status: "ACTIVE",
              notes: text(body.notes) || null,
            },
            update: {
              staffId,
              workAreaId: workArea?.id ?? null,
              assignedById: admin.id,
              assignedArea: workArea?.name || areaName(broker) || null,
              status: "ACTIVE",
              endedAt: null,
              notes: text(body.notes) || null,
            },
          }),
        ),
      );

      return NextResponse.json({
        success: true,
        message: `${brokers.length} broker${brokers.length === 1 ? "" : "s"} assigned to ${staff.name}.`,
      });
    }

    if (action === "UNASSIGN_BROKER") {
      const assignmentId = text(body.assignmentId);
      const assignment = await db.staffBrokerCustomerAssignment.findFirst({
        where: { id: assignmentId, companyId: admin.companyId },
        include: { brokerCustomer: { select: { name: true } } },
      });
      if (!assignment) httpError("The broker assignment was not found.", 404);

      await db.staffBrokerCustomerAssignment.update({
        where: { id: assignment.id },
        data: { status: "INACTIVE", endedAt: new Date(), assignedById: admin.id },
      });

      return NextResponse.json({
        success: true,
        message: `${assignment.brokerCustomer?.name || "Broker"} was removed from the assignment.`,
      });
    }

    if (action === "ASSIGN_CUSTOMER") {
      const staffId = text(body.staffId);
      const customerId = text(body.customerId);
      if (!staffId || !customerId) httpError("Choose both a staff user and customer.", 422);

      const [staff, customer] = await Promise.all([
        db.user.findFirst({ where: { id: staffId, companyId: admin.companyId, role: "STAFF", status: "ACTIVE" } }),
        db.customer.findFirst({ where: { id: customerId, companyId: admin.companyId, status: "ACTIVE" } }),
      ]);
      if (!staff) httpError("The selected active staff user was not found.", 404);
      if (!customer) httpError("The selected customer was not found.", 404);

      await db.staffCustomerAssignment.upsert({
        where: { companyId_customerId: { companyId: admin.companyId, customerId } },
        create: {
          companyId: admin.companyId,
          staffId,
          customerId,
          assignedById: admin.id,
          status: "ACTIVE",
          notes: text(body.notes) || null,
        },
        update: {
          staffId,
          assignedById: admin.id,
          status: "ACTIVE",
          endedAt: null,
          notes: text(body.notes) || null,
        },
      });

      return NextResponse.json({ success: true, message: `${customer.name} was assigned to ${staff.name}.` });
    }

    if (action === "UNASSIGN_CUSTOMER") {
      const assignmentId = text(body.assignmentId);
      const assignment = await db.staffCustomerAssignment.findFirst({
        where: { id: assignmentId, companyId: admin.companyId },
        include: { customer: { select: { name: true } } },
      });
      if (!assignment) httpError("The customer assignment was not found.", 404);

      await db.staffCustomerAssignment.update({
        where: { id: assignment.id },
        data: { status: "INACTIVE", endedAt: new Date(), assignedById: admin.id },
      });

      return NextResponse.json({
        success: true,
        message: `${assignment.customer?.name || "Customer"} was removed from the assignment.`,
      });
    }

    if (action === "CREATE_BANK_ACCOUNT") {
      const bankName = text(body.bankName);
      const accountName = text(body.accountName);
      const accountNumber = text(body.accountNumber);
      if (!bankName || !accountName || !accountNumber) {
        httpError("Bank name, account name and account number are required.", 422);
      }

      const importedStatements = await db.importedBankStatement.findMany({ where: { companyId: admin.companyId }, take: 1000 });
      const accounts = (await loadBankAccounts(db, admin.companyId, importedStatements)).filter(
        (account: any) => !text(account.id).startsWith("statement-"),
      );
      const duplicate = accounts.find(
        (account: any) =>
          text(account.bankName).toLowerCase() === bankName.toLowerCase() &&
          text(account.accountNumber) === accountNumber,
      );
      if (duplicate) httpError("That bank account is already configured.", 409);

      accounts.unshift({
        id: randomUUID(),
        bankName,
        bankCode: text(body.bankCode) || null,
        accountName,
        accountNumber,
        branchName: text(body.branchName) || null,
        swiftCode: text(body.swiftCode) || null,
        currency: text(body.currency) || "TZS",
        status: "ACTIVE",
        notes: text(body.notes) || null,
        createdAt: new Date().toISOString(),
      });
      await saveBankAccounts(db, admin.companyId, accounts);

      return NextResponse.json({ success: true, message: `${bankName} account saved.` }, { status: 201 });
    }

    if (action === "SET_BANK_STATUS") {
      const bankAccountId = text(body.bankAccountId);
      const status = text(body.status).toUpperCase();
      if (!["ACTIVE", "INACTIVE"].includes(status)) httpError("Choose ACTIVE or INACTIVE.", 422);

      const importedStatements = await db.importedBankStatement.findMany({ where: { companyId: admin.companyId }, take: 1000 });
      const accounts = (await loadBankAccounts(db, admin.companyId, importedStatements)).filter(
        (account: any) => !text(account.id).startsWith("statement-"),
      );
      const next = accounts.map((account: any) =>
        text(account.id) === bankAccountId ? { ...account, status } : account,
      );
      if (JSON.stringify(accounts) === JSON.stringify(next)) {
        httpError("Configured bank account was not found.", 404);
      }
      await saveBankAccounts(db, admin.companyId, next);

      return NextResponse.json({ success: true, message: `Bank account ${status.toLowerCase()}.` });
    }

    if (action === "CREATE_VERIFICATION_PACKET") {
      const targetType = text(body.targetType).toUpperCase() || "OTHER";
      const title = text(body.title);
      const message = text(body.message);
      if (!TARGET_TYPES.has(targetType)) httpError("Choose a valid verification target.", 422);
      if (!title) httpError("Document title is required.", 422);
      if (!message && !text(body.attachmentUrl)) {
        httpError("Add a message or attach a document.", 422);
      }

      const packet = await db.verificationPacket.create({
        data: {
          companyId: admin.companyId,
          title,
          targetType,
          targetId: text(body.targetId) || `OTHER-${Date.now()}`,
          sentByAdminId: admin.id,
          sentByAdminName: admin.name,
          assignedAccountantId: text(body.accountantId) || null,
          message,
          attachmentUrl: text(body.attachmentUrl) || null,
          status: "PENDING",
        },
      });

      await db.companyNotification.create({
        data: {
          companyId: admin.companyId,
          targetUserId: packet.assignedAccountantId || null,
          targetRole: packet.assignedAccountantId ? null : "ACCOUNTANT",
          title: "Company Admin verification request",
          message: `${admin.name} sent ${title} for accountant verification.`,
          type: "INFO",
          link: "/accountant/verification-requests",
          isRead: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Verification packet sent to the accountant.",
        packet,
      }, { status: 201 });
    }

    httpError("Unsupported control centre action.", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
