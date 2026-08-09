import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

process.env.DATABASE_URL ||= process.env.PRISMA_GENERATE_DATABASE_URL ||
  "mysql://simamia:simamia@127.0.0.1:3306/simamia";

if (!existsSync(prismaCli)) {
  console.error("Prisma CLI was not found. Run npm install before generating the Prisma client.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [prismaCli, "generate", "--schema", "prisma/schema.prisma"],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
