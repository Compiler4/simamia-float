import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${name} must be a positive integer. Received: ${value ?? "undefined"}`,
    );
  }

  return parsed;
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function adapterConfiguration() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    const url = new URL(databaseUrl);

    if (!["mysql:", "mariadb:"].includes(url.protocol)) {
      throw new Error(
        "DATABASE_URL must start with mysql:// or mariadb://.",
      );
    }

    const database = decodePart(
      url.pathname.replace(/^\/+/, ""),
    ).trim();

    if (!database) {
      throw new Error(
        "DATABASE_URL must include a database name.",
      );
    }

    return {
      host: url.hostname || "127.0.0.1",
      port: positiveInteger(
        url.port || undefined,
        3306,
        "DATABASE_URL port",
      ),
      user: decodePart(url.username || "root"),
      password: decodePart(url.password || ""),
      database,
      connectionLimit: positiveInteger(
        process.env.DATABASE_CONNECTION_LIMIT,
        5,
        "DATABASE_CONNECTION_LIMIT",
      ),
    };
  }

  return {
    host:
      process.env.DATABASE_HOST?.trim() ||
      "127.0.0.1",
    port: positiveInteger(
      process.env.DATABASE_PORT,
      3306,
      "DATABASE_PORT",
    ),
    user:
      process.env.DATABASE_USER?.trim() ||
      "root",
    password:
      process.env.DATABASE_PASSWORD ?? "",
    database:
      process.env.DATABASE_NAME?.trim() ||
      "simamia",
    connectionLimit: positiveInteger(
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
      "DATABASE_CONNECTION_LIMIT",
    ),
  };
}

const adapter = new PrismaMariaDb(
  adapterConfiguration(),
);

export const seedPrisma =
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
