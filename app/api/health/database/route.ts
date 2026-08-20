import { NextResponse } from "next/server";

import {
  classifyDatabaseError,
  databaseErrorDetails,
} from "@/lib/database-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: string | undefined): string {
  const text = value?.trim() ?? "";
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function hasSeparateSettings(): boolean {
  return Boolean(
    clean(process.env.DATABASE_HOST) &&
      clean(process.env.DATABASE_USER) &&
      clean(process.env.DATABASE_NAME),
  );
}

function safeConfiguration() {
  const source = hasSeparateSettings() ? "DATABASE_*" : "DATABASE_URL";

  if (source === "DATABASE_*") {
    return {
      source,
      host: clean(process.env.DATABASE_HOST) || "missing",
      port: clean(process.env.DATABASE_PORT) || "3306",
      database: clean(process.env.DATABASE_NAME) || "missing",
      user: clean(process.env.DATABASE_USER) || "missing",
      passwordPresent: Boolean(clean(process.env.DATABASE_PASSWORD)),
      databaseUrlIgnoredBecauseSeparateSettingsExist: Boolean(
        clean(process.env.DATABASE_URL),
      ),
      activeRuntimeSource: clean(process.env.SIMAMIA_DATABASE_SOURCE) || source,
      activeTransport: clean(process.env.SIMAMIA_DATABASE_TRANSPORT) || "not-selected",
      preflightCode: clean(process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE) || "unknown",
    };
  }

  const databaseUrl = clean(process.env.DATABASE_URL);
  if (!databaseUrl) {
    return {
      source,
      host: "missing",
      port: "3306",
      database: "missing",
      user: "missing",
      passwordPresent: false,
      databaseUrlIgnoredBecauseSeparateSettingsExist: false,
      activeRuntimeSource: clean(process.env.SIMAMIA_DATABASE_SOURCE) || source,
      activeTransport: clean(process.env.SIMAMIA_DATABASE_TRANSPORT) || "not-selected",
      preflightCode: clean(process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE) || "unknown",
    };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      source,
      host: url.hostname || "missing",
      port: url.port || "3306",
      database: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "missing",
      user: decodeURIComponent(url.username) || "missing",
      passwordPresent: Boolean(url.password),
      databaseUrlIgnoredBecauseSeparateSettingsExist: false,
      activeRuntimeSource: clean(process.env.SIMAMIA_DATABASE_SOURCE) || source,
      activeTransport: clean(process.env.SIMAMIA_DATABASE_TRANSPORT) || "not-selected",
      preflightCode: clean(process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE) || "unknown",
    };
  } catch {
    return {
      source,
      host: "invalid DATABASE_URL",
      port: "3306",
      database: "unknown",
      user: "unknown",
      passwordPresent: false,
      databaseUrlIgnoredBecauseSeparateSettingsExist: false,
      activeRuntimeSource: clean(process.env.SIMAMIA_DATABASE_SOURCE) || source,
      activeTransport: clean(process.env.SIMAMIA_DATABASE_TRANSPORT) || "not-selected",
      preflightCode: clean(process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE) || "unknown",
    };
  }
}

function preflightFailureCode(): ReturnType<typeof classifyDatabaseError> | null {
  const value = clean(process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE);
  if (
    value === "DATABASE_AUTH_FAILED" ||
    value === "DATABASE_NOT_FOUND" ||
    value === "DATABASE_UNREACHABLE" ||
    value === "DATABASE_CONFIGURATION_INVALID"
  ) {
    return value;
  }
  return null;
}

export async function GET(): Promise<Response> {
  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1 AS ok`;

    return NextResponse.json(
      {
        success: true,
        message: "Hostinger MySQL connection is healthy.",
        configuration: safeConfiguration(),
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const errorCode = preflightFailureCode() ?? classifyDatabaseError(error);
    console.error("DATABASE_HEALTH_ERROR", {
      code: errorCode,
      diagnostic: databaseErrorDetails(error),
      configuration: safeConfiguration(),
    });

    return NextResponse.json(
      {
        success: false,
        errorCode,
        message:
          errorCode === "DATABASE_AUTH_FAILED"
            ? "MySQL rejected the active database credentials. Check the Runtime log for the exact transport MySQL saw (for example user@::1 versus a local socket/IPv4 connection)."
            : errorCode === "DATABASE_UNREACHABLE"
              ? "SIMAMIA could not establish a Hostinger MySQL transport. Check activeTransport/preflightCode and Runtime logs."
              : "Hostinger MySQL connection failed. Check errorCode and Runtime logs.",
        configuration: safeConfiguration(),
        checkedAt: new Date().toISOString(),
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
