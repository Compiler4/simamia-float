import "dotenv/config";

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

import { PrismaClient } from "../generated/prisma/client";
import {
  BrokerCustomerStatus,
  ImportBatchStatus,
  ImportedDataSourceType,
  MobileNetwork,
  Role,
  StaffAssignmentStatus,
  UserStatus,
} from "../generated/prisma/enums";

type SeedUserInput = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  companyId: string | null;
  branchId: string | null;
  assignedRegion?: string | null;
};

type BrokerSeedInput = {
  code: string;
  name: string;
  businessName: string;
  phone: string;
  location: string;
  region: string;
  district: string;
  ward: string;
  address: string;
  network: MobileNetwork;
  agentNumber: string;
};

type ExcelRow = Record<string, unknown>;

const DEFAULT_COMPANY_CODE = "SIMAMIA";
const DEFAULT_BRANCH_CODE = "HQ";
const DEFAULT_BROKER_EXCEL_PATH = path.resolve(
  process.cwd(),
  "data",
  "float data_063712.xlsx",
);

function env(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  variableName: string,
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${variableName} must be a positive integer. Received: ${
        value ?? "undefined"
      }`,
    );
  }

  return parsed;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb({
    host: env("DATABASE_HOST", "127.0.0.1"),
    port: positiveInteger(
      process.env.DATABASE_PORT,
      3306,
      "DATABASE_PORT",
    ),
    user: env("DATABASE_USER", "root"),
    password: process.env.DATABASE_PASSWORD ?? "",
    database: env("DATABASE_NAME", "simamia"),
    connectionLimit: positiveInteger(
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
      "DATABASE_CONNECTION_LIMIT",
    ),
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const prisma = createPrismaClient();

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength
    ? value
    : value.slice(0, maximumLength);
}

function normaliseHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function rowValue(
  row: ExcelRow,
  acceptedHeaders: string[],
): string {
  const accepted = new Set(
    acceptedHeaders.map(normaliseHeader),
  );

  for (const [key, value] of Object.entries(row)) {
    if (accepted.has(normaliseHeader(key))) {
      return cleanText(value);
    }
  }

  return "";
}

function normalisePhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `255${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `255${digits}`;
  }

  return digits;
}

function normaliseName(value: string): string {
  return compactSpaces(value).toLowerCase();
}

function safeBrokerCode(
  rawCode: string,
  sourceRowNumber: number,
): string {
  const cleaned = rawCode
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return truncate(
    cleaned || `AGENT-${String(sourceRowNumber).padStart(6, "0")}`,
    80,
  );
}

function fileSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function upsertUser(
  input: SeedUserInput,
): Promise<Awaited<ReturnType<typeof prisma.user.create>>> {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const matches = await prisma.user.findMany({
    where: {
      OR: [
        { username: input.username },
        { email: input.email },
      ],
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  });

  if (matches.length > 1) {
    throw new Error(
      [
        `Cannot seed ${input.username}.`,
        "The username and email belong to different existing users.",
        `Matches: ${JSON.stringify(matches)}`,
      ].join(" "),
    );
  }

  const data = {
    name: input.name,
    username: input.username,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: input.role,
    status: UserStatus.ACTIVE,
    companyId: input.companyId,
    branchId: input.branchId,
    assignedRegion: input.assignedRegion ?? null,
  };

  if (matches[0]) {
    return prisma.user.update({
      where: { id: matches[0].id },
      data,
    });
  }

  return prisma.user.create({ data });
}

async function seedCompanyAndBranch() {
  const company = await prisma.company.upsert({
    where: {
      code: env("SEED_COMPANY_CODE", DEFAULT_COMPANY_CODE),
    },
    update: {
      name: env("SEED_COMPANY_NAME", "Simamia Float Company"),
      email: env("SEED_COMPANY_EMAIL", "company@simamia.co.tz"),
      phone: env("SEED_COMPANY_PHONE", "255716885656"),
      address: env(
        "SEED_COMPANY_ADDRESS",
        "Dar es Salaam, Tanzania",
      ),
      status: "ACTIVE",
    },
    create: {
      code: env("SEED_COMPANY_CODE", DEFAULT_COMPANY_CODE),
      name: env("SEED_COMPANY_NAME", "Simamia Float Company"),
      email: env("SEED_COMPANY_EMAIL", "company@simamia.co.tz"),
      phone: env("SEED_COMPANY_PHONE", "255716885656"),
      address: env(
        "SEED_COMPANY_ADDRESS",
        "Dar es Salaam, Tanzania",
      ),
      status: "ACTIVE",
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: env("SEED_BRANCH_CODE", DEFAULT_BRANCH_CODE),
      },
    },
    update: {
      name: env("SEED_BRANCH_NAME", "Head Office"),
      region: env("SEED_BRANCH_REGION", "Dar es Salaam"),
      address: env(
        "SEED_BRANCH_ADDRESS",
        "Dar es Salaam, Tanzania",
      ),
      status: "ACTIVE",
    },
    create: {
      companyId: company.id,
      code: env("SEED_BRANCH_CODE", DEFAULT_BRANCH_CODE),
      name: env("SEED_BRANCH_NAME", "Head Office"),
      region: env("SEED_BRANCH_REGION", "Dar es Salaam"),
      address: env(
        "SEED_BRANCH_ADDRESS",
        "Dar es Salaam, Tanzania",
      ),
      status: "ACTIVE",
    },
  });

  await prisma.companyAdminSetting.upsert({
    where: { companyId: company.id },
    update: {
      currency: "TZS",
      timezone: "Africa/Dar_es_Salaam",
      sms: true,
      email: true,
      inApp: true,
      gpsAlerts: true,
      bankMismatchHold: true,
    },
    create: {
      companyId: company.id,
      currency: "TZS",
      timezone: "Africa/Dar_es_Salaam",
      sms: true,
      email: true,
      inApp: true,
      gpsAlerts: true,
      bankMismatchHold: true,
    },
  });

  return { company, branch };
}

async function seedUsers(
  companyId: string,
  branchId: string,
) {
  const users: SeedUserInput[] = [
    {
      name: "System Administrator",
      username: "system-admin",
      email: "system-admin@simamia.co.tz",
      phone: "255700000001",
      password: env(
        "SEED_SYSTEM_ADMIN_PASSWORD",
        "SystemAdmin@2026",
      ),
      role: Role.SYSTEM_DEVELOPER,
      companyId: null,
      branchId: null,
    },
    {
      name: "Super Administrator",
      username: "super-admin",
      email: "super-admin@simamia.co.tz",
      phone: "255700000002",
      password: env(
        "SEED_SUPER_ADMIN_PASSWORD",
        "SuperAdmin@2026",
      ),
      role: Role.SUPER_ADMIN,
      companyId: null,
      branchId: null,
    },
    {
      name: "Company Administrator",
      username: "company-admin",
      email: "company-admin@simamia.co.tz",
      phone: "255700000003",
      password: env(
        "SEED_COMPANY_ADMIN_PASSWORD",
        "CompanyAdmin@2026",
      ),
      role: Role.COMPANY_ADMIN,
      companyId,
      branchId,
      assignedRegion: "Dar es Salaam",
    },
    {
      name: "Company Accountant",
      username: "accountant",
      email: "accountant@simamia.co.tz",
      phone: "255700000004",
      password: env(
        "SEED_ACCOUNTANT_PASSWORD",
        "Accountant@2026",
      ),
      role: Role.ACCOUNTANT,
      companyId,
      branchId,
      assignedRegion: "Dar es Salaam",
    },
    {
      name: "Float Staff Officer",
      username: "staff",
      email: "staff@simamia.co.tz",
      phone: "255700000005",
      password: env(
        "SEED_STAFF_PASSWORD",
        "Staff@2026",
      ),
      role: Role.STAFF,
      companyId,
      branchId,
      assignedRegion: "Dar es Salaam",
    },
    {
      name: "Broker Portal User",
      username: "broker",
      email: "broker@simamia.co.tz",
      phone: "255700000006",
      password: env(
        "SEED_BROKER_PASSWORD",
        "Broker@2026",
      ),
      role: Role.BROKER,
      companyId,
      branchId,
      assignedRegion: "Dar es Salaam",
    },
  ];

  const created = new Map<Role, Awaited<ReturnType<typeof upsertUser>>>();

  for (const user of users) {
    const saved = await upsertUser(user);
    created.set(user.role, saved);
    console.log(`✓ User ready: ${user.username} (${user.role})`);
  }

  const companyAdmin = created.get(Role.COMPANY_ADMIN);
  const staff = created.get(Role.STAFF);
  const broker = created.get(Role.BROKER);

  if (!companyAdmin || !staff || !broker) {
    throw new Error(
      "Company admin, staff or broker user was not created.",
    );
  }

  await prisma.staffBrokerAssignment.upsert({
    where: {
      companyId_brokerId: {
        companyId,
        brokerId: broker.id,
      },
    },
    update: {
      staffId: staff.id,
      assignedById: companyAdmin.id,
      status: StaffAssignmentStatus.ACTIVE,
      endedAt: null,
      notes: "Seeded broker portal assignment.",
    },
    create: {
      companyId,
      staffId: staff.id,
      brokerId: broker.id,
      assignedById: companyAdmin.id,
      status: StaffAssignmentStatus.ACTIVE,
      notes: "Seeded broker portal assignment.",
    },
  });

  return {
    systemDeveloper: created.get(Role.SYSTEM_DEVELOPER)!,
    superAdmin: created.get(Role.SUPER_ADMIN)!,
    companyAdmin,
    accountant: created.get(Role.ACCOUNTANT)!,
    staff,
    broker,
  };
}

