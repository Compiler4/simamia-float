import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { requireAccountant } from "@/lib/accountant/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024;
const allowedTypes = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
  ["text/csv", ".csv"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

export async function POST(request: Request) {
  try {
    const session = await requireAccountant();
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Choose a file to upload." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: "The file must be between 1 byte and 5 MB." },
        { status: 400 },
      );
    }

    const extension = allowedTypes.get(file.type);
    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message: "Allowed files: JPG, PNG, WebP, PDF, CSV, XLS and XLSX.",
        },
        { status: 400 },
      );
    }

    const directory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "accountant",
      session.companyId,
    );
    await mkdir(directory, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = path.join(directory, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(destination, bytes);

    return NextResponse.json({
      success: true,
      url: `/uploads/accountant/${session.companyId}/${filename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    console.error("[ACCOUNTANT_UPLOAD]", error);
    return NextResponse.json(
      { success: false, message: "The file could not be uploaded.", error: message },
      { status },
    );
  }
}
