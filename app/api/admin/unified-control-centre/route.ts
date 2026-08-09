import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set([
  "COMPANY_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM_DEVELOPER",
]);

const MAX_SIZE = 15 * 1024 * 1024;
const EXTENSIONS = new Map<string, string>([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["text/plain", ".txt"],
  ["text/csv", ".csv"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

const UPLOAD_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "uploads",
  "company-admin",
);

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function safeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication is required." },
        { status: 401 },
      );
    }

    const role = text(session.role).toUpperCase();
    if (!ADMIN_ROLES.has(role) || !session.companyId) {
      return NextResponse.json(
        { success: false, message: "Company Admin access is required." },
        { status: 403 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Choose a file to upload." },
        { status: 400 },
      );
    }

    if (!file.size || file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "The file must be larger than 0 bytes and no more than 15 MB.",
        },
        { status: 413 },
      );
    }

    const extension = EXTENSIONS.get(file.type);
    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unsupported file type. Use PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX, CSV or TXT.",
        },
        { status: 415 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const companyId = text(session.companyId);
    const originalName = safeName(file.name) || `document${extension}`;
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const relativeDirectory = path.join(
      "uploads",
      "company-admin",
      companyId,
      "verification",
    );
    const absoluteDirectory = path.join(UPLOAD_ROOT, companyId, "verification");
    const absolutePath = path.join(absoluteDirectory, storedName);

    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(absolutePath, bytes);

    const publicUrl = `/${relativeDirectory.replaceAll(path.sep, "/")}/${storedName}`;
    const kind = file.type === "application/pdf"
      ? "PDF"
      : file.type.startsWith("image/")
        ? "IMAGE"
        : "DOCUMENT";

    const document = await (prisma as any).portalDocument.create({
      data: {
        companyId,
        uploadedById: text(session.id),
        kind,
        originalName,
        storedName,
        mimeType: file.type,
        sizeBytes: file.size,
        originalSizeBytes: file.size,
        compressed: false,
        checksumSha256: checksum,
        storagePath: absolutePath,
        publicUrl,
        proofStatus: "PENDING",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "The verification document was uploaded.",
        url: publicUrl,
        originalName,
        document,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[UNIFIED_CONTROL_UPLOAD]", error);
    return NextResponse.json(
      {
        success: false,
        message: "The document could not be uploaded.",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
