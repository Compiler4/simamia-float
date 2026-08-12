import "dotenv/config";

import { defineConfig } from "prisma/config";

const SAFE_TOOLING_DATABASE_URL =
  "mysql://simamia:simamia@127.0.0.1:3306/simamia";

function isSchemaOnlyCommand(): boolean {
  return process.argv.some((argument) =>
    ["generate", "validate", "format"].includes(argument),
  );
}

function databaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const toolingUrl = process.env.PRISMA_GENERATE_DATABASE_URL?.trim();
  if (toolingUrl) return toolingUrl;

  if (isSchemaOnlyCommand()) return SAFE_TOOLING_DATABASE_URL;

  throw new Error(
    "DATABASE_URL is required for Prisma database commands. Add a hosted MySQL/MariaDB DATABASE_URL to .env.local or Vercel Environment Variables.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: databaseUrl(),
  },
});
