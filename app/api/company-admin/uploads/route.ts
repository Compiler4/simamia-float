import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  requireCompanyMember,
  routeError,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeExtension(name: string) {
  const ext = path.extname(name).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyMember();
    const companyId = user.companyId as string;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new HttpError("Choose a file to upload.", 422);
    }

    if (!allowedTypes.has(file.type)) {
      throw new HttpError(
        "Only JPG, PNG, WEBP, PDF, CSV and Excel files are allowed.",
        415,
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new HttpError("The maximum file size is 10 MB.", 413);
    }

    const folder = path.join(
      process.cwd(),
      "public",
      "uploads",
      "company-admin",
      companyId,
    );
    await mkdir(folder, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}${safeExtension(file.name)}`;
    const destination = path.join(folder, filename);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(destination, bytes);

    return NextResponse.json({
      success: true,
      url: `/uploads/company-admin/${companyId}/${filename}`,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    return routeError(error);
  }
}
