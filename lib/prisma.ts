import "server-only";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function positiveInteger(
  value: string | undefined,
  fallback: number,
  variableName: string,
): number {
  const cleaned = value?.trim();

  if (!cleaned) {
    return fallback;
  }

  const parsed = Number(cleaned);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${variableName} must be a positive integer. Received: ${cleaned}`,
    );
  }

  return parsed;
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function adapterFromDatabaseUrl(databaseUrl: string): PrismaMariaDb {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL is invalid. Expected a value such as mysql://root:@127.0.0.1:3306/simamia",
    );
  }

  if (!["mysql:", "mariadb:"].includes(parsed.protocol)) {
    throw new Error(
      `DATABASE_URL must use mysql:// or mariadb://. Received ${parsed.protocol}`,
    );
  }

  const database = decodeUrlPart(
    parsed.pathname.replace(/^\/+/, ""),
  ).trim();

  if (!database) {
    throw new Error(
      "DATABASE_URL must include the database name, for example /simamia.",
    );
  }

  return new PrismaMariaDb({
    host: parsed.hostname || "127.0.0.1",
    port: positiveInteger(
      parsed.port,
      3306,
      "DATABASE_URL port",
    ),
    user: decodeUrlPart(parsed.username) || "root",
    password: decodeUrlPart(parsed.password),
    database,
    connectionLimit: positiveInteger(
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
      "DATABASE_CONNECTION_LIMIT",
    ),
  });
}

function adapterFromIndividualVariables(): PrismaMariaDb {
  const isProduction = process.env.NODE_ENV === "production";

  const host =
    process.env.DATABASE_HOST?.trim() || "127.0.0.1";

  const user =
    process.env.DATABASE_USER?.trim() || "root";

  const database =
    process.env.DATABASE_NAME?.trim() || "simamia";

  /*
   * Local XAMPP normally uses:
   * host     = 127.0.0.1
   * user     = root
   * password = empty
   * database = simamia
   *
   * Production must provide explicit database configuration.
   */
  if (
    isProduction &&
    (!process.env.DATABASE_HOST?.trim() ||
      !process.env.DATABASE_USER?.trim() ||
      !process.env.DATABASE_NAME?.trim())
  ) {
    throw new Error(
      "Production database configuration is incomplete. Provide DATABASE_URL or DATABASE_HOST, DATABASE_USER and DATABASE_NAME.",
    );
  }

  return new PrismaMariaDb({
    host,
    port: positiveInteger(
      process.env.DATABASE_PORT,
      3306,
      "DATABASE_PORT",
    ),
    user,
    password: process.env.DATABASE_PASSWORD ?? "",
    database,
    connectionLimit: positiveInteger(
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
      "DATABASE_CONNECTION_LIMIT",
    ),
  });
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  const adapter = databaseUrl
    ? adapterFromDatabaseUrl(databaseUrl)
    : adapterFromIndividualVariables();

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;