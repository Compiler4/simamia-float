import { prisma } from "@/lib/prisma";

type StaffSchemaResult = {
  ok: boolean;
  repaired: string[];
  warnings: string[];
};

type StaffSchemaGlobal = typeof globalThis & {
  __simamiaStaffOperationsSchemaPromise?: Promise<StaffSchemaResult>;
};

type TableSpec = {
  name: string;
  sql: string;
};

type ColumnPatch = {
  table: string;
  column: string;
  definition: string;
  backfillSql?: string;
};

const TABLES: TableSpec[] = [
  {
    name: "staff_work_areas",
    sql: `
CREATE TABLE IF NOT EXISTS \`staff_work_areas\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`region\` VARCHAR(191) NULL,
  \`district\` VARCHAR(191) NULL,
  \`ward\` VARCHAR(191) NULL,
  \`street\` VARCHAR(191) NULL,
  \`centreLatitude\` DOUBLE NULL,
  \`centreLongitude\` DOUBLE NULL,
  \`radiusMeters\` INT NULL,
  \`polygonJson\` LONGTEXT NULL,
  \`status\` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`endedAt\` DATETIME(3) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  INDEX \`staff_work_areas_company_staff_status_idx\` (\`companyId\`, \`staffId\`, \`status\`),
  INDEX \`staff_work_areas_company_region_district_ward_idx\` (\`companyId\`, \`region\`, \`district\`, \`ward\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
  {
    name: "staff_broker_customer_assignments",
    sql: `
CREATE TABLE IF NOT EXISTS \`staff_broker_customer_assignments\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`brokerCustomerId\` VARCHAR(191) NOT NULL,
  \`workAreaId\` VARCHAR(191) NULL,
  \`assignedById\` VARCHAR(191) NULL,
  \`assignedArea\` VARCHAR(255) NULL,
  \`status\` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`endedAt\` DATETIME(3) NULL,
  \`notes\` TEXT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`staff_broker_customer_assignments_company_broker_key\` (\`companyId\`, \`brokerCustomerId\`),
  INDEX \`staff_broker_customer_assignments_company_staff_status_idx\` (\`companyId\`, \`staffId\`, \`status\`),
  INDEX \`staff_broker_customer_assignments_work_area_idx\` (\`workAreaId\`),
  INDEX \`staff_broker_customer_assignments_assigned_by_idx\` (\`assignedById\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
  {
    name: "broker_agent_accounts",
    sql: `
CREATE TABLE IF NOT EXISTS \`broker_agent_accounts\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`brokerCustomerId\` VARCHAR(191) NOT NULL,
  \`network\` ENUM('VODACOM','YAS_MIX','AIRTEL','HALOTEL','OTHER') NOT NULL,
  \`simPhoneNumber\` VARCHAR(32) NOT NULL,
  \`agentNumber\` VARCHAR(80) NOT NULL,
  \`accountName\` VARCHAR(191) NULL,
  \`isPrimary\` TINYINT(1) NOT NULL DEFAULT 0,
  \`status\` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`broker_agent_accounts_company_network_agent_key\` (\`companyId\`, \`network\`, \`agentNumber\`),
  INDEX \`broker_agent_accounts_company_network_idx\` (\`companyId\`, \`network\`),
  INDEX \`broker_agent_accounts_broker_status_idx\` (\`brokerCustomerId\`, \`status\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
  {
    name: "staff_network_lines",
    sql: `
CREATE TABLE IF NOT EXISTS \`staff_network_lines\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`network\` ENUM('VODACOM','YAS_MIX','AIRTEL','HALOTEL','OTHER') NOT NULL,
  \`simCardNumber\` VARCHAR(32) NOT NULL,
  \`agentNumber\` VARCHAR(80) NULL,
  \`accountName\` VARCHAR(191) NULL,
  \`purpose\` ENUM('FLOAT','CASH','BOTH') NOT NULL DEFAULT 'BOTH',
  \`assignedArea\` VARCHAR(191) NULL,
  \`isPrimary\` TINYINT(1) NOT NULL DEFAULT 0,
  \`status\` ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  \`floatBalance\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`cashBalance\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`staff_network_lines_company_network_sim_key\` (\`companyId\`, \`network\`, \`simCardNumber\`),
  INDEX \`staff_network_lines_company_staff_status_idx\` (\`companyId\`, \`staffId\`, \`status\`),
  INDEX \`staff_network_lines_staff_network_idx\` (\`staffId\`, \`network\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
  {
    name: "staff_funding_receipts",
    sql: `
CREATE TABLE IF NOT EXISTS \`staff_funding_receipts\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`accountantId\` VARCHAR(191) NOT NULL,
  \`networkLineId\` VARCHAR(191) NULL,
  \`floatTransactionId\` VARCHAR(191) NULL,
  \`referenceNo\` VARCHAR(191) NOT NULL,
  \`floatAmount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`cashAmount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`note\` TEXT NULL,
  \`receiptUrl\` VARCHAR(600) NULL,
  \`status\` ENUM('PENDING','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PENDING',
  \`issuedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`confirmedAt\` DATETIME(3) NULL,
  \`rejectedAt\` DATETIME(3) NULL,
  \`verifiedById\` VARCHAR(191) NULL,
  \`verifiedAt\` DATETIME(3) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`staff_funding_receipts_float_transaction_key\` (\`floatTransactionId\`),
  UNIQUE INDEX \`staff_funding_receipts_company_reference_key\` (\`companyId\`, \`referenceNo\`),
  INDEX \`staff_funding_receipts_company_staff_issued_idx\` (\`companyId\`, \`staffId\`, \`issuedAt\`),
  INDEX \`staff_funding_receipts_accountant_issued_idx\` (\`accountantId\`, \`issuedAt\`),
  INDEX \`staff_funding_receipts_network_issued_idx\` (\`networkLineId\`, \`issuedAt\`),
  INDEX \`staff_funding_receipts_status_idx\` (\`status\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
  {
    name: "broker_service_visits",
    sql: `
CREATE TABLE IF NOT EXISTS \`broker_service_visits\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`brokerCustomerId\` VARCHAR(191) NOT NULL,
  \`deviceId\` VARCHAR(191) NULL,
  \`serviceActivityId\` VARCHAR(191) NULL,
  \`serviceDay\` DATETIME(3) NOT NULL,
  \`status\` ENUM('STARTED','ARRIVED','SERVICE_RECORDED','PROOF_PENDING','COMPLETED','LATE_PROOF','CANCELLED') NOT NULL DEFAULT 'STARTED',
  \`serviceType\` VARCHAR(191) NOT NULL DEFAULT 'GPS_VISIT_UPDATE',
  \`communicationNote\` TEXT NULL,
  \`floatAmount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`cashAmount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`companyIncome\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`staffLatitude\` DOUBLE NULL,
  \`staffLongitude\` DOUBLE NULL,
  \`brokerLatitude\` DOUBLE NULL,
  \`brokerLongitude\` DOUBLE NULL,
  \`distanceMeters\` DOUBLE NULL,
  \`locationMatched\` TINYINT(1) NOT NULL DEFAULT 0,
  \`locationName\` VARCHAR(255) NULL,
  \`proofUrl\` VARCHAR(500) NULL,
  \`notes\` TEXT NULL,
  \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`arrivedAt\` DATETIME(3) NULL,
  \`serviceProvidedAt\` DATETIME(3) NULL,
  \`proofDueAt\` DATETIME(3) NULL,
  \`proofUploadedAt\` DATETIME(3) NULL,
  \`completedAt\` DATETIME(3) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`broker_service_visits_service_activity_key\` (\`serviceActivityId\`),
  UNIQUE INDEX \`broker_service_visits_company_staff_broker_day_key\` (\`companyId\`, \`staffId\`, \`brokerCustomerId\`, \`serviceDay\`),
  INDEX \`broker_service_visits_company_day_status_idx\` (\`companyId\`, \`serviceDay\`, \`status\`),
  INDEX \`broker_service_visits_staff_day_idx\` (\`staffId\`, \`serviceDay\`),
  INDEX \`broker_service_visits_broker_day_idx\` (\`brokerCustomerId\`, \`serviceDay\`),
  INDEX \`broker_service_visits_proof_due_status_idx\` (\`proofDueAt\`, \`status\`),
  INDEX \`broker_service_visits_device_idx\` (\`deviceId\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
  {
    name: "staff_proof_submissions",
    sql: `
CREATE TABLE IF NOT EXISTS \`staff_proof_submissions\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`brokerCustomerId\` VARCHAR(191) NULL,
  \`serviceVisitId\` VARCHAR(191) NULL,
  \`networkLineId\` VARCHAR(191) NULL,
  \`fileId\` VARCHAR(191) NULL,
  \`direction\` ENUM('ACCOUNTANT_TO_STAFF','STAFF_TO_BROKER','BROKER_TO_STAFF','STAFF_TO_ACCOUNTANT','STAFF_TO_BANK','EXPENSE_PAYMENT','OTHER') NOT NULL DEFAULT 'OTHER',
  \`kind\` ENUM('PROFILE_IMAGE','SMS_SCREENSHOT','BANK_SLIP','BANK_RECEIPT','BANK_STATEMENT','PDF','DOCUMENT','IMAGE','SERVICE_PROOF','EXPENSE_RECEIPT','SIGNATURE','OTHER') NOT NULL DEFAULT 'SMS_SCREENSHOT',
  \`referenceNo\` VARCHAR(191) NOT NULL,
  \`transactionId\` VARCHAR(191) NULL,
  \`senderName\` VARCHAR(255) NOT NULL DEFAULT '',
  \`receiverName\` VARCHAR(255) NOT NULL DEFAULT '',
  \`amount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
  \`transactionAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`smsText\` LONGTEXT NULL,
  \`proofUrl\` VARCHAR(600) NULL,
  \`documentUrl\` VARCHAR(600) NULL,
  \`weekKey\` VARCHAR(16) NOT NULL DEFAULT '',
  \`status\` ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  \`verificationNote\` TEXT NULL,
  \`verifiedById\` VARCHAR(191) NULL,
  \`verifiedAt\` DATETIME(3) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`staff_proof_submissions_company_reference_key\` (\`companyId\`, \`referenceNo\`),
  INDEX \`staff_proof_submissions_company_staff_transaction_idx\` (\`companyId\`, \`staffId\`, \`transactionAt\`),
  INDEX \`staff_proof_submissions_staff_week_idx\` (\`staffId\`, \`weekKey\`),
  INDEX \`staff_proof_submissions_broker_idx\` (\`brokerCustomerId\`),
  INDEX \`staff_proof_submissions_service_visit_idx\` (\`serviceVisitId\`),
  INDEX \`staff_proof_submissions_status_created_idx\` (\`status\`, \`createdAt\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`,
  },
];

