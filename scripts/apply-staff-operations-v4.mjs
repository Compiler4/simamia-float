import fs from "node:fs";
import path from "node:path";

const projectPath = path.resolve(process.argv[2] || process.cwd());
const packagePath = path.join(projectPath, "package.json");

if (!fs.existsSync(packagePath)) {
  throw new Error(`package.json was not found in ${projectPath}`);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

packageJson.scripts = {
  ...(packageJson.scripts || {}),
  dev: packageJson.scripts?.dev || "next dev",
  build: packageJson.scripts?.build || "next build",
  start: packageJson.scripts?.start || "next start",
  typecheck: packageJson.scripts?.typecheck || "tsc --noEmit",
  "prisma:generate": "prisma generate",
  "db:sync": "prisma db push",
};

packageJson.dependencies = {
  ...(packageJson.dependencies || {}),
  "pdf-lib": packageJson.dependencies?.["pdf-lib"] || "^1.17.1",
  leaflet: packageJson.dependencies?.leaflet || "^1.9.4",
  "lucide-react": packageJson.dependencies?.["lucide-react"] || "^0.468.0",
  sharp: packageJson.dependencies?.sharp || "^0.34.3",
};

packageJson.devDependencies = {
  ...(packageJson.devDependencies || {}),
  "@types/leaflet": packageJson.devDependencies?.["@types/leaflet"] || "^1.9.21",
};

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const gitignorePath = path.join(projectPath, ".gitignore");
const existingGitignore = fs.existsSync(gitignorePath)
  ? fs.readFileSync(gitignorePath, "utf8")
  : "";

const requiredIgnoreLines = [
  "storage/private/staff/",
  "_staff_operations_v4_backup_*/",
];

let updatedGitignore = existingGitignore.trimEnd();
for (const line of requiredIgnoreLines) {
  if (!updatedGitignore.split(/\r?\n/).includes(line)) {
    updatedGitignore += `${updatedGitignore ? "\n" : ""}${line}`;
  }
}
fs.writeFileSync(gitignorePath, `${updatedGitignore}\n`);

const storagePath = path.join(projectPath, "storage", "private", "staff");
fs.mkdirSync(storagePath, { recursive: true });

console.log("package.json, .gitignore and private storage prepared.");
