import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1 AS databaseHealth`;

    return NextResponse.json(
      {
        success: true,
        message: "The Simamia database connection is working.",
        database: process.env.DATABASE_NAME ?? "simamia",
        host: process.env.DATABASE_HOST ?? "127.0.0.1",
        checkedAt: new Date().toISOString(),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("DATABASE_HEALTH_ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown database connection error.";

    return NextResponse.json(
      {
        success: false,
        message: "The database connection failed.",
        error:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      {
        status: 500,
      },
    );
  }
}