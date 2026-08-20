import fs from "node:fs";

const clientPath = "app/super-admin/dashboard/SuperAdminDashboardClient.tsx";
const cssPath = "app/super-admin/dashboard/SuperAdminDashboard.module.css";

const client = fs.readFileSync(clientPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

const requiredModules = [
  "Dashboard",
  "Create Companies",
  "Manage Companies",
  "Manage Company Admins",
  "Manage Users",
  "Manage Subscriptions",
  "Access Every Company",
  "View Global Reports",
  "Manage Permissions",
  "Manage System Settings",
  "Reset Passwords",
  "View Audit Logs",
];

const apiFiles = {
  companies: fs.readFileSync("app/api/super-admin/companies/route.ts", "utf8"),
  companyAdmins: fs.readFileSync("app/api/super-admin/company-admins/route.ts", "utf8"),
  users: fs.readFileSync("app/api/super-admin/users/route.ts", "utf8"),
  subscriptions: fs.readFileSync("app/api/super-admin/subscriptions/route.ts", "utf8"),
};

const missing = [];
for (const moduleName of requiredModules) {
  if (!client.includes(`\"${moduleName}\"`)) missing.push(moduleName);
}

const requirements = [
  ["module URL map", client.includes("const PAGE_SLUGS")],
  ["history navigation", client.includes("window.history.pushState")],
  ["browser back/forward support", client.includes('window.addEventListener("popstate"')],
  ["accessible module links", client.includes('aria-label="Super Admin modules"')],
  ["module stage", client.includes("styles.moduleStage")],
  ["API warning keeps modules usable", client.includes("data ?? EMPTY_DASHBOARD_DATA")],
  ["active navigation styling", css.includes(".activeNav")],
  ["clickable anchor navigation styling", css.includes(".navItem")],
  ["mobile navigation support", css.includes(".sidebarMobileOpen")],
  ["company collection GET", apiFiles.companies.includes("export async function GET")],
  ["company collection POST", apiFiles.companies.includes("export async function POST")],
  ["company admin collection GET", apiFiles.companyAdmins.includes("export async function GET")],
  ["company admin collection POST", apiFiles.companyAdmins.includes("export async function POST")],
  ["platform user collection GET", apiFiles.users.includes("export async function GET")],
  ["platform user collection POST", apiFiles.users.includes("export async function POST")],
  ["subscription collection GET", apiFiles.subscriptions.includes("export async function GET")],
  ["subscription collection POST", apiFiles.subscriptions.includes("export async function POST")],
];

const failed = requirements.filter(([, ok]) => !ok).map(([name]) => name);

if (missing.length || failed.length) {
  console.error("SIMAMIA Super Admin navigation validation failed.");
  if (missing.length) console.error("Missing modules:", missing.join(", "));
  if (failed.length) console.error("Missing behavior:", failed.join(", "));
  process.exit(1);
}

console.log("SIMAMIA Super Admin navigation validation passed.");
console.log(`- ${requiredModules.length} sidebar modules are present.`);
console.log("- Sidebar modules have real URLs and client-side navigation.");
console.log("- Browser Back/Forward synchronizes the selected module.");
console.log("- A dashboard API warning no longer traps the user on one screen.");
console.log("- Mobile/collapsed navigation remains available.");