const SAMPLE_BROKERS: BrokerSeedInput[] = [
  {
    code: "BRK-DSM-001",
    name: "Mikocheni Float Agent",
    businessName: "Mikocheni Mobile Services",
    phone: "255754100001",
    location: "Mikocheni",
    region: "Dar es Salaam",
    district: "Kinondoni",
    ward: "Mikocheni",
    address: "Mikocheni, Dar es Salaam",
    network: MobileNetwork.VODACOM,
    agentNumber: "AGT-VODA-001",
  },
  {
    code: "BRK-DSM-002",
    name: "Kariakoo Float Agent",
    businessName: "Kariakoo Money Point",
    phone: "255684100002",
    location: "Kariakoo",
    region: "Dar es Salaam",
    district: "Ilala",
    ward: "Kariakoo",
    address: "Kariakoo, Dar es Salaam",
    network: MobileNetwork.AIRTEL,
    agentNumber: "AGT-AIRTEL-002",
  },
  {
    code: "BRK-DSM-003",
    name: "Temeke Float Agent",
    businessName: "Temeke Digital Services",
    phone: "255714100003",
    location: "Temeke",
    region: "Dar es Salaam",
    district: "Temeke",
    ward: "Temeke",
    address: "Temeke, Dar es Salaam",
    network: MobileNetwork.YAS_MIX,
    agentNumber: "AGT-YAS-003",
  },
  {
    code: "BRK-DSM-004",
    name: "Ubungo Float Agent",
    businessName: "Ubungo Cash Services",
    phone: "255624100004",
    location: "Ubungo",
    region: "Dar es Salaam",
    district: "Ubungo",
    ward: "Ubungo",
    address: "Ubungo, Dar es Salaam",
    network: MobileNetwork.HALOTEL,
    agentNumber: "AGT-HALO-004",
  },
];

async function assignBrokerCustomerToStaff(
  companyId: string,
  brokerCustomerId: string,
  staffId: string,
  assignedById: string,
  assignedArea: string,
) {
  await prisma.staffBrokerCustomerAssignment.upsert({
    where: {
      companyId_brokerCustomerId: {
        companyId,
        brokerCustomerId,
      },
    },
    update: {
      staffId,
      assignedById,
      assignedArea,
      status: StaffAssignmentStatus.ACTIVE,
      endedAt: null,
    },
    create: {
      companyId,
      staffId,
      brokerCustomerId,
      assignedById,
      assignedArea,
      status: StaffAssignmentStatus.ACTIVE,
      notes: "Automatically assigned by the database seed.",
    },
  });
}

