import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const required = [
  "app/accountant/dashboard/page.tsx",
  "app/accountant/dashboard/AccountantDashboardClient.tsx",
  "app/accountant/dashboard/AccountantDashboard.module.css",
  "app/accountant/dashboard/AccountantOperationsCentre.tsx",
  "app/accountant/dashboard/AccountantOperationsCentre.module.css",
  "app/api/accountant/control-centre/route.ts",
  "app/api/accountant/fingerprint-devices/route.ts",
  "app/api/accountant/reports/route.ts",
  "app/api/fingerprint/attendance/route.ts",
  "lib/accountant-control/auth.ts",
  "lib/accountant-control/date-range.ts",
  "lib/accountant-control/expense-approval.ts",
  "lib/accountant-control/notifications.ts",
  "prisma/schema.prisma",
];

let failed = false;
for (const relative of required) {
  try {
    await access(path.join(root, relative));
    console.log(`OK      ${relative}`);
  } catch {
    failed = true;
    console.error(`MISSING ${relative}`);
  }
}

try {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const name of ["pdf-lib", "xlsx"]) {
    if (dependencies[name]) console.log(`OK      dependency ${name}`);
    else {
      failed = true;
      console.error(`MISSING dependency ${name}`);
    }
  }
} catch (error) {
  failed = true;
  console.error(`Could not read package.json: ${error instanceof Error ? error.message : error}`);
}

if (failed) {
  console.error("\nAccountant portal installation is incomplete.");
  process.exitCode = 1;
} else {
  console.log("\nAccountant portal file and dependency check passed.");
}
