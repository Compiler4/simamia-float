import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("The broker auto-visit radius must be a positive integer.");
  }
  return parsed;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.`);
  return value;
}

const adapter = new PrismaMariaDb({
  host: required("DATABASE_HOST"),
  port: positiveInteger(process.env.DATABASE_PORT, 3306),
  user: required("DATABASE_USER"),
  password: process.env.DATABASE_PASSWORD ?? "",
  database: required("DATABASE_NAME"),
  connectionLimit: 2,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const companyCode = String(process.argv[2] ?? "SIMAMIA").trim().toUpperCase();
  const radius = positiveInteger(process.argv[3], 150);

  const company = await prisma.company.findUnique({
    where: { code: companyCode },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error(`Company ${companyCode} was not found.`);
  }

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: company.id,
        key: "BROKER_AUTO_VISIT_RADIUS_METERS",
      },
    },
    create: {
      companyId: company.id,
      key: "BROKER_AUTO_VISIT_RADIUS_METERS",
      value: String(radius),
    },
    update: {
      value: String(radius),
    },
  });

  console.log(`${company.name}: broker auto-visit radius set to ${radius} metres.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
