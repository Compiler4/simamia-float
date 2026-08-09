import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "prisma", "schema.prisma");
const blockPath = path.join(
  root,
  "prisma",
  "accountant-control-centre.prisma",
);

if (!fs.existsSync(schemaPath)) {
  throw new Error(`Missing ${schemaPath}`);
}
if (!fs.existsSync(blockPath)) {
  throw new Error(`Missing ${blockPath}`);
}

let schema = fs.readFileSync(schemaPath, "utf8");
const block = fs.readFileSync(blockPath, "utf8");

const requiredModels = [
  "Attendance",
  "Expense",
  "ApprovalDecision",
  "StaffFundingReceipt",
  "StaffProofSubmission",
  "BankDeposit",
  "Notification",
];

for (const model of requiredModels) {
  if (!new RegExp(`model\\s+${model}\\s*\\{`).test(schema)) {
    throw new Error(
      `The current schema is missing model ${model}. Use your complete Simamia schema before applying this upgrade.`,
    );
  }
}

function insertAttendanceFields(source) {
  if (source.includes("morningStatus     AttendanceStatus?")) return source;

  const modelPattern = /model\s+Attendance\s*\{[\s\S]*?\n\}/m;
  const match = source.match(modelPattern);
  if (!match) throw new Error("Attendance model could not be located.");

  let model = match[0];
  const marker = /\n\s*notes\s+String\?\s+@db\.Text/;
  if (!marker.test(model)) {
    throw new Error("Attendance.notes field could not be located.");
  }

  model = model.replace(
    marker,
    (line) => `${line}\n  morningStatus     AttendanceStatus?\n  eveningStatus     AttendanceStatus?\n  morningSource     String?          @db.VarChar(80)\n  eveningSource     String?          @db.VarChar(80)\n  markedById        String?\n  verifiedById      String?\n  verifiedAt        DateTime?\n  deviceId          String?`,
  );

  if (!model.includes("@@index([companyId, date])")) {
    model = model.replace(
      /\n\s*@@index\(\[companyId\]\)/,
      "\n  @@index([companyId])\n  @@index([companyId, date])",
    );
  }

  return source.replace(match[0], model);
}

schema = insertAttendanceFields(schema);

const appendedModels = [
  "AttendanceDevice",
  "AttendanceDeviceEnrollment",
  "AttendancePunch",
  "VerificationPacket",
];

if (!appendedModels.every((name) => schema.includes(`model ${name} {`))) {
  const cleaned = block
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .trim();
  schema = `${schema.trim()}\n\n${cleaned}\n`;
}

fs.copyFileSync(schemaPath, `${schemaPath}.before-accountant-control-centre`);
fs.writeFileSync(schemaPath, schema);
console.log(`Updated ${schemaPath}`);
console.log("Next: npx prisma format && npx prisma validate && npx prisma db push && npx prisma generate");
