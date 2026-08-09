import "dotenv/config";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import mariadb, { type PoolConnection } from "mariadb";
import * as XLSX from "xlsx";

type AgentRow = {
  sourceRowNumber: number;
  name: string;
  sourceName: string;
  msisdn: string;
  aliasCode: string;
  code: string;
  brokerId: string;
  accountId: string;
  normalizedName: string;
};

const COMPANY_CODE = process.env.IMPORT_COMPANY_CODE?.trim() || "SIMAMIA";
const COMPANY_NAME = "Simamia Float Company";
const BRANCH_CODE = "DODOMA";
const BRANCH_NAME = "Dodoma Branch";
const REGION = "Dodoma";
const DISTRICT = "Dodoma City";
const LOCATION = "Dodoma Branch";
const ADDRESS = "Dodoma Branch, Dodoma, Tanzania";
const NETWORK = "OTHER";

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function cleanAlias(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF\s]/g, "")
    .trim();
}

function deterministicId(prefix: string, key: string): string {
  return `${prefix}${createHash("sha1").update(key).digest("hex").slice(0, 30)}`;
}

function findDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function loadAgents(workbookPath: string): {
  checksum: string;
  sheetName: string;
  rows: AgentRow[];
} {
  const fileBuffer = readFileSync(workbookPath);
  const checksum = createHash("sha256").update(fileBuffer).digest("hex");
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellText: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");

  const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
  });

  const rows: AgentRow[] = [];
  raw.slice(3).forEach((row, index) => {
    const sourceRowNumber = index + 4;
    const sourceName = cleanText(row[0]);
    const msisdn = digits(row[1]);
    const aliasCode = cleanAlias(row[2]);

    if (!sourceName && !msisdn && !aliasCode) return;
    if (!msisdn) throw new Error(`Missing Agent_MSISDN at Excel row ${sourceRowNumber}.`);
    if (!aliasCode) throw new Error(`Missing Alias_code at Excel row ${sourceRowNumber}.`);
    if (!msisdn.startsWith("255")) {
      throw new Error(`MSISDN must start with 255 at Excel row ${sourceRowNumber}.`);
    }

    const name = sourceName || `AGENT ${aliasCode}`;
    const code = `AGT-${aliasCode}`;
    rows.push({
      sourceRowNumber,
      name,
      sourceName,
      msisdn,
      aliasCode,
      code,
      brokerId: deterministicId("brk_", `${COMPANY_CODE}|${aliasCode}|${msisdn}`),
      accountId: deterministicId("baa_", `${COMPANY_CODE}|${NETWORK}|${aliasCode}`),
      normalizedName: name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim(),
    });
  });

  const duplicateMsisdn = findDuplicate(rows.map((row) => row.msisdn));
  const duplicateAlias = findDuplicate(rows.map((row) => row.aliasCode));
  if (duplicateMsisdn) throw new Error(`Duplicate MSISDN found: ${duplicateMsisdn}`);
  if (duplicateAlias) throw new Error(`Duplicate alias code found: ${duplicateAlias}`);

  return { checksum, sheetName, rows };
}

async function ensureCompanyAndBranch(
  connection: PoolConnection,
): Promise<{ companyId: string; branchId: string }> {
  await connection.query(
    `INSERT INTO \`companies\`
      (\`id\`,\`name\`,\`code\`,\`email\`,\`phone\`,\`address\`,\`status\`,\`createdAt\`,\`updatedAt\`)
     VALUES ('manual_simamia_company', ?, ?, 'company@simamia.co.tz', '255716885656',
             'Dodoma, Tanzania', 'ACTIVE', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       \`name\`=VALUES(\`name\`),\`address\`='Dodoma, Tanzania',
       \`status\`='ACTIVE',\`updatedAt\`=CURRENT_TIMESTAMP(3)`,
    [COMPANY_NAME, COMPANY_CODE],
  );

  const companies = await connection.query<Array<{ id: string }>>(
    "SELECT `id` FROM `companies` WHERE `code`=? LIMIT 1",
    [COMPANY_CODE],
  );
  const companyId = String(companies[0]?.id ?? "");
  if (!companyId) throw new Error(`Company ${COMPANY_CODE} could not be resolved.`);

  await connection.query(
    `INSERT INTO \`branches\`
      (\`id\`,\`companyId\`,\`name\`,\`code\`,\`region\`,\`address\`,\`status\`,\`createdAt\`,\`updatedAt\`)
     VALUES ('branch_simamia_dodoma_001', ?, ?, ?, ?, ?, 'ACTIVE',
             CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       \`name\`=VALUES(\`name\`),\`region\`=VALUES(\`region\`),
       \`address\`=VALUES(\`address\`),\`status\`='ACTIVE',
       \`updatedAt\`=CURRENT_TIMESTAMP(3)`,
    [companyId, BRANCH_NAME, BRANCH_CODE, REGION, ADDRESS],
  );

  const branches = await connection.query<Array<{ id: string }>>(
    "SELECT `id` FROM `branches` WHERE `companyId`=? AND `code`=? LIMIT 1",
    [companyId, BRANCH_CODE],
  );
  const branchId = String(branches[0]?.id ?? "");
  if (!branchId) throw new Error("Dodoma Branch could not be resolved.");

  await connection.query(
    `UPDATE \`users\`
     SET \`branchId\`=?,\`assignedRegion\`=?,
         \`physicalAddress\`=COALESCE(NULLIF(\`physicalAddress\`,''),'Dodoma, Tanzania'),
         \`updatedAt\`=CURRENT_TIMESTAMP(3)
     WHERE \`companyId\`=?`,
    [branchId, REGION, companyId],
  );

  return { companyId, branchId };
}

