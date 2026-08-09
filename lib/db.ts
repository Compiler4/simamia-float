import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

type PrismaGlobal = typeof globalThis & {
  __simamiaPrisma?: PrismaClient;
};

type MariaDbConfig = ConstructorParameters<typeof PrismaMariaDb>[0];

function isBuildOnlyPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function required(name: string, value: string | undefined, fallback: string): string {
  const cleaned = value?.trim();
  if (cleaned) return cleaned;

  if (isBuildOnlyPhase()) return fallback;

  throw new Error(
    `Missing database setting ${name}. Add DATABASE_URL or the DATABASE_* variables to .env.`,
  );
}

function numberSetting(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (!value?.trim()) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function configFromDatabaseUrl(databaseUrl: string): MariaDbConfig {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL is invalid. Use mysql://USER:PASSWORD@HOST:3306/DATABASE.",
    );
  }

  if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
    throw new Error("DATABASE_URL must start with mysql:// or mariadb://.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  return {
    host: required("DATABASE_HOST", url.hostname, "127.0.0.1"),
    port: numberSetting("DATABASE_PORT", url.port, 3306),
    user: required("DATABASE_USER", decodeURIComponent(url.username), "root"),
    password: decodeURIComponent(url.password),
    database: required("DATABASE_NAME", database, "simamia"),
    connectionLimit: numberSetting(
      "DATABASE_CONNECTION_LIMIT",
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
    ),
  };
}

function getMariaDbConfig(): MariaDbConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return configFromDatabaseUrl(databaseUrl);
  }

  return {
    host: required("DATABASE_HOST", process.env.DATABASE_HOST, "127.0.0.1"),
    port: numberSetting("DATABASE_PORT", process.env.DATABASE_PORT, 3306),
    user: required("DATABASE_USER", process.env.DATABASE_USER, "root"),
    password: process.env.DATABASE_PASSWORD ?? "",
    database: required("DATABASE_NAME", process.env.DATABASE_NAME, "simamia"),
    connectionLimit: numberSetting(
      "DATABASE_CONNECTION_LIMIT",
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
    ),
  };
}

function createDatabaseClient(): PrismaClient {
  const adapter = new PrismaMariaDb(getMariaDbConfig());

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const prismaGlobal = globalThis as PrismaGlobal;

/**
 * Reuse one Prisma Client while Next.js/Turbopack hot-reloads in development.
 * This prevents a new MariaDB connection pool from being created on every edit.
 */
export const db = prismaGlobal.__simamiaPrisma ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__simamiaPrisma = db;
}

// Compatibility aliases for files that import either `db` or `prisma`.
export const prisma = db;
export default db;
