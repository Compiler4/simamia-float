import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function localHost(value: string): boolean {
  return ["127.0.0.1", "localhost", "::1"].includes(value.trim().toLowerCase());
}

function privateHost(value: string): boolean {
  const cleaned = value.trim().toLowerCase();
  return (
    cleaned.startsWith("10.") ||
    cleaned.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(cleaned)
  );
}

function configuredHost(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    try {
      return new URL(databaseUrl).hostname;
    } catch {
      return "INVALID_DATABASE_URL";
    }
  }

  return process.env.DATABASE_HOST?.trim() || "";
}

function diagnosticSummary(error?: unknown) {
  const host = configuredHost();
  const hostKind = !host
    ? "missing"
    : host === "INVALID_DATABASE_URL"
      ? "invalid-url"
      : localHost(host)
        ? "local"
        : privateHost(host)
          ? "private-network"
          : "remote";

  const likelyCause =
    hostKind === "local"
      ? "DATABASE_URL or DATABASE_HOST points to localhost. Hosted platforms need a hosted database hostname."
      : hostKind === "private-network"
        ? "DATABASE_HOST is a private LAN address. Hosted platforms cannot reach your home or office network directly."
        : hostKind === "missing"
          ? "DATABASE_URL or DATABASE_HOST is missing."
          : hostKind === "invalid-url"
            ? "DATABASE_URL is not a valid mysql:// or mariadb:// URL."
            : "The database host is set, but the server refused or timed out. Check the hostname, port, password, firewall and external-connection settings.";

  return {
    configured: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
      hasDatabaseHost: Boolean(process.env.DATABASE_HOST?.trim()),
      hostKind,
      port: process.env.DATABASE_PORT?.trim() || "3306",
      databaseNamePresent: Boolean(process.env.DATABASE_NAME?.trim()),
      userPresent: Boolean(process.env.DATABASE_USER?.trim()),
      passwordPresent: Boolean(process.env.DATABASE_PASSWORD !== undefined),
      connectionLimit: process.env.DATABASE_CONNECTION_LIMIT?.trim() || "5",
    },
    likelyCause,
    error:
      process.env.NODE_ENV === "development" && error
        ? errorMessage(error)
        : undefined,
  };
}

export async function GET(): Promise<Response> {
  try {
    const { db } = await import("@/lib/db");

    await db.$queryRaw`SELECT 1 AS ok`;

    return NextResponse.json(
      {
        success: true,
        message: "Database connection is healthy.",
        diagnostics: diagnosticSummary(),
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
        diagnostics: diagnosticSummary(error),
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
