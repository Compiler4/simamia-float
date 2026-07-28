import "dotenv/config";

import path from "node:path";
import {
  readdir,
} from "node:fs/promises";

import {
  importFloatAgentsJson,
} from "./import-float-agents-json";
import {
  importBankStatementJson,
} from "./import-bank-statement-json";
import {
  seedPrisma as prisma,
} from "./seed-client";

async function main() {
  const companyCode =
    String(
      process.argv[2] ||
        process.env.SEED_COMPANY_CODE ||
        "SIMAMIA",
    )
      .trim()
      .toUpperCase();

  const dataDirectory =
    path.resolve(
      process.cwd(),
      "prisma",
      "data",
    );

  const floatFile =
    path.join(
      dataDirectory,
      "float-agents.json",
    );

  console.log(
    `\nImporting float-agent data for ${companyCode}...`,
  );

  await importFloatAgentsJson(
    companyCode,
    floatFile,
  );

  const files =
    await readdir(
      dataDirectory,
    );

  const bankFiles =
    files
      .filter((name) =>
        /^bank-statement.*\.json$/i.test(
          name,
        ),
      )
      .sort((left, right) =>
        left.localeCompare(right),
      );

  for (const fileName of bankFiles) {
    console.log(
      `\nImporting ${fileName}...`,
    );

    await importBankStatementJson(
      companyCode,
      path.join(
        dataDirectory,
        fileName,
      ),
    );
  }

  console.log(
    `\nData-folder import completed for company ${companyCode}.`,
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
