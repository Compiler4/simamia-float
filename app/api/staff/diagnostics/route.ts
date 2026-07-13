import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const expectedDelegates = [
  "user",
  "company",
  "floatTransaction",
  "staffCollection",
  "bankDeposit",
  "expense",
  "attendance",
  "notification",
  "serviceActivity",
  "companyGpsDevice",
  "companyGpsPing",
  "gpsAlert",
  "financialDay",
  "performanceRecord",
  "staffBrokerAssignment",
  "staffCustomerAssignment",
  "staffFile",
] as const;

const expectedTables = [
  "users",
  "companies",
  "float_transactions",
  "staff_collections",
  "bank_deposits",
  "expenses",
  "attendance",
  "notifications",
  "service_activities",
  "company_gps_devices",
  "company_gps_pings",
  "gps_alerts",
  "financial_days",
  "performance_records",
  "staff_broker_assignments",
  "staff_customer_assignments",
  "staff_files",
] as const;

const expectedColumns: Record<string, string[]> = {
  users: ["profileImageUrl", "assignedRegion"],
  float_transactions: [
    "transactionType",
    "referenceNo",
    "returnedAmount",
    "receiptUrl",
    "approvedById",
    "issuedAt",
    "returnedAt",
  ],
  bank_deposits: [
    "statementAmount",
    "statementReference",
    "statementDate",
    "statementBankAccount",
    "comparisonJson",
    "holdActive",
  ],
  expenses: ["expenseDate", "reviewNote"],
  service_activities: ["latitude", "longitude", "locationName"],
};

type TableRow = { TABLE_NAME?: string; table_name?: string };
type ColumnRow = {
  TABLE_NAME?: string;
  table_name?: string;
  COLUMN_NAME?: string;
  column_name?: string;
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

export async function GET() {
  try {
    const session = await requireStaff();

    const missingDelegates = expectedDelegates.filter((name) => {
      const value = (db as any)[name];
      return !value || typeof value.findMany !== "function";
    });

    let databaseConnected = false;
    let presentTables: string[] = [];
    let presentColumns: Record<string, string[]> = {};
    let databaseError: string | null = null;

    try {
      await (db as any).$queryRawUnsafe("SELECT 1 AS ok");
      databaseConnected = true;

      const tableRows = (await (db as any).$queryRawUnsafe(
        `SELECT TABLE_NAME
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN (${expectedTables.map(() => "?").join(", ")})`,
        ...expectedTables,
      )) as TableRow[];

      presentTables = tableRows.map((row) =>
        String(row.TABLE_NAME ?? row.table_name ?? ""),
      );

      const columnRows = (await (db as any).$queryRawUnsafe(
        `SELECT TABLE_NAME, COLUMN_NAME
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN (${Object.keys(expectedColumns)
              .map(() => "?")
              .join(", ")})`,
        ...Object.keys(expectedColumns),
      )) as ColumnRow[];

      presentColumns = columnRows.reduce<Record<string, string[]>>(
        (result, row) => {
          const table = String(row.TABLE_NAME ?? row.table_name ?? "");
          const column = String(row.COLUMN_NAME ?? row.column_name ?? "");
          if (!result[table]) result[table] = [];
          result[table].push(column);
          return result;
        },
        {},
      );
    } catch (error) {
      databaseError = message(error);
    }

    const missingTables = expectedTables.filter(
      (table) => !presentTables.includes(table),
    );

    const missingColumns = Object.entries(expectedColumns).flatMap(
      ([table, columns]) =>
        columns
          .filter((column) => !(presentColumns[table] ?? []).includes(column))
          .map((column) => `${table}.${column}`),
    );

    const healthy =
      databaseConnected &&
      missingDelegates.length === 0 &&
      missingTables.length === 0 &&
      missingColumns.length === 0;

    return NextResponse.json(
      {
        success: true,
        healthy,
        staffId: session.id,
        companyId: session.companyId,
        databaseConnected,
        missingDelegates,
        missingTables,
        missingColumns,
        databaseError,
        remedy: healthy
          ? "The Staff database structure is ready."
          : [
              "Stop npm run dev.",
              "Run npx prisma format.",
              "Run npx prisma validate.",
              "Run npx prisma db push.",
              "Run npx prisma generate.",
              "Delete .next and restart npm run dev.",
            ],
      },
      {
        status: healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("[STAFF_DIAGNOSTICS]", error);
    return NextResponse.json(
      {
        success: false,
        message: message(error),
      },
      { status: 500 },
    );
  }
}
