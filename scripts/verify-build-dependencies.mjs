import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

const required = [
  ["next", "next/dist/bin/next"],
  ["react", "react"],
  ["react-dom", "react-dom"],
  ["prisma", "prisma/build/index.js"],
  ["@prisma/client", "@prisma/client"],
  ["typescript", "typescript"],
];

const missing = [];
for (const [label, id] of required) {
  try {
    require.resolve(id);
  } catch {
    missing.push(label);
  }
}

if (missing.length > 0) {
  console.error(
    `BUILD_DEPENDENCIES_MISSING: ${missing.join(", ")}. Run npm install before npm run build.`,
  );
  process.exit(1);
}

const postcssConfigs = [
  "postcss.config.js",
  "postcss.config.cjs",
  "postcss.config.mjs",
  "postcss.config.ts",
];

for (const file of postcssConfigs) {
  if (existsSync(resolve(process.cwd(), file))) {
    console.error(
      `UNEXPECTED_POSTCSS_CONFIG: ${file}. This deployment intentionally uses plain CSS/CSS Modules and does not require Tailwind/PostCSS.`,
    );
    process.exit(1);
  }
}

const globalsPath = resolve(process.cwd(), "app", "globals.css");
if (existsSync(globalsPath)) {
  const globals = readFileSync(globalsPath, "utf8");
  if (/(@import\s+["']tailwindcss["']|@tailwind\b|@apply\b)/.test(globals)) {
    console.error(
      "TAILWIND_DIRECTIVE_FOUND: app/globals.css still depends on Tailwind. Remove the directive or restore the Tailwind build dependency.",
    );
    process.exit(1);
  }
}

console.log("BUILD_DEPENDENCIES_OK");
console.log("PLAIN_CSS_MODE_OK");
