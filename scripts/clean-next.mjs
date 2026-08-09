import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const generatedPaths = [
  ".next",
  ".turbo",
  path.join("node_modules", ".cache"),
  "tsconfig.tsbuildinfo",
];

for (const relativePath of generatedPaths) {
  const absolutePath = path.join(root, relativePath);

  try {
    await rm(absolutePath, { recursive: true, force: true });
    console.log(`Removed: ${relativePath}`);
  } catch (error) {
    console.error(`Could not remove ${relativePath}:`, error);
    process.exitCode = 1;
  }
}
