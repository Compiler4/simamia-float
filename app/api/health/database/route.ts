import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1 AS ok`;

    return NextResponse.json(
      {
        success: true,
        message: "Database connection is healthy.",
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("DATABASE_HEALTH_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Database connection failed. Check DATABASE_URL or DATABASE_* values in the hosting environment.",
        details:
          process.env.NODE_ENV === "development"
            ? errorMessage(error)
            : undefined,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
