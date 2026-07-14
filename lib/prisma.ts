import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

type PrismaGlobal = typeof globalThis & {
  __simamiaStaffPortalPrismaV3?: PrismaClient;
};

type MariaDbConfig =
  ConstructorParameters<typeof PrismaMariaDb>[0];

function required(
  name: string,
  value: string | undefined,
): string {
  const result = value?.trim();

  if (!result) {
    throw new Error(
      `Missing database setting ${name}. Add DATABASE_URL or the DATABASE_* variables to .env.`,
    );
  }

  return result;
}

function positiveNumber(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `${name} must be a positive number.`,
    );
  }

  return parsed;
}

function configFromDatabaseUrl(
  databaseUrl: string,
): MariaDbConfig {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL is invalid. Use mysql://USER:PASSWORD@HOST:3306/DATABASE.",
    );
  }

  if (
    url.protocol !== "mysql:" &&
    url.protocol !== "mariadb:"
  ) {
    throw new Error(
      "DATABASE_URL must start with mysql:// or mariadb://.",
    );
  }

  const database = decodeURIComponent(
    url.pathname.replace(/^\/+/, ""),
  );

  return {
    host: required(
      "DATABASE_HOST",
      url.hostname,
    ),
    port: positiveNumber(
      "DATABASE_PORT",
      url.port,
      3306,
    ),
    user: required(
      "DATABASE_USER",
      decodeURIComponent(url.username),
    ),
    password: decodeURIComponent(
      url.password,
    ),
    database: required(
      "DATABASE_NAME",
      database,
    ),
    connectionLimit: positiveNumber(
      "DATABASE_CONNECTION_LIMIT",
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
    ),
  };
}

function getMariaDbConfig(): MariaDbConfig {
  const databaseUrl =
    process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return configFromDatabaseUrl(
      databaseUrl,
    );
  }

  return {
    host: required(
      "DATABASE_HOST",
      process.env.DATABASE_HOST,
    ),
    port: positiveNumber(
      "DATABASE_PORT",
      process.env.DATABASE_PORT,
      3306,
    ),
    user: required(
      "DATABASE_USER",
      process.env.DATABASE_USER,
    ),
    password:
      process.env.DATABASE_PASSWORD ?? "",
    database: required(
      "DATABASE_NAME",
      process.env.DATABASE_NAME,
    ),
    connectionLimit: positiveNumber(
      "DATABASE_CONNECTION_LIMIT",
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
    ),
  };
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb(
    getMariaDbConfig(),
  );

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const prismaGlobal =
  globalThis as PrismaGlobal;

export const prisma =
  prismaGlobal.__simamiaStaffPortalPrismaV3 ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__simamiaStaffPortalPrismaV3 =
    prisma;
}

export default prisma;