async function seedSampleBrokers(
  companyId: string,
  staffId: string,
  assignedById: string,
) {
  console.log(
    "ℹ Excel file was not found. Adding editable sample brokers.",
  );

  for (const item of SAMPLE_BROKERS) {
    const broker = await prisma.brokerCustomer.upsert({
      where: {
        companyId_code: {
          companyId,
          code: item.code,
        },
      },
      update: {
        name: item.name,
        businessName: item.businessName,
        phone: item.phone,
        location: item.location,
        region: item.region,
        district: item.district,
        ward: item.ward,
        address: item.address,
        country: "Tanzania",
        nationality: "Tanzanian",
        status: BrokerCustomerStatus.ACTIVE,
        normalizedName: normaliseName(item.name),
        isImported: false,
      },
      create: {
        companyId,
        code: item.code,
        name: item.name,
        businessName: item.businessName,
        phone: item.phone,
        location: item.location,
        region: item.region,
        district: item.district,
        ward: item.ward,
        address: item.address,
        country: "Tanzania",
        nationality: "Tanzanian",
        status: BrokerCustomerStatus.ACTIVE,
        normalizedName: normaliseName(item.name),
        isImported: false,
        registrationDate: new Date(),
        notes: "Sample broker created by prisma/seed.ts.",
      },
    });

    await prisma.brokerAgentAccount.upsert({
      where: {
        companyId_network_agentNumber: {
          companyId,
          network: item.network,
          agentNumber: item.agentNumber,
        },
      },
      update: {
        brokerCustomerId: broker.id,
        simPhoneNumber: item.phone,
        accountName: item.businessName,
        isPrimary: true,
        status: "ACTIVE",
      },
      create: {
        companyId,
        brokerCustomerId: broker.id,
        network: item.network,
        simPhoneNumber: item.phone,
        agentNumber: item.agentNumber,
        accountName: item.businessName,
        isPrimary: true,
        status: "ACTIVE",
      },
    });

    await assignBrokerCustomerToStaff(
      companyId,
      broker.id,
      staffId,
      assignedById,
      `${item.district}, ${item.region}`,
    );

    console.log(`✓ Sample broker ready: ${item.code} - ${item.name}`);
  }

  return {
    source: "sample" as const,
    imported: SAMPLE_BROKERS.length,
    skipped: 0,
    failed: 0,
  };
}

function readExcelAgents(
  workbook: XLSX.WorkBook,
): {
  sheetName: string;
  rows: ExcelRow[];
} {
  const requestedSheet = env("BROKER_EXCEL_SHEET");
  const sheetName =
    requestedSheet && workbook.Sheets[requestedSheet]
      ? requestedSheet
      : workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("The Excel workbook has no sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Excel sheet not found: ${sheetName}`);
  }

  return {
    sheetName,
    rows: XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      defval: "",
      raw: false,
    }),
  };
}

