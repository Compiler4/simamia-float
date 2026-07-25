import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const exists = (file) => fs.existsSync(path.join(root, file));

function backup(file) {
  if (!exists(file)) return;
  const backupFile = `${file}.before-v3`;
  if (!exists(backupFile)) write(backupFile, read(file));
}

function patchFile(file, replacements) {
  if (!exists(file)) return false;
  backup(file);
  let source = read(file);
  const original = source;
  for (const [search, replacement] of replacements) {
    source = typeof search === "string"
      ? source.replaceAll(search, replacement)
      : source.replace(search, replacement);
  }
  if (source !== original) write(file, source);
  return source !== original;
}

function mergePackageJson() {
  const file = "package.json";
  if (!exists(file)) throw new Error("package.json was not found. Run this command in the project root.");
  backup(file);
  const current = JSON.parse(read(file));
  current.private = true;
  current.scripts = {
    ...(current.scripts || {}),
    dev: "next dev",
    build: "next build",
    start: "next start",
    typecheck: "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "db:sync": "prisma db push",
    "import:agents": "tsx scripts/import-float-agents.ts",
    "import:crdb": "tsx scripts/import-crdb-statement.ts",
    "import:all": "tsx scripts/import-all-data.ts",
    "repair:v3": "node scripts/apply-v3-fixes.mjs",
  };
  current.dependencies = {
    ...(current.dependencies || {}),
    leaflet: current.dependencies?.leaflet || "^1.9.4",
    "pdf-lib": current.dependencies?.["pdf-lib"] || "^1.17.1",
    "pdf-parse": current.dependencies?.["pdf-parse"] || "^1.1.1",
    xlsx: current.dependencies?.xlsx || "^0.18.5",
  };
  current.devDependencies = {
    ...(current.devDependencies || {}),
    "@types/leaflet": current.devDependencies?.["@types/leaflet"] || "^1.9.21",
    tsx: current.devDependencies?.tsx || "^4.20.6",
  };
  write(file, `${JSON.stringify(current, null, 2)}\n`);
}

function addPdfParseTypes() {
  const declaration = `declare module "pdf-parse" {\n  type PdfParseOptions = {\n    pagerender?: (pageData: unknown) => Promise<string>;\n    max?: number;\n    version?: string;\n  };\n\n  type PdfParseResult = {\n    numpages: number;\n    numrender: number;\n    info: Record<string, unknown>;\n    metadata: unknown;\n    text: string;\n    version: string;\n  };\n\n  function pdfParse(\n    dataBuffer: Buffer | Uint8Array,\n    options?: PdfParseOptions,\n  ): Promise<PdfParseResult>;\n\n  export = pdfParse;\n}\n`;
  write("types/pdf-parse.d.ts", declaration);
}

function patchTypeErrors() {
  const accountantRoutes = [
    "app/api/accountant/accountant/dashboard/route.ts",
    "app/api/accountant/accountant/accountant/dashboard/route.ts",
  ];
  for (const file of accountantRoutes) {
    patchFile(file, [[
      "chartOfAccounts.map((item: any) => [String(item.code), item])",
      "(Array.isArray(chartOfAccounts) ? chartOfAccounts : []).map((item: any) => [String(item.code), item])",
    ]]);
  }

  patchFile("app/api/company-admin/reports/export/route.ts", [[
    "staffRows.filter((row) => row.outstandingFloat > 0)",
    "staffRows.filter((row: any) => row.outstandingFloat > 0)",
  ]]);

  patchFile("app/api/company-admin/uploads/route.ts", [[
    "const originalBytes = Buffer.from(await file.arrayBuffer());\n    let bytes = originalBytes;",
    "const originalBytes = Buffer.from(await file.arrayBuffer());\n    let bytes: Uint8Array = originalBytes;",
  ]]);

  patchFile("lib/staff/attendance.ts", [[
    '"FLOAT_RECEIVED" | "FLOAT_ISSUED" | "COLLECTION_RETURNED" | "GPS_MOVEMENT"',
    '"FLOAT_RECEIVED" | "FLOAT_ISSUED" | "COLLECTION_RETURNED" | "MONEY_RETURNED" | "GPS_MOVEMENT"',
  ]]);

  patchFile("lib/staff/notify.ts", [[
    "webhookFor(channel)",
    "webhookFor(channel as Channel)",
  ]]);
}

function patchBankSchema() {
  const file = "prisma/schema.prisma";
  if (!exists(file)) return;
  let source = read(file);
  const original = source;
  if (!source.includes("bankName         String") && source.includes("model CompanyBankVerification")) {
    source = source.replace(
      "  depositDate      DateTime\n  bankAccount      String",
      '  depositDate      DateTime\n  bankName         String            @default("UNSPECIFIED BANK") @db.VarChar(120)\n  accountName      String?           @db.VarChar(191)\n  bankAccount      String',
    );
    source = source.replace(
      "  @@index([companyId, depositDate])\n  @@index([companyId, status])",
      "  @@index([companyId, depositDate])\n  @@index([companyId, bankName, bankAccount])\n  @@index([companyId, status])",
    );
  }
  if (source !== original) {
    backup(file);
    write(file, source);
  }
}

mergePackageJson();
addPdfParseTypes();
patchTypeErrors();
patchBankSchema();

console.log("Simamia V3 repair completed.");
console.log("Next: npm install; npx prisma db push; npx prisma generate; npm run typecheck");
