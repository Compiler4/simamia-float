import "dotenv/config";

import path from "node:path";
import {
  readFile,
} from "node:fs/promises";

import {
  seedPrisma as prisma,
} from "./seed-client";

type Manifest = {
  excel?: {
    parsedRows?: number;
  };
  bankStatement?: {
    transactions?: number;
  };
};

async function main() {
  const companyCode =
    String(
      process.argv[2] ||
        process.env.SEED_COMPANY_CODE ||
        "SIMAMIA",
    )
      .trim()
      .toUpperCase();

  const manifestPath =
    path.resolve(
      process.cwd(),
      "prisma",
      "data",
      "import-manifest.json",
    );

  const manifest =
    JSON.parse(
      await readFile(
        manifestPath,
        "utf8",
      ),
    ) as Manifest;

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
      `Company ${companyCode} was not found.`,
    );
  }

  const [
    importedBrokers,
    agentAccounts,
    importBatches,
    statements,
    bankTransactions,
  ] = await Promise.all([
    prisma.brokerCustomer.count({
      where: {
        companyId:
          company.id,
        isImported: true,
      },
    }),
    (prisma as any).brokerAgentAccount.count({
      where: {
        companyId:
          company.id,
      },
    }),
    prisma.dataImportBatch.count({
      where: {
        companyId:
          company.id,
      },
    }),
    prisma.importedBankStatement.count({
      where: {
        companyId:
          company.id,
      },
    }),
    prisma.importedBankTransaction.count({
      where: {
        companyId:
          company.id,
      },
    }),
  ]);

  const expectedBrokers =
    Number(
      manifest.excel?.parsedRows ??
        0,
    );

  const expectedBankTransactions =
    Number(
      manifest.bankStatement
        ?.transactions ?? 0,
    );

  const result = {
    company:
      company.name,
    companyCode:
      company.code,
    importedBrokers,
    expectedBrokers,
    agentAccounts,
    importBatches,
    statements,
    bankTransactions,
    expectedBankTransactions,
  };

  console.table(result);

  const problems: string[] = [];

  if (
    importedBrokers <
    expectedBrokers
  ) {
    problems.push(
      `Expected at least ${expectedBrokers} imported brokers but found ${importedBrokers}.`,
    );
  }

  if (
    agentAccounts <
    expectedBrokers
  ) {
    problems.push(
      `Expected at least ${expectedBrokers} broker agent accounts but found ${agentAccounts}.`,
    );
  }

  if (
    bankTransactions <
    expectedBankTransactions
  ) {
    problems.push(
      `Expected at least ${expectedBankTransactions} imported bank transactions but found ${bankTransactions}.`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      problems.join(" "),
    );
  }

  console.log(
    "\nSeed verification passed.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
