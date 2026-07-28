import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const extensions = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
  ["text/csv", ".csv"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

export async function saveLocalUpload(input: {
  file: File;
  companyId: string;
  category: string;
  maxBytes?: number;
}) {
  const maxBytes = input.maxBytes ?? 12 * 1024 * 1024;
  if (input.file.size <= 0 || input.file.size > maxBytes) {
    throw new Error(`The file must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const extension = extensions.get(input.file.type);
  if (!extension) {
    throw new Error("Use JPG, PNG, WebP, PDF, CSV, XLS or XLSX.");
  }

  const safeCategory = input.category.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const directory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "accountant-control",
    input.companyId,
    safeCategory,
  );
  await mkdir(directory, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  await writeFile(
    path.join(directory, filename),
    Buffer.from(await input.file.arrayBuffer()),
  );

  return {
    url: `/uploads/accountant-control/${input.companyId}/${safeCategory}/${filename}`,
    originalName: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
  };
}