/*
 * The production database started from an older SIMAMIA SQL export. Several
 * tables therefore already exist but are missing fields that the current
 * Prisma schema selects automatically. CREATE TABLE IF NOT EXISTS cannot
 * repair an existing table, so these additions are applied one-by-one.
 *
 * Every patch is additive and preserves existing rows.
 */
const COLUMN_PATCHES: ColumnPatch[] = [
  // Existing staff funding receipts from the older dump do not contain these.
  { table: "staff_funding_receipts", column: "receiptUrl", definition: "VARCHAR(600) NULL" },
  { table: "staff_funding_receipts", column: "verifiedById", definition: "VARCHAR(191) NULL" },
  { table: "staff_funding_receipts", column: "verifiedAt", definition: "DATETIME(3) NULL" },

  // Expense was expanded to record who created a request.
  { table: "expenses", column: "createdById", definition: "VARCHAR(191) NULL" },
  { table: "expenses", column: "expenseDate", definition: "DATETIME(3) NULL", backfillSql: "UPDATE `expenses` SET `expenseDate` = COALESCE(`createdAt`, CURRENT_TIMESTAMP(3)) WHERE `expenseDate` IS NULL" },
  { table: "expenses", column: "otherCategory", definition: "VARCHAR(191) NULL" },
  { table: "expenses", column: "requestMode", definition: "VARCHAR(80) NOT NULL DEFAULT 'REIMBURSEMENT'" },
  { table: "expenses", column: "requestedAction", definition: "TEXT NULL" },
  { table: "expenses", column: "reviewNote", definition: "TEXT NULL" },

  // Proof/document V4 support.
  { table: "staff_proof_submissions", column: "documentUrl", definition: "VARCHAR(600) NULL" },

  // Broker visit V4 support. serviceDay is backfilled for every historical row.
  {
    table: "broker_service_visits",
    column: "serviceDay",
    definition: "DATETIME(3) NULL",
    backfillSql:
      "UPDATE `broker_service_visits` SET `serviceDay` = COALESCE(`serviceProvidedAt`, `startedAt`, `createdAt`, CURRENT_TIMESTAMP(3)) WHERE `serviceDay` IS NULL",
  },
  { table: "broker_service_visits", column: "locationName", definition: "VARCHAR(255) NULL" },
  { table: "broker_service_visits", column: "proofUrl", definition: "VARCHAR(500) NULL" },
  { table: "broker_service_visits", column: "notes", definition: "TEXT NULL" },

  // Accountant/staff attendance UI expects this consolidated status field.
  { table: "attendance", column: "overallStatus", definition: "VARCHAR(40) NULL" },

  // The current StaffWorkArea model coexists with fields from the older area model.
  {
    table: "staff_work_areas",
    column: "name",
    definition: "VARCHAR(191) NULL",
    backfillSql:
      "UPDATE `staff_work_areas` SET `name` = COALESCE(NULLIF(`areaLabel`, ''), NULLIF(`region`, ''), 'Assigned work area') WHERE `name` IS NULL OR TRIM(`name`) = ''",
  },
  { table: "staff_work_areas", column: "centreLatitude", definition: "DOUBLE NULL" },
  { table: "staff_work_areas", column: "centreLongitude", definition: "DOUBLE NULL" },
  { table: "staff_work_areas", column: "radiusMeters", definition: "INT NULL" },
  { table: "staff_work_areas", column: "polygonJson", definition: "LONGTEXT NULL" },

  // Older user exports predate the credential-history columns used by current auth.
  { table: "users", column: "usernameChangedAt", definition: "DATETIME(3) NULL" },
  { table: "users", column: "passwordChangedAt", definition: "DATETIME(3) NULL" },
];

