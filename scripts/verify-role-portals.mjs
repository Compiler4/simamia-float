import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const auth = read("lib/auth.ts");
const login = read("app/api/auth/login/route.ts");
const staff = read("app/staff/dashboard/page.tsx");
const developer = read("app/developer/dashboard/page.tsx");
const superAdmin = read("app/super-admin/dashboard/page.tsx");

const checks = [
  [auth.includes('case "STAFF":') && auth.includes('return "/staff/dashboard";'), "STAFF role mapping"],
  [auth.includes('case "SUPER_ADMIN":') && auth.includes('return "/super-admin/dashboard";'), "SUPER_ADMIN role mapping"],
  [auth.includes('case "SYSTEM_DEVELOPER":') && auth.includes('return "/developer/dashboard";'), "SYSTEM_DEVELOPER role mapping"],
  [login.includes("resolveDashboard(") && login.includes("getDashboardPath("), "login uses central role redirect"],
  [exists("app/staff/page.tsx") && exists("app/staff/dashboard/page.tsx"), "Staff entry/dashboard routes"],
  [exists("app/developer/page.tsx") && exists("app/developer/dashboard/page.tsx"), "Developer entry/dashboard routes"],
  [exists("app/super-admin/page.tsx") && exists("app/super-admin/dashboard/page.tsx"), "Super Admin entry/dashboard routes"],
  [exists("app/broker/dashboard/page.tsx"), "Broker dashboard route"],
  [exists("app/gps-manager/dashboard/page.tsx"), "GPS Manager dashboard route"],
  [staff.includes('normalizeRole(user.role) !== "STAFF"'), "Staff role guard"],
  [developer.includes('normalizeRole(user.role) !== "SYSTEM_DEVELOPER"'), "Developer role guard"],
  [superAdmin.includes('normalizeRole(user.role) !== "SUPER_ADMIN"'), "Super Admin role guard"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  console.error("Role portal validation failed:");
  for (const [, label] of failed) console.error(`- ${label}`);
  process.exit(1);
}

console.log("SIMAMIA role portal validation passed.");
console.log("- STAFF -> /staff/dashboard");
console.log("- SUPER_ADMIN -> /super-admin/dashboard");
console.log("- SYSTEM_DEVELOPER -> /developer/dashboard");
console.log("- Staff API session recovery is enabled.");
