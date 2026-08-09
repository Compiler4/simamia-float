import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

function positiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function configFromEnv() {
  const urlValue = process.env.DATABASE_URL?.trim();

  if (urlValue) {
    const url = new URL(urlValue);
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    return {
      host: url.hostname || "127.0.0.1",
      port: positiveInt(url.port, 3306),
      user: decodeURIComponent(url.username || "root"),
      password: decodeURIComponent(url.password || ""),
      database,
      connectionLimit: 2,
    };
  }

  return {
    host: process.env.DATABASE_HOST?.trim() || "127.0.0.1",
    port: positiveInt(process.env.DATABASE_PORT, 3306),
    user: process.env.DATABASE_USER?.trim() || "root",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME?.trim() || "simamia",
    connectionLimit: 2,
  };
}

const requiredColumns = [
  "profileImageUrl",
  "assignedRegion",
  "nidaNumber",
  "dateOfBirth",
  "gender",
  "nationality",
  "physicalAddress",
];

const adapter = new PrismaMariaDb(configFromEnv());
const prisma = new PrismaClient({ adapter });

try {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME AS columnName
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'`,
  );

  const existing = new Set(rows.map((row) => String(row.columnName)));
  const missing = requiredColumns.filter((column) => !existing.has(column));

  console.log("User columns found:", [...existing].sort().join(", "));

  if (missing.length > 0) {
    console.error("Missing User columns:", missing.join(", "));
    process.exitCode = 1;
  } else {
    console.log("All required User columns are present.");
  }
} finally {
  await prisma.$disconnect();
}
