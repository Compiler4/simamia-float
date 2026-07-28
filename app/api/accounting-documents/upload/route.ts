import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import {
  asPortalError,
  PortalHttpError,
  requirePortalRole,
} from "@/lib/accountant-control/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxSize = 12 * 1024 * 1024;
const allowed = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
  ["text/csv", ".csv"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalRole(["ACCOUNTANT", "COMPANY_ADMIN"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new PortalHttpError("Choose a file.", 400);
    if (file.size <= 0 || file.size > maxSize) {
      throw new PortalHttpError("The file must be smaller than 12 MB.", 400);
    }
    const extension = allowed.get(file.type);
    if (!extension) {
      throw new PortalHttpError("Use JPG, PNG, WebP, PDF, CSV, XLS or XLSX.", 415);
    }

    const folder = path.join(process.cwd(), "public", "uploads", "accounting-control", session.companyId);
    await mkdir(folder, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(path.join(folder, filename), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      success: true,
      message: "Document uploaded.",
      url: `/uploads/accounting-control/${session.companyId}/${filename}`,
      originalName: file.name,
    });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
