import fs from "node:fs";

const checks = [
  ["app/api/super-admin/companies/route.ts", ["GET", "POST"]],
  ["app/api/super-admin/companies/[id]/route.ts", ["GET", "PATCH", "DELETE"]],
  ["app/api/super-admin/company-admins/route.ts", ["GET", "POST"]],
  ["app/api/super-admin/company-admins/[id]/route.ts", ["PATCH", "DELETE"]],
  ["app/api/super-admin/users/route.ts", ["GET", "POST"]],
  ["app/api/super-admin/users/[id]/route.ts", ["PATCH", "DELETE"]],
  ["app/api/super-admin/users/[id]/reset-password/route.ts", ["PATCH"]],
  ["app/api/super-admin/subscriptions/route.ts", ["GET", "POST"]],
  ["app/api/super-admin/subscriptions/[id]/route.ts", ["PATCH", "DELETE"]],
  ["app/api/super-admin/dashboard/route.ts", ["GET"]],
];

const failures = [];
for (const [file, methods] of checks) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing file`);
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  for (const method of methods) {
    if (!source.includes(`export async function ${method}`)) {
      failures.push(`${file}: missing ${method}`);
    }
  }
}

const clientPath = "app/super-admin/dashboard/SuperAdminDashboardClient.tsx";
const client = fs.readFileSync(clientPath, "utf8");
const requiredClientCapabilities = [
  "/api/super-admin/companies",
  "/api/super-admin/company-admins",
  "/api/super-admin/users",
  "/api/super-admin/subscriptions",
  "Manage Users",
  "Create Companies",
  "Manage Companies",
  "Manage Company Admins",
  "Reset Passwords",
];

for (const token of requiredClientCapabilities) {
  if (!client.includes(token)) failures.push(`${clientPath}: missing ${token}`);
}

if (failures.length) {
  console.error("SIMAMIA Super Admin CRUD validation failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SIMAMIA Super Admin CRUD validation passed.");
console.log("- Company create/list/edit/disable routes are present.");
console.log("- Company Admin create/list/edit/remove routes are present.");
console.log("- General company user create/list/edit/remove routes are present.");
console.log("- Subscription create/list/edit/delete routes are present.");
console.log("- Super Admin dashboard is wired to the CRUD APIs.");
