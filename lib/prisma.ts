import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  variableName: string,
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${variableName} must be a positive integer. Received: ${
        value ?? "undefined"
      }`,
    );
  }

  return parsed;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: readPositiveInteger(
      process.env.DATABASE_PORT,
      3306,
      "DATABASE_PORT",
    ),
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "simamia",
    connectionLimit: readPositiveInteger(
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
      "DATABASE_CONNECTION_LIMIT",
    ),
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
