import "dotenv/config";

import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

import { prisma } from "../lib/prisma";

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: unknown): string {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return `255${digits.slice(1)}`;
  return digits.length === 9 ? `255${digits}` : digits;
}

function normalizeAlias(value: unknown, rowNumber: number): string {
  const alias = clean(value).replace(/[^A-Za-z0-9_-]/g, "");
  return alias || `IMPORT-${rowNumber}`;
}

function headerIndex(headers: string[], wanted: string): number {
  const index = headers.findIndex(
    (header) => clean(header).toLowerCase() === wanted.toLowerCase(),
  );
  if (index < 0) {
    throw new Error(`The Excel sheet is missing the ${wanted} column.`);
  }
  return index;
}

export async function importFloatAgents(
  companyCodeArg: string,
  fileArg: string,
): Promise<void> {
  const companyCode = clean(companyCodeArg).toUpperCase();
  const filePath = path.resolve(fileArg);
  const file = await readFile(filePath);
  const checksum = crypto.createHash("sha256").update(file).digest("hex");

  const company = await prisma.company.findUnique({
    where: { code: companyCode },
    select: { id: true, name: true, code: true },
  });
  if (!company) {
    throw new Error(`Company code ${companyCode} was not found.`);
  }

  const workbook = XLSX.read(file, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The Excel workbook does not contain a sheet.");

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const headerRowIndex = raw.findIndex((row) => {
    const values = Array.isArray(row) ? row.map(clean) : [];
    return values.some((value) => value.toLowerCase() === "agent_name");
  });
  if (headerRowIndex < 0) {
    throw new Error("Could not find the Agent_name header row in the Excel file.");
  }

  const headers = (raw[headerRowIndex] as unknown[]).map(clean);
  const nameIndex = headerIndex(headers, "Agent_name");
  const phoneIndex = headerIndex(headers, "Agent_MSISDN");
  const aliasIndex = headerIndex(headers, "Alias_code");

  const sourceRows = raw.slice(headerRowIndex + 1);
  const rows = sourceRows
    .map((row, index) => {
      const values = Array.isArray(row) ? row : [];
      const sourceRowNumber = headerRowIndex + index + 2;
      return {
        sourceRowNumber,
        name: clean(values[nameIndex]),
        phone: normalizePhone(values[phoneIndex]),
        alias: normalizeAlias(values[aliasIndex], sourceRowNumber),
      };
    })
    .filter((row) => row.name || row.phone || row.alias);

  const batch = await prisma.dataImportBatch.upsert({
    where: {
      companyId_sourceChecksum: {
        companyId: company.id,
        sourceChecksum: checksum,
      },
    },
    update: {
      sourceFileName: path.basename(filePath),
      sourceSheetName: sheetName,
      status: "PROCESSING",
      totalRows: rows.length,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      notes: "Re-import started.",
      importedAt: new Date(),
    },
    create: {
      companyId: company.id,
      sourceType: "EXCEL_AGENT_MASTER",
      sourceFileName: path.basename(filePath),
      sourceSheetName: sheetName,
      sourceChecksum: checksum,
      status: "PROCESSING",
      totalRows: rows.length,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      notes: "Excel agent import started.",
    },
  });

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.name || !row.phone || !row.alias) {
      skipped += 1;
      continue;
    }

    try {
      const broker = await prisma.brokerCustomer.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: row.alias,
          },
        },
        update: {
          name: row.name,
          phone: row.phone,
          sourceAgentName: row.name,
          sourceMsisdn: row.phone,
          sourceAliasCode: row.alias,
          sourceRowNumber: row.sourceRowNumber,
          sourceSheetName: sheetName,
          normalizedName: normalizeName(row.name),
          importBatchId: batch.id,
          isImported: true,
          importedAt: new Date(),
          notes:
            "Imported from the Excel agent master. Confirm network, physical location, identity and profile photo before field assignment.",
        },
        create: {
          companyId: company.id,
          code: row.alias,
          name: row.name,
          businessName: null,
          phone: row.phone,
          alternatePhone: null,
          email: null,
          location: "IMPORTED - LOCATION REQUIRED",
          region: null,
          district: null,
          ward: null,
          address: null,
          status: "ACTIVE",
          sourceAgentName: row.name,
          sourceMsisdn: row.phone,
          sourceAliasCode: row.alias,
          sourceRowNumber: row.sourceRowNumber,
          sourceSheetName: sheetName,
          normalizedName: normalizeName(row.name),
          importBatchId: batch.id,
          isImported: true,
          importedAt: new Date(),
          notes:
            "Imported from the Excel agent master. Confirm network, physical location, identity and profile photo before field assignment.",
        },
      });

      await prisma.brokerAgentAccount.upsert({
        where: {
          companyId_network_agentNumber: {
            companyId: company.id,
            network: "OTHER",
            agentNumber: row.alias,
          },
        },
        update: {
          brokerCustomerId: broker.id,
          simPhoneNumber: row.phone,
          accountName: row.name,
          status: "ACTIVE",
        },
        create: {
          companyId: company.id,
          brokerCustomerId: broker.id,
          network: "OTHER",
          simPhoneNumber: row.phone,
          agentNumber: row.alias,
          accountName: row.name,
          isPrimary: true,
          status: "ACTIVE",
        },
      });

      imported += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed Excel row ${row.sourceRowNumber}:`, error);
    }
  }

  await prisma.dataImportBatch.update({
    where: { id: batch.id },
    data: {
      status: failed > 0 ? (imported > 0 ? "PARTIAL" : "FAILED") : "COMPLETED",
      importedRows: imported,
      skippedRows: skipped,
      failedRows: failed,
      notes:
        `Imported ${imported} agents, skipped ${skipped}, failed ${failed}. ` +
        "The source file does not contain a mobile-network column, so imported agent accounts are marked OTHER until reviewed.",
    },
  });

  console.log({
    company: company.name,
    companyCode: company.code,
    sourceFile: path.basename(filePath),
    sheetName,
    totalRows: rows.length,
    imported,
    skipped,
    failed,
  });
}

async function main() {
  const [, , companyCode, fileArg] = process.argv;
  if (!companyCode || !fileArg) {
    throw new Error(
      "Usage: npx tsx scripts/import-float-agents.ts COMPANY_CODE path/to/float-agents.xlsx",
    );
  }
  await importFloatAgents(companyCode, fileArg);
}

if (process.argv[1]?.endsWith("import-float-agents.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
