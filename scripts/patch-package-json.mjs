import fs from "node:fs";
import path from "node:path";

const projectRoot =
  path.resolve(
    process.argv[2] ||
      process.cwd(),
  );

const packagePath =
  path.join(
    projectRoot,
    "package.json",
  );

if (!fs.existsSync(packagePath)) {
  throw new Error(
    `package.json was not found in ${projectRoot}`,
  );
}

const packageJson =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

packageJson.scripts = {
  ...(packageJson.scripts || {}),
  "db:migrate:deploy":
    "prisma migrate deploy",
  "db:schema:sync":
    "prisma db push",
  "db:generate":
    "prisma generate",
  "db:seed:all":
    "node scripts/run-all-seeds.mjs",
  "db:seed:data":
    "tsx prisma/seed-data-folder.ts",
  "db:seed:verify":
    "tsx prisma/verify-seeded-data.ts",
  "db:import:agents":
    "tsx prisma/import-float-agents-json.ts",
  "db:import:bank":
    "tsx prisma/import-bank-statement-json.ts"
};

packageJson.dependencies = {
  ...(packageJson.dependencies || {}),
  "@prisma/adapter-mariadb":
    packageJson.dependencies?.[
      "@prisma/adapter-mariadb"
    ] || "^7.8.0",
  "dotenv":
    packageJson.dependencies?.dotenv ||
    "^17.2.1",
  "mariadb":
    packageJson.dependencies?.mariadb ||
    "^3.4.5"
};

packageJson.devDependencies = {
  ...(packageJson.devDependencies || {}),
  "tsx":
    packageJson.devDependencies?.tsx ||
    "^4.20.3"
};

packageJson.prisma = {
  ...(packageJson.prisma || {}),
  seed:
    "node scripts/run-all-seeds.mjs"
};

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(
    packageJson,
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  "package.json seed scripts and dependencies were merged.",
);