function safeName(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe database identifier: ${value}`);
  }
  return value;
}

async function tableExists(table: string): Promise<boolean> {
  const cleanTable = safeName(table);
  const rows = (await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*) AS total
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${cleanTable}'`,
  )) as Array<{ total?: number | bigint | string }>;

  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const cleanTable = safeName(table);
  const cleanColumn = safeName(column);
  const rows = (await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${cleanTable}'
        AND COLUMN_NAME = '${cleanColumn}'`,
  )) as Array<{ total?: number | bigint | string }>;

  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function applyColumnPatch(
  patch: ColumnPatch,
  repaired: string[],
  warnings: string[],
): Promise<void> {
  const table = safeName(patch.table);
  const column = safeName(patch.column);

  if (!(await tableExists(table))) {
    // The table creation pass will normally have handled Staff V4 tables.
    // Core tables are left to their own migrations rather than creating an
    // incomplete substitute here.
    return;
  }

  try {
    if (!(await columnExists(table, column))) {
      await (prisma as any).$executeRawUnsafe(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${patch.definition}`,
      );
      repaired.push(`${table}.${column}`);
    }

    if (patch.backfillSql) {
      await (prisma as any).$executeRawUnsafe(patch.backfillSql);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`STAFF_SCHEMA_COLUMN_REPAIR_${table}_${column}:`, message);
    warnings.push(`${table}.${column}: ${message}`);
  }
}

