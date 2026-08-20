import fs from "node:fs";

const checks = [
  ["app/api/company-admin/dashboard/route.ts", ["GET"]],
  ["app/api/company-admin/users/route.ts", ["GET", "POST"]],
  ["app/api/company-admin/users/[id]/route.ts", ["PATCH", "DELETE"]],
  ["app/api/company-admin/branches/route.ts", ["GET", "POST"]],
  ["app/api/company-admin/branches/[id]/route.ts", ["PATCH", "DELETE"]],
  ["app/api/company-admin/brokers/route.ts", ["GET", "POST"]],
  ["app/api/company-admin/brokers/[id]/route.ts", ["PATCH", "DELETE"]],
  ["app/api/company-admin/expenses/route.ts", ["GET", "POST"]],
  ["app/api/company-admin/expenses/[id]/route.ts", ["PATCH"]],
  ["app/api/company-admin/bank-verifications/route.ts", ["GET", "POST"]],
  ["app/api/company-admin/bank-verifications/[id]/route.ts", ["PATCH"]],
  ["app/api/company-admin/gps-devices/route.ts", ["GET", "POST"]],
  ["app/api/company-admin/gps-devices/[id]/route.ts", ["PATCH"]],
  ["app/api/company-admin/settings/route.ts", ["PATCH"]],
  ["app/api/company-admin/notifications/read-all/route.ts", ["PATCH"]],
  ["app/api/company-admin/reports/export/route.ts", ["GET"]],
];

const failures = [];
for (const [file, methods] of checks) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing file`);
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  for (const method of methods) {
    if (!source.includes(`export async function ${method}`)) failures.push(`${file}: missing ${method}`);
  }
}

const client = fs.readFileSync("app/admin/dashboard/CompanyAdminDashboardClient.tsx", "utf8");
for (const token of [
  "/api/company-admin/users",
  "/api/company-admin/branches",
  "/api/company-admin/brokers",
  "/api/company-admin/expenses",
  "/api/company-admin/bank-verifications",
  "/api/company-admin/gps-devices",
  "/api/company-admin/settings",
  "/api/company-admin/reports/export",
]) {
  if (!client.includes(token)) failures.push(`CompanyAdminDashboardClient.tsx: missing ${token}`);
}

if (failures.length) {
  console.error("SIMAMIA Company Admin CRUD validation failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SIMAMIA Company Admin CRUD validation passed.");
console.log("- Users, branches, brokers, expenses and bank verification routes are wired.");
console.log("- GPS, settings, notifications and export routes are wired.");
