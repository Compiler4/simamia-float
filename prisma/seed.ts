import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

type AgentSeedRow = {
  sourceRow: number;
  sourceAgentName: string;
  sourceMsisdn: string;
  sourceAliasCode: string;
  name: string;
  msisdn: string;
  aliasCode: string;
};

type StatementTransactionSeed = {
  postingDate: string;
  valueDate: string;
  reference: string;
  transactionType: string;
  senderName: string | null;
  details: string;
  externalAccountReference: string | null;
  narration: string | null;
  debit: number;
  credit: number;
  bookBalance: number;
};

type BankStatementSeed = {
  statement: {
    bankName: string;
    accountName: string;
    branchName: string;
    accountNumber: string;
    currency: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
    availableBalance: number;
    totalCredit: number;
    totalDebit: number;
    bookBalance: number;
    clearedBalance: number;
    sourceFileName: string;
  };
  transactions: StatementTransactionSeed[];
};

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Missing environment variable ${name}.`);
  }

  return value.trim();
}

function positiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  const parsed = value?.trim() ? Number(value) : fallback;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function databaseConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    const url = new URL(databaseUrl);

    return {
      host: required("DATABASE_HOST", url.hostname),
      port: positiveInteger("DATABASE_PORT", url.port, 3306),
      user: required("DATABASE_USER", decodeURIComponent(url.username)),
      password: decodeURIComponent(url.password),
      database: required(
        "DATABASE_NAME",
        decodeURIComponent(url.pathname.replace(/^\/+/, "")),
      ),
      connectionLimit: 5,
    };
  }

  return {
    host: required("DATABASE_HOST", process.env.DATABASE_HOST),
    port: positiveInteger("DATABASE_PORT", process.env.DATABASE_PORT, 3306),
    user: required("DATABASE_USER", process.env.DATABASE_USER),
    password: process.env.DATABASE_PASSWORD ?? "",
    database: required("DATABASE_NAME", process.env.DATABASE_NAME),
    connectionLimit: 5,
  };
}

const db = new PrismaClient({
  adapter: new PrismaMariaDb(databaseConfig()),
  log: ["warn", "error"],
});

function loadJson<T>(fileName: string): T {
  const path = join(process.cwd(), "prisma", "data", fileName);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function normaliseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function initialsCompatible(shortToken: string, longToken: string): boolean {
  return shortToken.length === 1 && longToken.startsWith(shortToken);
}

function nameMatchScore(source: string, candidate: string): number {
  const left = normaliseName(source);
  const right = normaliseName(candidate);

  if (!left || !right) return 0;
  if (left === right) return 100;

  const a = left.split(" ");
  const b = right.split(" ");
  const firstMatches = a[0] === b[0];
  const lastMatches = a.at(-1) === b.at(-1);

  if (firstMatches && lastMatches) {
    const middleA = a.slice(1, -1);
    const middleB = b.slice(1, -1);

    if (!middleA.length || !middleB.length) return 90;

    const compatible = middleA.some((tokenA) =>
      middleB.some(
        (tokenB) =>
          tokenA === tokenB ||
          initialsCompatible(tokenA, tokenB) ||
          initialsCompatible(tokenB, tokenA),
      ),
    );

    return compatible ? 94 : 84;
  }

  const setA = new Set(a);
  const setB = new Set(b);
  const common = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union ? common / union : 0;

  return Math.round(jaccard * 75);
}

function matchAgent(
  senderName: string | null,
  agents: Array<{ id: string; name: string; normalizedName: string | null }>,
) {
  if (!senderName) {
    return {
      matchedBrokerCustomerId: null,
      matchStatus: "NOT_APPLICABLE",
      matchConfidence: null,
      matchNote: "Debit transaction without an identifiable agent sender.",
    } as const;
  }

  const ranked = agents
    .map((agent) => ({
      agent,
      score: nameMatchScore(senderName, agent.normalizedName || agent.name),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score < 70) {
    return {
      matchedBrokerCustomerId: null,
      matchStatus: "UNMATCHED",
      matchConfidence: best?.score ?? 0,
      matchNote: best
        ? `Best candidate was ${best.agent.name}, but confidence was below the review threshold.`
        : "No imported agent candidate was found.",
    } as const;
  }

  const margin = best.score - (second?.score ?? 0);

  if (best.score >= 90 && margin >= 8) {
    return {
      matchedBrokerCustomerId: best.agent.id,
      matchStatus: "MATCHED",
      matchConfidence: best.score,
      matchNote: `Automatically matched ${senderName} to ${best.agent.name}.`,
    } as const;
  }

  return {
    matchedBrokerCustomerId: best.agent.id,
    matchStatus: "REVIEW_REQUIRED",
    matchConfidence: best.score,
    matchNote: `Possible match: ${best.agent.name}. Manual review is required.`,
  } as const;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const output: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }

  return output;
}

async function main() {
  const agents = loadJson<AgentSeedRow[]>("float-agents.json");
  const bankData = loadJson<BankStatementSeed>(
    "bank-statement-2026-07-16-to-17.json",
  );

  const company = await db.company.upsert({
    where: { code: "ARDHISOL" },
    update: {
      name: "ARDHISOL (T) LIMITED",
      status: "ACTIVE",
    },
    create: {
      name: "ARDHISOL (T) LIMITED",
      code: "ARDHISOL",
      status: "ACTIVE",
      address: "Tanzania",
    },
  });

  await db.branch.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "OHIO",
      },
    },
    update: {
      name: "OHIO",
      status: "ACTIVE",
    },
    create: {
      companyId: company.id,
      code: "OHIO",
      name: "OHIO",
      status: "ACTIVE",
    },
  });

  const agentChecksum =
    "46e660bc3bc9cbcc210a21fe6f619dbbf5660417ff143499101d8e864a0bf629";

  const agentBatch = await db.dataImportBatch.upsert({
    where: {
      companyId_sourceChecksum: {
        companyId: company.id,
        sourceChecksum: agentChecksum,
      },
    },
    update: {
      status: "PROCESSING",
      totalRows: agents.length,
      sourceFileName: "float data_063712.xlsx",
      sourceSheetName: "Sheet1",
    },
    create: {
      companyId: company.id,
      sourceType: "EXCEL_AGENT_MASTER",
      sourceFileName: "float data_063712.xlsx",
      sourceSheetName: "Sheet1",
      sourceChecksum: agentChecksum,
      status: "PROCESSING",
      totalRows: agents.length,
      notes:
        "Imported from the workbook containing Agent_name, Agent_MSISDN and Alias_code.",
    },
  });

  let importedAgents = 0;

  for (const batch of chunks(agents, 100)) {
    await db.$transaction(
      batch.map((agent) =>
        db.brokerCustomer.upsert({
          where: {
            companyId_code: {
              companyId: company.id,
              code: agent.aliasCode,
            },
          },
          update: {
            name: agent.name,
            phone: agent.msisdn,
            normalizedName: normaliseName(agent.name),
            sourceRowNumber: agent.sourceRow,
            sourceSheetName: "Sheet1",
            sourceAgentName: agent.sourceAgentName,
            sourceMsisdn: agent.sourceMsisdn,
            sourceAliasCode: agent.sourceAliasCode,
            importBatchId: agentBatch.id,
            isImported: true,
            importedAt: new Date(),
            status: "ACTIVE",
          },
          create: {
            companyId: company.id,
            code: agent.aliasCode,
            name: agent.name,
            phone: agent.msisdn,
            location: "UNASSIGNED",
            normalizedName: normaliseName(agent.name),
            sourceRowNumber: agent.sourceRow,
            sourceSheetName: "Sheet1",
            sourceAgentName: agent.sourceAgentName,
            sourceMsisdn: agent.sourceMsisdn,
            sourceAliasCode: agent.sourceAliasCode,
            importBatchId: agentBatch.id,
            isImported: true,
            importedAt: new Date(),
            status: "ACTIVE",
            notes: "Imported from float data_063712.xlsx.",
          },
        }),
      ),
    );

    importedAgents += batch.length;
    console.log(`Imported ${importedAgents}/${agents.length} agent rows.`);
  }

  await db.dataImportBatch.update({
    where: { id: agentBatch.id },
    data: {
      status: "COMPLETED",
      importedRows: importedAgents,
      skippedRows: 0,
      failedRows: 0,
    },
  });

  const statementChecksum =
    "956d62f57fd2f10fe183199386b169c63067a6940ae0fa3d5b4c0cc47f0a1d5e";

  const statementBatch = await db.dataImportBatch.upsert({
    where: {
      companyId_sourceChecksum: {
        companyId: company.id,
        sourceChecksum: statementChecksum,
      },
    },
    update: {
      status: "PROCESSING",
      totalRows: bankData.transactions.length,
      sourceFileName: bankData.statement.sourceFileName,
    },
    create: {
      companyId: company.id,
      sourceType: "BANK_STATEMENT_PDF",
      sourceFileName: bankData.statement.sourceFileName,
      sourceChecksum: statementChecksum,
      status: "PROCESSING",
      totalRows: bankData.transactions.length,
      notes:
        "CRDB account statement imported for 16/07/2026 through 17/07/2026.",
    },
  });

  const statementKey = `${bankData.statement.accountNumber}:2026-07-16:2026-07-17`;

  const statement = await db.importedBankStatement.upsert({
    where: {
      companyId_statementKey: {
        companyId: company.id,
        statementKey,
      },
    },
    update: {
      importBatchId: statementBatch.id,
      availableBalance: bankData.statement.availableBalance,
      totalCredit: bankData.statement.totalCredit,
      totalDebit: bankData.statement.totalDebit,
      bookBalance: bankData.statement.bookBalance,
      clearedBalance: bankData.statement.clearedBalance,
      generatedAt: new Date(bankData.statement.generatedAt),
    },
    create: {
      companyId: company.id,
      importBatchId: statementBatch.id,
      statementKey,
      bankName: bankData.statement.bankName,
      accountName: bankData.statement.accountName,
      branchName: bankData.statement.branchName,
      accountNumber: bankData.statement.accountNumber,
      currency: bankData.statement.currency,
      periodStart: new Date(bankData.statement.periodStart),
      periodEnd: new Date(bankData.statement.periodEnd),
      generatedAt: new Date(bankData.statement.generatedAt),
      availableBalance: bankData.statement.availableBalance,
      totalCredit: bankData.statement.totalCredit,
      totalDebit: bankData.statement.totalDebit,
      bookBalance: bankData.statement.bookBalance,
      clearedBalance: bankData.statement.clearedBalance,
      sourceFileName: bankData.statement.sourceFileName,
      sourceChecksum: statementChecksum,
    },
  });

  const importedAgentRows = await db.brokerCustomer.findMany({
    where: {
      companyId: company.id,
      isImported: true,
    },
    select: {
      id: true,
      name: true,
      normalizedName: true,
    },
  });

  for (const transaction of bankData.transactions) {
    const match = matchAgent(transaction.senderName, importedAgentRows);
    const direction = transaction.debit > 0 ? "DEBIT" : "CREDIT";

    await db.importedBankTransaction.upsert({
      where: {
        companyId_reference: {
          companyId: company.id,
          reference: transaction.reference,
        },
      },
      update: {
        statementId: statement.id,
        matchedBrokerCustomerId: match.matchedBrokerCustomerId,
        matchStatus: match.matchStatus,
        matchConfidence: match.matchConfidence,
        matchNote: match.matchNote,
        details: transaction.details,
        debit: transaction.debit,
        credit: transaction.credit,
        bookBalance: transaction.bookBalance,
      },
      create: {
        companyId: company.id,
        statementId: statement.id,
        matchedBrokerCustomerId: match.matchedBrokerCustomerId,
        reference: transaction.reference,
        postingDate: new Date(transaction.postingDate),
        valueDate: new Date(transaction.valueDate),
        details: transaction.details,
        direction,
        debit: transaction.debit,
        credit: transaction.credit,
        bookBalance: transaction.bookBalance,
        transactionType: transaction.transactionType,
        senderName: transaction.senderName,
        receiverName: "ARDHISOL (T) LIMITED",
        externalAccountReference: transaction.externalAccountReference,
        narration: transaction.narration,
        matchStatus: match.matchStatus,
        matchConfidence: match.matchConfidence,
        matchNote: match.matchNote,
      },
    });
  }

  await db.dataImportBatch.update({
    where: { id: statementBatch.id },
    data: {
      status: "COMPLETED",
      importedRows: bankData.transactions.length,
      skippedRows: 0,
      failedRows: 0,
    },
  });

  const [agentCount, transactionCount, matchedCount, reviewCount] =
    await Promise.all([
      db.brokerCustomer.count({
        where: { companyId: company.id, isImported: true },
      }),
      db.importedBankTransaction.count({
        where: { companyId: company.id },
      }),
      db.importedBankTransaction.count({
        where: { companyId: company.id, matchStatus: "MATCHED" },
      }),
      db.importedBankTransaction.count({
        where: { companyId: company.id, matchStatus: "REVIEW_REQUIRED" },
      }),
    ]);

  console.log("\nImport completed successfully.");
  console.log({
    company: company.name,
    importedAgents: agentCount,
    bankTransactions: transactionCount,
    automaticallyMatched: matchedCount,
    reviewRequired: reviewCount,
    statementCredit: bankData.statement.totalCredit,
    statementDebit: bankData.statement.totalDebit,
  });
}

main()
  .catch((error) => {
    console.error("[IMPORTED_FINANCE_SEED]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
