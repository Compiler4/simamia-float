import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const createTableSql = `
CREATE TABLE IF NOT EXISTS \`accountant_staff_fundings\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`staffId\` VARCHAR(191) NOT NULL,
  \`issuedById\` VARCHAR(191) NOT NULL,
  \`floatAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  \`cashAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  \`totalAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  \`referenceNo\` VARCHAR(191) NOT NULL,
  \`purpose\` VARCHAR(191) NULL,
  \`note\` TEXT NULL,
  \`status\` ENUM('ISSUED', 'CONFIRMED', 'RETURNED', 'VERIFIED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
  \`issuedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`confirmedAt\` DATETIME(3) NULL,
  \`receiptUrl\` TEXT NULL,
  \`returnedAmount\` DECIMAL(18, 2) NULL,
  \`returnedAt\` DATETIME(3) NULL,
  \`returnReason\` TEXT NULL,
  \`verifiedById\` VARCHAR(191) NULL,
  \`verifiedAt\` DATETIME(3) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`accountant_staff_fundings_company_reference_key\` (\`companyId\`, \`referenceNo\`),
  INDEX \`accountant_staff_fundings_company_issued_idx\` (\`companyId\`, \`issuedAt\`),
  INDEX \`accountant_staff_fundings_company_staff_idx\` (\`companyId\`, \`staffId\`),
  INDEX \`accountant_staff_fundings_company_status_idx\` (\`companyId\`, \`status\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

async function main() {
  const { db } = await import("../lib/db");

  try {
    console.log("Checking Accountant staff funding table...");
    await db.$executeRawUnsafe(createTableSql);
    const count = await db.accountantStaffFunding.count();

    console.log("OK: accountant_staff_fundings is available.");
    console.log(`Current row count: ${count}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("ACCOUNTANT_STAFF_FUNDING_SCHEMA_FIX_FAILED");
  console.error(error);
  process.exitCode = 1;
});
