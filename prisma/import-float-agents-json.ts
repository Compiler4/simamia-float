import "dotenv/config";

import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { seedPrisma as prisma } from "./seed-client";

type AgentRow = {
  rowNumber?: number;
  sourceRowNumber?: number;
  agentName?: string;
  name?: string;
  msisdn?: string;
  phone?: string;
  aliasCode?: string;
  alias?: string;
};

type AgentFile = {
  schemaVersion?: number;
  sourceType?: string;
  sourceFileName?: string;
  sourceSheetName?: string;
  sourceChecksum?: string;
  declaredUniqueAgents?: number;
  rows?: AgentRow[];
};

type ImportSummary = {
  companyCode: string;
  sourceFile: string;
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  fallbackNames: number;
};

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function digits(value: unknown): string {
  return cleanText(value).replace(/\D+/g, "");
}

function normalizePhone(value: unknown): string {
  const valueDigits = digits(value);

  if (!valueDigits) return "";
  if (valueDigits.startsWith("255")) {
    return valueDigits;
  }

  if (valueDigits.startsWith("0")) {
    return `255${valueDigits.slice(1)}`;
  }

  return valueDigits.length === 9
    ? `255${valueDigits}`
    : valueDigits;
}

function normalizeAlias(
  value: unknown,
  rowNumber: number,
): string {
  const alias = cleanText(value)
    .replace(/[^A-Za-z0-9_-]/g, "")
    .toUpperCase();

  return alias || `IMPORT-${rowNumber}`;
}

function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDate(value: unknown): Date {
  const parsed = new Date(String(value ?? ""));

  return Number.isNaN(parsed.getTime())
    ? new Date()
    : parsed;
}

function jsonChecksum(
  bytes: Buffer,
  supplied: unknown,
): string {
  const cleaned = cleanText(supplied);

  if (/^[a-f0-9]{64}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  return crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex");
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (
    item: T,
    index: number,
  ) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) {
        return;
      }

      await worker(items[index], index);
    }
  }

  const workerCount = Math.max(
    1,
    Math.min(concurrency, items.length || 1),
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => runWorker(),
    ),
  );
}

