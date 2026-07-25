import path from "node:path";
import { spawnSync } from "node:child_process";

function run(script: string, args: string[]) {
  const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsxCli, script, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status ?? 1}.`);
  }
}

function main() {
  const [, , companyCodeArg, excelArg, pdfArg] = process.argv;
  const companyCode = String(companyCodeArg || "").trim().toUpperCase();
  if (!companyCode) {
    throw new Error(
      "Usage: npm run import:all -- COMPANY_CODE [excel-path] [statement-pdf-path]",
    );
  }

  const excelPath = path.resolve(
    excelArg || path.join("data", "float data_063712.xlsx"),
  );
  const pdfPath = path.resolve(
    pdfArg || path.join("data", "accountTransactionHistory (16).pdf"),
  );

  run("scripts/import-float-agents.ts", [companyCode, excelPath]);
  run("scripts/import-crdb-statement.ts", [companyCode, pdfPath]);

  console.log("All supplied Excel and CRDB statement data was imported successfully.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