async function repairNullableServiceDefaults(warnings: string[]): Promise<void> {
  try {
    if (await tableExists("broker_service_visits")) {
      await (prisma as any).$executeRawUnsafe(
        "UPDATE `broker_service_visits` SET `serviceType` = 'GPS_VISIT_UPDATE' WHERE `serviceType` IS NULL OR TRIM(`serviceType`) = ''",
      );
    }
  } catch (error) {
    warnings.push(
      `broker_service_visits.serviceType: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function runSchemaRepair(): Promise<StaffSchemaResult> {
  const repaired: string[] = [];
  const warnings: string[] = [];

  for (const table of TABLES) {
    try {
      await (prisma as any).$executeRawUnsafe(table.sql);
      repaired.push(table.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`STAFF_SCHEMA_REPAIR_${table.name}:`, message);
      warnings.push(`${table.name}: ${message}`);
    }
  }

  for (const patch of COLUMN_PATCHES) {
    await applyColumnPatch(patch, repaired, warnings);
  }

  await repairNullableServiceDefaults(warnings);

  return {
    ok: warnings.length === 0,
    repaired,
    warnings,
  };
}

export async function ensureStaffOperationsSchema(): Promise<StaffSchemaResult> {
  const globalState = globalThis as StaffSchemaGlobal;

  if (!globalState.__simamiaStaffOperationsSchemaPromise) {
    globalState.__simamiaStaffOperationsSchemaPromise = runSchemaRepair().then((result) => {
      // Never cache a degraded result for the whole dev-server lifetime. A
      // database connection may recover, or the repair command may be run in
      // another terminal. The next request should be allowed to verify again.
      if (!result.ok) {
        globalState.__simamiaStaffOperationsSchemaPromise = undefined;
      }
      return result;
    }).catch((error) => {
      globalState.__simamiaStaffOperationsSchemaPromise = undefined;
      return {
        ok: false,
        repaired: [],
        warnings: [error instanceof Error ? error.message : String(error)],
      };
    });
  }

  return globalState.__simamiaStaffOperationsSchemaPromise;
}

export const STAFF_OPERATIONS_TABLES = TABLES.map((table) => table.name);