async function importBrokersFromExcel(
  excelPath: string,
  companyId: string,
  staffId: string,
  assignedById: string,
) {
  console.log(`ℹ Importing brokers from: ${excelPath}`);

  const buffer = await readFile(excelPath);
  const checksum = fileSha256(buffer);
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });
  const { sheetName, rows } = readExcelAgents(workbook);

  const importBatch = await prisma.dataImportBatch.upsert({
    where: {
      companyId_sourceChecksum: {
        companyId,
        sourceChecksum: checksum,
      },
    },
    update: {
      sourceFileName: path.basename(excelPath),
      sourceSheetName: sheetName,
      sourceType: ImportedDataSourceType.EXCEL_AGENT_MASTER,
      status: ImportBatchStatus.PROCESSING,
      totalRows: rows.length,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      importedAt: new Date(),
      notes: "Broker import started by prisma/seed.ts.",
    },
    create: {
      companyId,
      sourceType: ImportedDataSourceType.EXCEL_AGENT_MASTER,
      sourceFileName: path.basename(excelPath),
      sourceSheetName: sheetName,
      sourceChecksum: checksum,
      status: ImportBatchStatus.PROCESSING,
      totalRows: rows.length,
      notes: "Broker import started by prisma/seed.ts.",
    },
  });

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const usedCodes = new Set<string>();
  const defaultLocation = env(
    "DEFAULT_BROKER_LOCATION",
    "Tanzania",
  );

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const sourceRowNumber = index + 2;

    const sourceAgentName = rowValue(row, [
      "Agent_name",
      "Agent Name",
      "agentname",
      "name",
    ]);
    const sourceMsisdn = rowValue(row, [
      "Agent_MSISDN",
      "Agent MSISDN",
      "MSISDN",
      "phone",
      "mobile",
    ]);
    const sourceAliasCode = rowValue(row, [
      "Alias_code",
      "Alias Code",
      "alias",
      "code",
      "agent code",
    ]);
    const sourceLocation = rowValue(row, [
      "Location",
      "Area",
      "Region",
      "District",
    ]);

    const name = compactSpaces(sourceAgentName);
    const phone = normalisePhone(sourceMsisdn);

    if (!name || !phone) {
      skipped += 1;
      console.warn(
        `- Skipped Excel row ${sourceRowNumber}: missing agent name or phone.`,
      );
      continue;
    }

    let code = safeBrokerCode(
      sourceAliasCode,
      sourceRowNumber,
    );

    if (usedCodes.has(code)) {
      code = truncate(`${code}-${sourceRowNumber}`, 80);
    }

    usedCodes.add(code);

    try {
      const broker = await prisma.brokerCustomer.upsert({
        where: {
          companyId_code: {
            companyId,
            code,
          },
        },
        update: {
          name,
          phone,
          location: sourceLocation || defaultLocation,
          country: "Tanzania",
          status: BrokerCustomerStatus.ACTIVE,
          importBatchId: importBatch.id,
          sourceRowNumber,
          sourceSheetName: truncate(sheetName, 100),
          sourceAgentName: truncate(sourceAgentName, 255),
          sourceMsisdn: truncate(sourceMsisdn, 32),
          sourceAliasCode: truncate(sourceAliasCode, 32),
          normalizedName: truncate(normaliseName(name), 255),
          isImported: true,
          importedAt: new Date(),
          notes: `Imported from ${path.basename(excelPath)}.`,
        },
        create: {
          companyId,
          code,
          name,
          phone,
          location: sourceLocation || defaultLocation,
          country: "Tanzania",
          status: BrokerCustomerStatus.ACTIVE,
          importBatchId: importBatch.id,
          sourceRowNumber,
          sourceSheetName: truncate(sheetName, 100),
          sourceAgentName: truncate(sourceAgentName, 255),
          sourceMsisdn: truncate(sourceMsisdn, 32),
          sourceAliasCode: truncate(sourceAliasCode, 32),
          normalizedName: truncate(normaliseName(name), 255),
          isImported: true,
          importedAt: new Date(),
          registrationDate: new Date(),
          notes: `Imported from ${path.basename(excelPath)}.`,
        },
      });

      const agentNumber = truncate(
        sourceAliasCode || code,
        80,
      );

      await prisma.brokerAgentAccount.upsert({
        where: {
          companyId_network_agentNumber: {
            companyId,
            network: MobileNetwork.OTHER,
            agentNumber,
          },
        },
        update: {
          brokerCustomerId: broker.id,
          simPhoneNumber: truncate(phone, 32),
          accountName: truncate(name, 191),
          isPrimary: true,
          status: "ACTIVE",
        },
        create: {
          companyId,
          brokerCustomerId: broker.id,
          network: MobileNetwork.OTHER,
          simPhoneNumber: truncate(phone, 32),
          agentNumber,
          accountName: truncate(name, 191),
          isPrimary: true,
          status: "ACTIVE",
        },
      });

      await assignBrokerCustomerToStaff(
        companyId,
        broker.id,
        staffId,
        assignedById,
        sourceLocation || defaultLocation,
      );

      imported += 1;

      if (imported % 100 === 0) {
        console.log(`  ${imported} broker rows imported...`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `✗ Failed Excel row ${sourceRowNumber}:`,
        error,
      );
    }
  }

  const finalStatus =
    failed === 0
      ? ImportBatchStatus.COMPLETED
      : imported > 0
        ? ImportBatchStatus.PARTIAL
        : ImportBatchStatus.FAILED;

  await prisma.dataImportBatch.update({
    where: { id: importBatch.id },
    data: {
      status: finalStatus,
      totalRows: rows.length,
      importedRows: imported,
      skippedRows: skipped,
      failedRows: failed,
      importedAt: new Date(),
      notes: [
        `Imported ${imported} broker rows.`,
        `Skipped ${skipped}.`,
        `Failed ${failed}.`,
      ].join(" "),
    },
  });

  return {
    source: "excel" as const,
    imported,
    skipped,
    failed,
    sheetName,
    checksum,
  };
}

