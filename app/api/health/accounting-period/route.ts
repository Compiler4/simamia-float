import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = prisma as any;
  const available =
    typeof db.accountingPeriod?.findMany === "function";

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        success: available,
        database: "connected",
        accountingPeriodDelegate: available
          ? "available"
          : "missing",
        message: available
          ? "AccountingPeriod is ready."
          : "The database is reachable, but the generated Prisma Client does not contain AccountingPeriod.",
        repair: available
          ? []
          : [
              "Confirm model AccountingPeriod exists in prisma/schema.prisma",
              "Run npx prisma migrate dev --name accountant_periods",
              "Run npx prisma generate",
              "Delete .next",
              "Restart npm run dev",
            ],
      },
      { status: available ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        database: "disconnected",
        accountingPeriodDelegate: available
          ? "available"
          : "missing",
        message:
          error instanceof Error
            ? error.message
            : "Database health check failed.",
      },
      { status: 503 },
    );
  }
}
