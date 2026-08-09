import "dotenv/config";

import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { seedPrisma as prisma } from "./seed-client";

type BankTransactionRow = {
  reference?: string;
  postingDate?: string;
  valueDate?: string;
  details?: string;
  direction?: "CREDIT" | "DEBIT";
  debit?: number;
  credit?: number;
  bookBalance?: number;
  transactionType?: string | null;
  senderName?: string | null;
  receiverName?: string | null;
  externalAccountReference?: string | null;
  narration?: string | null;
};

type BankStatementFile = {
  schemaVersion?: number;
  sourceType?: string;
  sourceFileName?: string;
  sourceChecksum?: string;
  bankName?: string;
  accountName?: string;
  branchName?: string | null;
  accountNumber?: string;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  generatedAt?: string | null;
  availableBalance?: number;
  totalCredit?: number;
  totalDebit?: number;
  bookBalance?: number;
  clearedBalance?: number;
  transactions?: BankTransactionRow[];
};

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: unknown): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function requiredDate(
  value: unknown,
  fieldName: string,
): Date {
  const parsed =
    new Date(String(value ?? ""));

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `${fieldName} is missing or invalid.`,
    );
  }

  return parsed;
}

function optionalDate(
  value: unknown,
): Date | null {
  if (!value) return null;

  const parsed =
    new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function checksum(
  bytes: Buffer,
  supplied: unknown,
): string {
  const cleaned =
    cleanText(supplied);

  if (/^[a-f0-9]{64}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  return crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function dateKey(value: Date): string {
  return value
    .toISOString()
    .slice(0, 10);
}

function bestBrokerMatch(
  normalizedSender: string,
  brokers: Array<{
    id: string;
    name: string;
    normalizedName: string | null;
  }>,
) {
  if (!normalizedSender) {
    return null;
  }

  const exact =
    brokers.find((broker) => {
      const candidate =
        normalizeName(
          broker.normalizedName ||
            broker.name,
        );

      return candidate ===
        normalizedSender;
    });

  if (exact) return exact;

  return (
    brokers.find((broker) => {
      const candidate =
        normalizeName(
          broker.normalizedName ||
            broker.name,
        );

      return (
        candidate.length >= 8 &&
        normalizedSender.length >= 8 &&
        (
          candidate.includes(
            normalizedSender,
          ) ||
          normalizedSender.includes(
            candidate,
          )
        )
      );
    }) ?? null
  );
}

export async function importBankStatementJson(
  companyCodeArgument: string,
  fileArgument: string,
) {
  const companyCode =
    cleanText(
      companyCodeArgument,
    ).toUpperCase() ||
    "SIMAMIA";

  const filePath =
    path.resolve(fileArgument);

  const bytes =
    await readFile(filePath);

  const input =
    JSON.parse(
      bytes.toString("utf8"),
    ) as BankStatementFile;

  const transactions =
    Array.isArray(
      input.transactions,
    )
      ? input.transactions
      : [];

  if (
    !input.accountNumber ||
    !input.accountName ||
    transactions.length === 0
  ) {
    throw new Error(
      `${path.basename(filePath)} is not a valid bank-statement JSON file.`,
    );
  }

  const company =
    await prisma.company.findUnique({
      where: {
        code: companyCode,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

  if (!company) {
    throw new Error(
      `Company code ${companyCode} was not found. Run the core seed first.`,
    );
  }

  const periodStart =
    requiredDate(
      input.periodStart,
      "periodStart",
    );

  const periodEnd =
    requiredDate(
      input.periodEnd,
      "periodEnd",
    );

  const sourceChecksum =
    checksum(
      bytes,
      input.sourceChecksum,
    );

  const sourceFileName =
    cleanText(
      input.sourceFileName,
    ) ||
    path.basename(filePath);

  const batch =
    await prisma.dataImportBatch.upsert({
      where: {
        companyId_sourceChecksum: {
          companyId:
            company.id,
          sourceChecksum,
        },
      },
      update: {
        sourceFileName,
        status: "PROCESSING",
        totalRows:
          transactions.length,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        notes:
          "Bank-statement JSON re-import started.",
        importedAt:
          new Date(),
      },
      create: {
        companyId:
          company.id,
        sourceType:
          "BANK_STATEMENT_PDF",
        sourceFileName,
        sourceChecksum,
        status: "PROCESSING",
        totalRows:
          transactions.length,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        notes:
          "Bank-statement JSON import started.",
      },
    });

  const statementKey =
    `${cleanText(input.accountNumber)}:${dateKey(periodStart)}:${dateKey(periodEnd)}`;

  const statement =
    await prisma.importedBankStatement.upsert({
      where: {
        companyId_statementKey: {
          companyId:
            company.id,
          statementKey,
        },
      },
      update: {
        importBatchId:
          batch.id,
        bankName:
          cleanText(input.bankName) ||
          "UNKNOWN BANK",
        accountName:
          cleanText(input.accountName),
        branchName:
          cleanText(input.branchName) ||
          null,
        accountNumber:
          cleanText(input.accountNumber),
        currency:
          cleanText(input.currency) ||
          "TZS",
        periodStart,
        periodEnd,
        generatedAt:
          optionalDate(
            input.generatedAt,
          ),
        availableBalance:
          numberValue(
            input.availableBalance,
          ),
        totalCredit:
          numberValue(
            input.totalCredit,
          ),
        totalDebit:
          numberValue(
            input.totalDebit,
          ),
        bookBalance:
          numberValue(
            input.bookBalance,
          ),
        clearedBalance:
          numberValue(
            input.clearedBalance,
          ),
        sourceFileName,
        sourceChecksum,
        importedAt:
          new Date(),
      },
      create: {
        companyId:
          company.id,
        importBatchId:
          batch.id,
        statementKey,
        bankName:
          cleanText(input.bankName) ||
          "UNKNOWN BANK",
        accountName:
          cleanText(input.accountName),
        branchName:
          cleanText(input.branchName) ||
          null,
        accountNumber:
          cleanText(input.accountNumber),
        currency:
          cleanText(input.currency) ||
          "TZS",
        periodStart,
        periodEnd,
        generatedAt:
          optionalDate(
            input.generatedAt,
          ),
        availableBalance:
          numberValue(
            input.availableBalance,
          ),
        totalCredit:
          numberValue(
            input.totalCredit,
          ),
        totalDebit:
          numberValue(
            input.totalDebit,
          ),
        bookBalance:
          numberValue(
            input.bookBalance,
          ),
        clearedBalance:
          numberValue(
            input.clearedBalance,
          ),
        sourceFileName,
        sourceChecksum,
      },
    });

  const brokers =
    await prisma.brokerCustomer.findMany({
      where: {
        companyId:
          company.id,
      },
      select: {
        id: true,
        name: true,
        normalizedName:
          true,
      },
    });

  let imported = 0;
  let failed = 0;
  let matched = 0;

  for (const row of transactions) {
    const reference =
      cleanText(row.reference);

    if (!reference) {
      failed += 1;
      continue;
    }

    try {
      const postingDate =
        requiredDate(
          row.postingDate,
          `postingDate for ${reference}`,
        );

      const valueDate =
        requiredDate(
          row.valueDate ||
            row.postingDate,
          `valueDate for ${reference}`,
        );

      const debit =
        numberValue(row.debit);

      const credit =
        numberValue(row.credit);

      const direction =
        row.direction === "CREDIT" ||
        credit > 0
          ? "CREDIT"
          : "DEBIT";

      const broker =
        bestBrokerMatch(
          normalizeName(
            row.senderName,
          ),
          brokers,
        );

      if (broker) {
        matched += 1;
      }

      await prisma.importedBankTransaction.upsert({
        where: {
          companyId_reference: {
            companyId:
              company.id,
            reference,
          },
        },
        update: {
          statementId:
            statement.id,
          matchedBrokerCustomerId:
            broker?.id || null,
          postingDate,
          valueDate,
          details:
            cleanText(row.details) ||
            reference,
          direction,
          debit,
          credit,
          bookBalance:
            numberValue(
              row.bookBalance,
            ),
          transactionType:
            cleanText(
              row.transactionType,
            ) || null,
          senderName:
            cleanText(
              row.senderName,
            ) || null,
          receiverName:
            cleanText(
              row.receiverName,
            ) || null,
          externalAccountReference:
            cleanText(
              row.externalAccountReference,
            ) || null,
          narration:
            cleanText(
              row.narration ||
                row.details,
            ) || null,
          matchStatus:
            broker
              ? "MATCHED"
              : direction === "DEBIT"
                ? "NOT_APPLICABLE"
                : "REVIEW_REQUIRED",
          matchConfidence:
            broker ? 100 : null,
          matchNote:
            broker
              ? `Matched sender name to ${broker.name}.`
              : direction === "DEBIT"
                ? "Debit transaction does not require a broker sender match."
                : "No exact imported broker-name match was found.",
        },
        create: {
          companyId:
            company.id,
          statementId:
            statement.id,
          matchedBrokerCustomerId:
            broker?.id || null,
          reference,
          postingDate,
          valueDate,
          details:
            cleanText(row.details) ||
            reference,
          direction,
          debit,
          credit,
          bookBalance:
            numberValue(
              row.bookBalance,
            ),
          transactionType:
            cleanText(
              row.transactionType,
            ) || null,
          senderName:
            cleanText(
              row.senderName,
            ) || null,
          receiverName:
            cleanText(
              row.receiverName,
            ) || null,
          externalAccountReference:
            cleanText(
              row.externalAccountReference,
            ) || null,
          narration:
            cleanText(
              row.narration ||
                row.details,
            ) || null,
          matchStatus:
            broker
              ? "MATCHED"
              : direction === "DEBIT"
                ? "NOT_APPLICABLE"
                : "REVIEW_REQUIRED",
          matchConfidence:
            broker ? 100 : null,
          matchNote:
            broker
              ? `Matched sender name to ${broker.name}.`
              : direction === "DEBIT"
                ? "Debit transaction does not require a broker sender match."
                : "No exact imported broker-name match was found.",
        },
      });

      imported += 1;
    } catch (error) {
      failed += 1;

      console.error(
        `Failed bank transaction ${reference}:`,
        error,
      );
    }
  }

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
      skippedRows: 0,
      failedRows:
        failed,
      notes:
        `Imported ${imported} bank transactions, failed ${failed}, matched ${matched} to registered brokers.`,
      importedAt:
        new Date(),
    },
  });

  const summary = {
    companyCode:
      company.code,
    sourceFile:
      sourceFileName,
    accountNumber:
      statement.accountNumber,
    transactions:
      transactions.length,
    imported,
    failed,
    matched,
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

  if (!fileArg) {
    throw new Error(
      "Usage: npx tsx prisma/import-bank-statement-json.ts COMPANY_CODE prisma/data/bank-statement-file.json",
    );
  }

  await importBankStatementJson(
    companyCode,
    fileArg,
  );
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith(
      "/import-bank-statement-json.ts",
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
