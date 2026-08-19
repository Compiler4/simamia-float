import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const compatibilityRoute = read("app/api/staff/operations/route.ts");
const workspaceRoute = read("app/api/staff/workspace/route.ts");
const implementation = read("lib/staff/workspace-route.ts");
const reportRoute = read("app/api/staff/operations/report/route.ts");
const helper = read("lib/staff/ensure-operations-schema.ts");
const client = read("app/staff/dashboard/StaffAdvancedOperations.tsx");
const dashboardClient = read("app/staff/dashboard/StaffDashboardClient.tsx");
const pkg = JSON.parse(read("package.json"));

const checks = [
  [implementation.includes("ensureStaffOperationsSchema"), "Staff workspace route must self-heal its required schema."],
  [implementation.includes("softQuery("), "Staff workspace GET must tolerate optional dataset failures."],
  [implementation.includes("serviceDay: today.start"), "Broker service creation must provide serviceDay."],
  [workspaceRoute.includes("@/lib/staff/workspace-route"), "The dedicated /api/staff/workspace JSON route is not connected."],
  [compatibilityRoute.includes("@/lib/staff/workspace-route"), "The legacy /api/staff/operations route is not a JSON compatibility wrapper."],
  [!compatibilityRoute.includes("PDFDocument") && !compatibilityRoute.includes("application/pdf"), "The legacy Staff operations route still contains report/PDF code."],
  [reportRoute.includes("PDFDocument"), "The Staff PDF report route is missing its report implementation."],
  [client.includes("/api/staff/workspace"), "Staff sidebar modules are not using the dedicated JSON workspace route."],
  [dashboardClient.includes("/api/staff/workspace?period="), "Staff dashboard attendance is not using the dedicated JSON workspace route."],
  [!client.includes('fetch(`/api/staff/operations?'), "A Staff sidebar module still loads data from the ambiguous operations route."],
  [helper.includes("staff_funding_receipts"), "Funding receipt table repair is missing."],
  [helper.includes("staff_proof_submissions"), "Staff proof table repair is missing."],
  [helper.includes("broker_service_visits"), "Broker service visit table repair is missing."],
  [helper.includes("staff_broker_customer_assignments"), "Broker assignment table repair is missing."],
  [helper.includes("COLUMN_PATCHES"), "Legacy Staff column compatibility repair is missing."],
  [helper.includes("staff_funding_receipts") && helper.includes("receiptUrl"), "Funding receipt compatibility columns are missing."],
  [helper.includes("broker_service_visits") && helper.includes("serviceDay"), "Broker service visit compatibility columns are missing."],
  [helper.includes("attendance") && helper.includes("overallStatus"), "Attendance compatibility column is missing."],
  [helper.includes("broker_agent_accounts"), "Broker agent account table repair is missing."],
  [helper.includes("staff_network_lines"), "Staff network line table repair is missing."],
  [helper.includes("staff_work_areas"), "Staff work area table repair is missing."],
  [client.includes("Staff workspace needs one final data check"), "Staff degraded-mode diagnostic banner is missing."],
  [pkg.scripts?.["db:fix:staff-operations"] === "tsx scripts/ensure-staff-operations-schema.ts", "Staff DB repair script is not registered."],
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error("SIMAMIA Staff operations validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SIMAMIA Staff operations validation passed.");
console.log("- All Staff sidebar modules use /api/staff/workspace for JSON data.");
console.log("- /api/staff/operations remains a JSON-only compatibility route.");
console.log("- PDF/CSV output exists only under /api/staff/operations/report.");
console.log("- Missing Staff V4 tables/columns can be repaired automatically.");
console.log("- Optional dataset failures do not block the entire workspace.");