async function upsertBatch(
  connection: PoolConnection,
  companyId: string,
  sourceFileName: string,
  sourceSheetName: string,
  checksum: string,
  totalRows: number,
): Promise<string> {
  const batchId = deterministicId("batch_", `${companyId}|${checksum}|EXCEL_AGENT_MASTER`);
  await connection.query(
    `INSERT INTO \`data_import_batches\`
      (\`id\`,\`companyId\`,\`sourceType\`,\`sourceFileName\`,\`sourceSheetName\`,
       \`sourceChecksum\`,\`status\`,\`totalRows\`,\`importedRows\`,\`skippedRows\`,
       \`failedRows\`,\`notes\`,\`importedAt\`,\`createdAt\`,\`updatedAt\`)
     VALUES (?,?,'EXCEL_AGENT_MASTER',?,?,?,'PROCESSING',?,0,0,0,?,
             CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       \`sourceFileName\`=VALUES(\`sourceFileName\`),
       \`sourceSheetName\`=VALUES(\`sourceSheetName\`),
       \`status\`='PROCESSING',\`totalRows\`=VALUES(\`totalRows\`),
       \`importedRows\`=0,\`skippedRows\`=0,\`failedRows\`=0,
       \`notes\`=VALUES(\`notes\`),\`updatedAt\`=CURRENT_TIMESTAMP(3)`,
    [
      batchId,
      companyId,
      sourceFileName,
      sourceSheetName,
      checksum,
      totalRows,
      "Importing all agents into Dodoma Region under Dodoma Branch.",
    ],
  );
  return batchId;
}

