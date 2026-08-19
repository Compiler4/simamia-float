import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { ensureStaffOperationsSchema, STAFF_OPERATIONS_TABLES } = await import(
    "../lib/staff/ensure-operations-schema"
  );
  const { db } = await import("../lib/db");

  try {
    console.log("Checking Staff operations database tables...");
    const result = await ensureStaffOperationsSchema();

    if (!result.ok) {
      console.error("Staff schema repair completed with warnings:");
      for (const warning of result.warnings) console.error(`- ${warning}`);
      process.exitCode = 1;
      return;
    }

    console.log("OK: Staff operations schema is available.");
    for (const table of STAFF_OPERATIONS_TABLES) console.log(`- ${table}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("STAFF_OPERATIONS_SCHEMA_FIX_FAILED");
  console.error(error);
  process.exitCode = 1;
});
