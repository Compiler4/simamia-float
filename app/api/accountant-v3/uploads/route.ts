import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/accountant-v3/guard";
import { jsonError } from "@/lib/accountant-v3/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".txt",
  ".csv",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
]);

const UPLOAD_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "uploads",
  "accountant-v3",
);

function safeExtension(file: File) {
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  return ext && ext.length <= 8 ? ext : "";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["STAFF", "ACCOUNTANT", "COMPANY_ADMIN"]);
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) throw new Error("Choose a file to upload.");
    if (!file.size) throw new Error("The selected file is empty.");
    if (file.size > MAX_BYTES) throw new Error("The file must not exceed 15 MB.");
    const extension = safeExtension(file);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Allowed files are PDF, Word, image, text, CSV and Excel.");
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      throw new Error("The uploaded file type is not allowed.");
    }

    const relativeDirectory = path.join(
      "uploads",
      "accountant-v3",
      safeSegment(user.companyId),
      safeSegment(user.role.toLowerCase()),
    );
    const absoluteDirectory = path.join(
      UPLOAD_ROOT,
      safeSegment(user.companyId),
      safeSegment(user.role.toLowerCase()),
    );
    await mkdir(absoluteDirectory, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(absoluteDirectory, filename), bytes);

    const url = `/${relativeDirectory.replaceAll(path.sep, "/")}/${filename}`;
    return NextResponse.json({
      success: true,
      url,
      originalName: file.name,
      size: file.size,
      message: "File uploaded successfully.",
    });
  } catch (error) {
    return jsonError(error, "The file could not be uploaded.");
  }
}
