import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (entry.name.endsWith(".css")) files.push(target);
  }
  return files;
}

function fixCss(source) {
  const output = [];
  for (const line of source.split(/\r?\n/)) {
    if (/\bscrollbar-(width|color)\s*:/.test(line)) continue;

    const match = line.match(/^(\s*)backdrop-filter:\s*([^;]+);\s*$/);
    if (match) {
      const prefixLine = `${match[1]}-webkit-backdrop-filter: ${match[2]};`;
      if (output.at(-1)?.trim() !== prefixLine.trim()) output.push(prefixLine);
    }

    if (output.at(-1) === line) continue;
    output.push(line);
  }
  return output.join("\n");
}

const root = path.resolve(process.argv[2] || "app");
for (const file of await walk(root)) {
  const original = await readFile(file, "utf8");
  const updated = fixCss(original);
  if (updated !== original) {
    await writeFile(file, updated, "utf8");
    console.log(`Updated ${path.relative(process.cwd(), file)}`);
  }
}
