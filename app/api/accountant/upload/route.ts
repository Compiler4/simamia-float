import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  AccountantHttpError,
  accountantRouteError,
  requireAccountant,
} from "@/lib/accountant-server";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

export async function POST(request: NextRequest) {
  try {
    const accountant = await requireAccountant(true);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AccountantHttpError(
        "Choose a bank statement or receipt file.",
        422,
      );
    }

    if (!allowedTypes.has(file.type)) {
      throw new AccountantHttpError(
        "Only PDF, Excel, CSV, JPG, PNG and WEBP files are allowed.",
        415,
      );
    }

    if (file.size > 12 * 1024 * 1024) {
      throw new AccountantHttpError(
        "The maximum file size is 12 MB.",
        413,
      );
    }

    const folder = path.join(
      process.cwd(),
      "public",
      "uploads",
      "accounting",
      accountant.companyId,
    );

    await mkdir(folder, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}${safeExtension(
      file.name,
    )}`;
    const destination = path.join(folder, filename);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(destination, bytes);

    return NextResponse.json({
      success: true,
      url: `/uploads/accounting/${accountant.companyId}/${filename}`,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    return accountantRouteError(error);
  }
}