export async function importFloatAgentsJson(
  companyCodeArgument: string,
  fileArgument: string,
): Promise<ImportSummary> {
  const companyCode =
    cleanText(companyCodeArgument).toUpperCase() ||
    "SIMAMIA";

  const filePath =
    path.resolve(fileArgument);

  const fileBytes =
    await readFile(filePath);

  const parsed =
    JSON.parse(
      fileBytes.toString("utf8"),
    ) as AgentFile;

  const sourceRows =
    Array.isArray(parsed.rows)
      ? parsed.rows
      : [];

  if (sourceRows.length === 0) {
    throw new Error(
      `${path.basename(filePath)} does not contain any agent rows.`,
    );
  }

  const company =
    await prisma.company.findUnique({
      where: {
        code: companyCode,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

  if (!company) {
    throw new Error(
      `Company code ${companyCode} was not found. Run the core seed first.`,
    );
  }

  const brokerAgentDelegate =
    (prisma as any).brokerAgentAccount;

  if (
    !brokerAgentDelegate ||
    typeof brokerAgentDelegate.upsert !==
      "function"
  ) {
    throw new Error(
      "BrokerAgentAccount is missing from the generated Prisma Client. Run npx prisma db push and npx prisma generate.",
    );
  }

  const sourceChecksum =
    jsonChecksum(
      fileBytes,
      parsed.sourceChecksum,
    );

  const sourceFileName =
    cleanText(
      parsed.sourceFileName,
    ) ||
    path.basename(filePath);

  const sourceSheetName =
    cleanText(
      parsed.sourceSheetName,
    ) ||
    "Sheet1";

  const batch =
    await prisma.dataImportBatch.upsert({
      where: {
        companyId_sourceChecksum: {
          companyId: company.id,
          sourceChecksum,
        },
      },
      update: {
        sourceFileName,
        sourceSheetName,
        status: "PROCESSING",
        totalRows: sourceRows.length,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        notes:
          "Float-agent JSON re-import started.",
        importedAt: new Date(),
      },
      create: {
        companyId: company.id,
        sourceType:
          "EXCEL_AGENT_MASTER",
        sourceFileName,
        sourceSheetName,
        sourceChecksum,
        status: "PROCESSING",
        totalRows: sourceRows.length,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        notes:
          "Float-agent JSON import started.",
      },
    });

  const seenAliases =
    new Set<string>();

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let fallbackNames = 0;

  await runWithConcurrency(
    sourceRows,
    6,
    async (source, index) => {
      const sourceRowNumber =
        Number(
          source.sourceRowNumber ??
            source.rowNumber ??
            index + 4,
        ) || index + 4;

      const phone =
        normalizePhone(
          source.msisdn ??
            source.phone,
        );

      const alias =
        normalizeAlias(
          source.aliasCode ??
            source.alias,
          sourceRowNumber,
        );

      let name =
        cleanText(
          source.agentName ??
            source.name,
        );

      if (!name && alias) {
        name =
          `UNNAMED AGENT ${alias}`;
        fallbackNames += 1;
      }

      if (
        !phone ||
        !alias ||
        !name
      ) {
        skipped += 1;
        return;
      }

      if (seenAliases.has(alias)) {
        skipped += 1;
        console.warn(
          `Skipped duplicate alias ${alias} at source row ${sourceRowNumber}.`,
        );
        return;
      }

      seenAliases.add(alias);

      try {
        const broker =
          await prisma.brokerCustomer.upsert({
            where: {
              companyId_code: {
                companyId:
                  company.id,
                code: alias,
              },
            },
            update: {
              name,
              phone,
              sourceAgentName:
                name,
              sourceMsisdn:
                phone,
              sourceAliasCode:
                alias,
              sourceRowNumber,
              sourceSheetName,
              normalizedName:
                normalizeName(name),
              importBatchId:
                batch.id,
              isImported: true,
              importedAt:
                new Date(),
              notes:
                "Imported from the float-agent master. Network and physical service location must be reviewed before assignment.",
            },
            create: {
              companyId:
                company.id,
              code: alias,
              name,
              businessName:
                null,
              phone,
              alternatePhone:
                null,
              email: null,
              location:
                "IMPORTED - LOCATION REQUIRED",
              region: null,
              district: null,
              ward: null,
              address: null,
              status: "ACTIVE",
              sourceAgentName:
                name,
              sourceMsisdn:
                phone,
              sourceAliasCode:
                alias,
              sourceRowNumber,
              sourceSheetName,
              normalizedName:
                normalizeName(name),
              importBatchId:
                batch.id,
              isImported: true,
              importedAt:
                new Date(),
              notes:
                "Imported from the float-agent master. Network and physical service location must be reviewed before assignment.",
            },
            select: {
              id: true,
            },
          });

        await brokerAgentDelegate.upsert({
          where: {
            companyId_network_agentNumber: {
              companyId:
                company.id,
              network: "OTHER",
              agentNumber:
                alias,
            },
          },
          update: {
            brokerCustomerId:
              broker.id,
            simPhoneNumber:
              phone,
            accountName:
              name,
            status: "ACTIVE",
          },
          create: {
            companyId:
              company.id,
            brokerCustomerId:
              broker.id,
            network: "OTHER",
            simPhoneNumber:
              phone,
            agentNumber:
              alias,
            accountName:
              name,
            isPrimary: true,
            status: "ACTIVE",
          },
        });

        imported += 1;
      } catch (error) {
        failed += 1;

        console.error(
          `Failed float-agent source row ${sourceRowNumber}:`,
          error,
        );
      }
    },
  );

  await prisma.dataImportBatch.update({
    where: {
      id: batch.id,
    },
    data: {
      status:
        failed > 0
          ? imported > 0
            ? "PARTIAL"
            : "FAILED"
          : "COMPLETED",
      importedRows:
        imported,
      skippedRows:
        skipped,
      failedRows:
        failed,
      notes:
        `Imported ${imported}, skipped ${skipped}, failed ${failed}, fallback names ${fallbackNames}. ` +
        "The source workbook has no mobile-network column, so every imported line is stored as OTHER until reviewed.",
      importedAt:
        safeDate(
          new Date(),
        ),
    },
  });

  const summary = {
    companyCode:
      company.code,
    sourceFile:
      sourceFileName,
    totalRows:
      sourceRows.length,
    imported,
    skipped,
    failed,
    fallbackNames,
  };

  console.table(summary);

  return summary;
}

async function main() {
  const [
    ,
    ,
    companyCodeArg,
    fileArg,
  ] = process.argv;

  const companyCode =
    companyCodeArg ||
    process.env.SEED_COMPANY_CODE ||
    "SIMAMIA";

  const filePath =
    fileArg ||
    path.join(
      process.cwd(),
      "prisma",
      "data",
      "float-agents.json",
    );

  await importFloatAgentsJson(
    companyCode,
    filePath,
  );
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith(
      "/import-float-agents-json.ts",
    )
) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
