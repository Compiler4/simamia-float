import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const notes = [];

function file(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

function requireText(path, needle, label = needle) {
  const source = file(path);
  if (source && !source.includes(needle)) {
    failures.push(`${path} is missing ${label}.`);
  }
}

function forbidText(path, needle, label = needle) {
  const source = file(path);
  if (source.includes(needle)) {
    failures.push(`${path} still contains forbidden ${label}.`);
  }
}

const collectionRoutes = [
  "app/api/company-admin/users/route.ts",
  "app/api/company-admin/branches/route.ts",
  "app/api/company-admin/expenses/route.ts",
  "app/api/company-admin/network-balances/route.ts",
  "app/api/company-admin/gps-devices/route.ts",
  "app/api/company-admin/bank-verifications/route.ts",
];

for (const route of collectionRoutes) {
  requireText(route, "export async function POST", "POST handler");
}

requireText(
  "app/api/company-admin/bank-verifications/[id]/route.ts",
  "export async function PATCH",
  "PATCH decision handler",
);

const bankReport = file("app/api/company-admin/reports/bank-bundle/route.ts");
if (bankReport.includes('companyBankVerification.findMany({\n        where: {\n          companyId,\n          bankName')) {
  failures.push("Bank proof report still filters CompanyBankVerification by non-existent bankName field.");
}
if (bankReport.includes('orderBy: [{ bankName: "asc" }')) {
  failures.push("Bank proof report still orders CompanyBankVerification by non-existent bankName field.");
}

const staffOperations = file("app/api/staff/operations/route.ts");
const staffWorkspace = file("app/api/staff/workspace/route.ts");
const staffWorkspaceImplementation = file("lib/staff/workspace-route.ts");
requireText("app/api/staff/operations/route.ts", "export async function GET", "JSON GET handler");
requireText("app/api/staff/operations/route.ts", "@/lib/staff/workspace-route", "shared JSON workspace implementation");
requireText("app/api/staff/workspace/route.ts", "export async function GET", "dedicated Staff workspace GET handler");
requireText("lib/staff/workspace-route.ts", "NextResponse.json", "JSON response");
if (staffOperations.includes('Content-Type", "application/pdf"') || staffOperations.includes("PDFDocument.create")) {
  failures.push("Staff operations route looks like a report/PDF route instead of the JSON operations API.");
}
if (staffWorkspace.includes('Content-Type", "application/pdf"') || staffWorkspaceImplementation.includes("PDFDocument.create")) {
  failures.push("Staff workspace route contains report/PDF code instead of JSON workspace code.");
}

requireText("app/staff/page.tsx", 'redirect("/staff/dashboard")', "Staff dashboard redirect");
requireText("app/dashboard/page.tsx", "getDashboardPath", "role-aware dashboard redirect");
requireText("app/accountant/page.tsx", 'redirect("/accountant/dashboard")', "Accountant dashboard redirect");
requireText("app/developer/page.tsx", 'redirect("/developer/dashboard")', "Developer dashboard redirect");
requireText("app/super-admin/page.tsx", 'redirect("/super-admin/dashboard")', "Super Admin dashboard redirect");

if (existsSync(resolve(root, "app/agent-location/%5Btoken%5D"))) {
  failures.push("Stale encoded app/agent-location/%5Btoken%5D route still exists.");
}

requireText("lib/accountant/actions.ts", 'case "OPEN_DAY"', "OPEN_DAY action");
requireText("lib/accountant/actions.ts", 'case "CLOSE_DAY"', "CLOSE_DAY action");
requireText("lib/accountant/actions.ts", "getCloseDaySettlement", "close-day settlement guard");
requireText("lib/accountant/close-day.ts", "accountantStaffFunding.findMany", "staff funding close-day check");

requireText("app/api/accountant/uploads/route.ts", '"expenses"', "legacy expense upload fallback");
if (!existsSync(resolve(root, "public/uploads/expenses/seed-expense-002.pdf"))) {
  failures.push("Missing development seed expense receipt: public/uploads/expenses/seed-expense-002.pdf");
}

forbidText("app/page.tsx", "AgentLocationShareClient", "Agent Location client import in the root page");
forbidText("app/page.tsx", "AccountantVerificationRequestsClient", "Accountant Verification client import in the root page");

notes.push("Company Admin collection routes expose POST handlers.");
notes.push("Bank verification decisions expose PATCH and the report avoids CompanyBankVerification.bankName.");
notes.push("Staff operations/workspace endpoints are JSON-only and /staff has a dashboard entry route.");
notes.push("Accountant Open/Close Financial Day guards are present.");
notes.push("Seed expense document fallback is present.");

if (failures.length) {
  console.error("SIMAMIA portal repair validation FAILED:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SIMAMIA portal repair validation passed.\n");
for (const note of notes) console.log(`- ${note}`);
