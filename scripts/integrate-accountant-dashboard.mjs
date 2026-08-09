import fs from "node:fs";
import path from "node:path";

const candidates = [
  "app/accountant/dashboard/AccountantDashboardClient.tsx",
  "src/app/accountant/dashboard/AccountantDashboardClient.tsx",
  "app/accountant/AccountantDashboardClient.tsx",
  "src/app/accountant/AccountantDashboardClient.tsx",
];

const links = [
  { page: "Staff Expense Requests", tab: "expense-requests", glyph: "expense" },
  { page: "Dual Expense Approval", tab: "expense-approval", glyph: "expense" },
  { page: "Float + Cash Issue", tab: "manual-cashflow", glyph: "manual" },
  { page: "Staff Funding Ledger", tab: "funding-ledger", glyph: "float" },
  { page: "Attendance Journal", tab: "attendance-register", glyph: "attendance" },
  { page: "Attendance Progress", tab: "attendance-progress", glyph: "report" },
  { page: "Fingerprint Devices", tab: "fingerprint", glyph: "attendance" },
  { page: "SMS & Proof Review", tab: "proof-review", glyph: "receipt" },
  { page: "Admin Documents", tab: "admin-documents", glyph: "ledger" },
  { page: "Admin Bank Comparison", tab: "bank-reconciliation", glyph: "bank" },
  { page: "Financial Report Centre", tab: "financial-reports", glyph: "report" },
  { page: "Performance Reports", tab: "performance-reports", glyph: "report" },
  { page: "Control Notifications", tab: "notifications", glyph: "bell" },
];

const target = candidates
  .map((item) => path.resolve(process.cwd(), item))
  .find((item) => fs.existsSync(item));

if (!target) {
  console.error("AccountantDashboardClient.tsx was not found.");
  console.error(`Checked:\n${candidates.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");
const newline = source.includes("\r\n") ? "\r\n" : "\n";
const backup = `${target}.before-staff-control-sidebar`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

const missingUnionPages = links.filter(
  (link) => !source.includes(`| "${link.page}"`),
);

if (missingUnionPages.length) {
  const unionAnchor = /(\s*\|\s*"Attendance Management"\s*\r?\n)/;
  if (unionAnchor.test(source)) {
    const additions = missingUnionPages
      .map((link) => `  | "${link.page}"${newline}`)
      .join("");
    source = source.replace(unionAnchor, (match) => `${match}${additions}`);
  } else {
    console.warn("PageKey union anchor was not found; sidebar page types were not inserted.");
  }
}

const missingNavigation = links.filter(
  (link) => !source.includes(`{ page: "${link.page}"`),
);

if (missingNavigation.length) {
  const navigationAnchor = /(\s*\{\s*page:\s*"Attendance Management",\s*glyph:\s*"attendance",\s*group:\s*"Operations"\s*\},\s*\r?\n)/;
  if (navigationAnchor.test(source)) {
    const additions = missingNavigation
      .map(
        (link) =>
          `  { page: "${link.page}", glyph: "${link.glyph}", group: "Control Centre" },${newline}`,
      )
      .join("");
    source = source.replace(navigationAnchor, (match) => `${match}${additions}`);
  } else {
    console.warn("Navigation anchor was not found; new sidebar entries were not inserted.");
  }
}

if (!source.includes("const accountantControlTabByPage")) {
  const functionAnchor = /(\s*function\s+openPage\(page:\s*PageKey\)\s*\{\s*\r?\n)/;
  if (functionAnchor.test(source)) {
    const routeRows = links
      .map((link) => `      "${link.page}": "${link.tab}",${newline}`)
      .join("");

    const routing =
      `    const accountantControlTabByPage: Partial<Record<PageKey, string>> = {${newline}` +
      routeRows +
      `    };${newline}` +
      `    const controlTab = accountantControlTabByPage[page];${newline}` +
      `    if (controlTab) {${newline}` +
      `      router.push(\`/accountant/control-centre?tab=\${controlTab}\`);${newline}` +
      `      setMobileOpen(false);${newline}` +
      `      setNoticeOpen(false);${newline}` +
      `      return;${newline}` +
      `    }${newline}${newline}`;

    source = source.replace(functionAnchor, (match) => `${match}${routing}`);
  } else {
    console.warn("openPage() was not found; sidebar entries will require manual routing.");
  }
}

if (!source.includes('["Staff Control", "Staff Expense Requests"')) {
  const quickAnchor = /(\s*\["Export Report",\s*"Financial Reports",\s*"report"\],\s*\r?\n)/;
  if (quickAnchor.test(source)) {
    source = source.replace(
      quickAnchor,
      (match) => `${match}              ["Staff Control", "Staff Expense Requests", "attendance"],${newline}`,
    );
  }
}

fs.writeFileSync(target, source);
console.log(`Integrated the STAFF-only Accountant Control Centre sidebar into:\n${target}`);
console.log(`Backup created at:\n${backup}`);
console.log(`Added or verified ${links.length} Control Centre sidebar links.`);