async function seedBrokers(
  companyId: string,
  staffId: string,
  assignedById: string,
) {
  const excelPath = path.resolve(
    env(
      "BROKER_EXCEL_PATH",
      DEFAULT_BROKER_EXCEL_PATH,
    ),
  );

  if (await fileExists(excelPath)) {
    return importBrokersFromExcel(
      excelPath,
      companyId,
      staffId,
      assignedById,
    );
  }

  return seedSampleBrokers(
    companyId,
    staffId,
    assignedById,
  );
}

function printCredentials() {
  const rows = [
    [
      "System admin",
      "system-admin",
      env("SEED_SYSTEM_ADMIN_PASSWORD", "SystemAdmin@2026"),
      "SYSTEM_DEVELOPER",
    ],
    [
      "Super admin",
      "super-admin",
      env("SEED_SUPER_ADMIN_PASSWORD", "SuperAdmin@2026"),
      "SUPER_ADMIN",
    ],
    [
      "Company admin",
      "company-admin",
      env("SEED_COMPANY_ADMIN_PASSWORD", "CompanyAdmin@2026"),
      "COMPANY_ADMIN",
    ],
    [
      "Accountant",
      "accountant",
      env("SEED_ACCOUNTANT_PASSWORD", "Accountant@2026"),
      "ACCOUNTANT",
    ],
    [
      "Staff",
      "staff",
      env("SEED_STAFF_PASSWORD", "Staff@2026"),
      "STAFF",
    ],
    [
      "Broker",
      "broker",
      env("SEED_BROKER_PASSWORD", "Broker@2026"),
      "BROKER",
    ],
  ];

  console.log("\nLogin credentials");
  console.table(
    rows.map(([portal, username, password, role]) => ({
      portal,
      username,
      password,
      role,
    })),
  );
}

async function main() {
  console.log("Starting Simamia database seed...\n");

  const { company, branch } =
    await seedCompanyAndBranch();

  console.log(`✓ Company ready: ${company.name}`);
  console.log(`✓ Branch ready: ${branch.name}`);

  const users = await seedUsers(
    company.id,
    branch.id,
  );

  const brokerResult = await seedBrokers(
    company.id,
    users.staff.id,
    users.companyAdmin.id,
  );

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.brokerCustomer.count({
      where: { companyId: company.id },
    }),
    prisma.staffBrokerCustomerAssignment.count({
      where: { companyId: company.id },
    }),
  ]);

  console.log("\nSeed completed successfully.");
  console.log(`Users in database: ${counts[0]}`);
  console.log(`Broker customers: ${counts[1]}`);
  console.log(`Broker assignments: ${counts[2]}`);
  console.log(
    `Broker source: ${brokerResult.source}; imported: ${brokerResult.imported}; skipped: ${brokerResult.skipped}; failed: ${brokerResult.failed}`,
  );

  printCredentials();
  console.log(
    "\nSecurity: change all default passwords before using this database outside local development.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("\nSeed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