async function importAgents(
  connection: PoolConnection,
  companyId: string,
  branchId: string,
  batchId: string,
  sheetName: string,
  agents: AgentRow[],
): Promise<void> {
  const brokerSql = `
    INSERT INTO \`broker_customers\`
    (\`id\`,\`companyId\`,\`branchId\`,\`code\`,\`name\`,\`officialAgentNo\`,\`phone\`,
     \`location\`,\`region\`,\`district\`,\`ward\`,\`address\`,\`city\`,\`country\`,
     \`nationality\`,\`status\`,\`notes\`,\`importBatchId\`,\`sourceRowNumber\`,
     \`sourceSheetName\`,\`sourceAgentName\`,\`sourceMsisdn\`,\`sourceAliasCode\`,
     \`normalizedName\`,\`isImported\`,\`importedAt\`,\`attendedLocation\`,
     \`createdAt\`,\`updatedAt\`)
    VALUES (?,?,?,?,?,?,?, ?,?,?,NULL,?,?,?,'Tanzania','ACTIVE',?,?,?,?,?,?,?,?,1,
            CURRENT_TIMESTAMP(3),?,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      \`branchId\`=VALUES(\`branchId\`),\`name\`=VALUES(\`name\`),
      \`officialAgentNo\`=VALUES(\`officialAgentNo\`),\`phone\`=VALUES(\`phone\`),
      \`location\`=VALUES(\`location\`),\`region\`=VALUES(\`region\`),
      \`district\`=VALUES(\`district\`),\`ward\`=NULL,
      \`address\`=VALUES(\`address\`),\`city\`=VALUES(\`city\`),
      \`country\`='Tanzania',\`nationality\`='Tanzania',\`status\`='ACTIVE',
      \`notes\`=VALUES(\`notes\`),\`importBatchId\`=VALUES(\`importBatchId\`),
      \`sourceRowNumber\`=VALUES(\`sourceRowNumber\`),
      \`sourceSheetName\`=VALUES(\`sourceSheetName\`),
      \`sourceAgentName\`=VALUES(\`sourceAgentName\`),
      \`sourceMsisdn\`=VALUES(\`sourceMsisdn\`),
      \`sourceAliasCode\`=VALUES(\`sourceAliasCode\`),
      \`normalizedName\`=VALUES(\`normalizedName\`),\`isImported\`=1,
      \`importedAt\`=CURRENT_TIMESTAMP(3),\`attendedLocation\`=VALUES(\`attendedLocation\`),
      \`updatedAt\`=CURRENT_TIMESTAMP(3)`;

  const accountSql = `
    INSERT INTO \`broker_agent_accounts\`
    (\`id\`,\`companyId\`,\`brokerCustomerId\`,\`network\`,\`simPhoneNumber\`,
     \`agentNumber\`,\`accountName\`,\`isPrimary\`,\`status\`,\`createdAt\`,\`updatedAt\`)
    VALUES (?, ?, (SELECT \`id\` FROM \`broker_customers\`
                   WHERE \`companyId\`=? AND \`code\`=? LIMIT 1),
            ?,?,?,?,1,'ACTIVE',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      \`brokerCustomerId\`=VALUES(\`brokerCustomerId\`),
      \`simPhoneNumber\`=VALUES(\`simPhoneNumber\`),
      \`accountName\`=VALUES(\`accountName\`),\`isPrimary\`=1,
      \`status\`='ACTIVE',\`updatedAt\`=CURRENT_TIMESTAMP(3)`;

  const notes = "Imported from float data_063712.xlsx. Registered in Dodoma Region under Dodoma Branch.";

  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    await connection.query(brokerSql, [
      agent.brokerId, companyId, branchId, agent.code, agent.name,
      agent.aliasCode, agent.msisdn, LOCATION, REGION, DISTRICT,
      ADDRESS, REGION, "Tanzania", notes, batchId, agent.sourceRowNumber,
      sheetName, agent.sourceName, agent.msisdn, agent.aliasCode,
      agent.normalizedName, LOCATION,
    ]);

    await connection.query(accountSql, [
      agent.accountId, companyId, companyId, agent.code, NETWORK,
      agent.msisdn, agent.aliasCode, agent.name,
    ]);

    if ((index + 1) % 250 === 0 || index + 1 === agents.length) {
      console.log(`Imported ${index + 1}/${agents.length} Dodoma agents`);
    }
  }
}

async function main(): Promise<void> {
  const workbookPath = path.resolve(process.argv[2] || "float data_063712.xlsx");
  const { checksum, sheetName, rows } = loadAgents(workbookPath);
  console.log(`Validated ${rows.length} rows from ${sheetName}.`);

  const pool = mariadb.createPool({
    host: process.env.DATABASE_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER?.trim() || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME?.trim() || "simamia",
    connectionLimit: 2,
    bigIntAsNumber: true,
  });

  let connection: PoolConnection | undefined;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { companyId, branchId } = await ensureCompanyAndBranch(connection);
    const batchId = await upsertBatch(
      connection, companyId, path.basename(workbookPath), sheetName, checksum, rows.length,
    );
    await importAgents(connection, companyId, branchId, batchId, sheetName, rows);

    await connection.query(
      `UPDATE \`data_import_batches\`
       SET \`status\`='COMPLETED',\`totalRows\`=?,\`importedRows\`=?,
           \`skippedRows\`=0,\`failedRows\`=0,
           \`notes\`=?,\`importedAt\`=CURRENT_TIMESTAMP(3),
           \`updatedAt\`=CURRENT_TIMESTAMP(3)
       WHERE \`id\`=?`,
      [rows.length, rows.length,
       `Imported all ${rows.length} agents into Dodoma Region under Dodoma Branch.`, batchId],
    );

    await connection.commit();
    console.log({ companyCode: COMPANY_CODE, companyId, branchId, batchId, imported: rows.length });
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    connection?.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
