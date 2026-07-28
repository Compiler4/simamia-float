// Use this only when your existing lib/prisma.ts is missing or broken.
// Adjust the generated-client import if your generator output differs.
import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function integer(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Invalid positive database integer setting.");
  return parsed;
}

function createClient() {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: integer(process.env.DATABASE_PORT, 3306),
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "simamia",
    connectionLimit: integer(process.env.DATABASE_CONNECTION_LIMIT, 5),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
