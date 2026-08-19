import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".csv",
  ".json",
  ".docx",
  ".xlsx",
  ".xls",
]);

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "text/",
];

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

function clean(value: unknown): string {
  return text(value).trim();
}

function safeFileName(value: string): string {
  const name = path.basename(value || "upload");
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "upload";
}

function safeKind(value: unknown): string {
  return (
    clean(value)
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "OTHER"
  );
}

function extensionOf(fileName: string): string {
  return path.extname(fileName || "").toLowerCase();
}

function isAllowedMime(file: File): boolean {
  const mime = clean(file.type).toLowerCase();

  if (!mime) {
    // Some browsers/Windows file pickers leave MIME blank.
    // Extension validation still applies below.
    return true;
  }

  if (ALLOWED_MIME_TYPES.has(mime)) {
    return true;
  }

  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function assertMultipartRequest(request: NextRequest) {
  const contentType =
    request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.startsWith("multipart/form-data")) {
    throw new HttpError(
      "File upload requires multipart/form-data. Send the file using FormData and do not manually set the Content-Type header.",
      415,
    );
  }

  // A valid browser-generated multipart request should contain a boundary.
  if (!contentType.includes("boundary=")) {
    throw new HttpError(
      "The multipart request is missing its boundary. Remove any manually-set Content-Type header and let fetch/FormData create it automatically.",
      415,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = clean(user.companyId);

    if (!companyId) {
      throw new HttpError(
        "Your Company Admin account is not connected to a company.",
        403,
      );
    }

    assertMultipartRequest(request);

    let form: FormData;

    try {
      form = await request.formData();
    } catch (error) {
      console.error("[COMPANY_ADMIN_UPLOAD_FORMDATA_ERROR]", error);

      throw new HttpError(
        "The uploaded form could not be parsed. Send the selected file using a FormData object.",
        400,
      );
    }

    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new HttpError("Choose a file to upload.", 422);
    }

    if (!file.name || !clean(file.name)) {
      throw new HttpError("The uploaded file must have a filename.", 422);
    }

    if (!file.size) {
      throw new HttpError("The selected file is empty.", 422);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new HttpError("The uploaded file cannot exceed 10 MB.", 413);
    }

    const extension = extensionOf(file.name);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new HttpError(
        "Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF, TXT, CSV, JSON, DOCX, XLSX and XLS.",
        415,
      );
    }

    if (!isAllowedMime(file)) {
      throw new HttpError(
        `Unsupported MIME type: ${file.type || "unknown"}.`,
        415,
      );
    }

    const kind = safeKind(form.get("kind"));

    // Collect optional linking values without assuming your Prisma document schema.
    const links: Record<string, string> = {};

    for (const [key, value] of form.entries()) {
      if (key === "file" || key === "kind") {
        continue;
      }

      if (typeof value === "string" && clean(value)) {
        links[key] = clean(value);
      }
    }

    const originalName = safeFileName(file.name);
    const storedName =
      `${Date.now()}-${randomUUID()}${extension}`;

    const relativeDir = path.posix.join(
      "uploads",
      "company-admin",
      companyId,
    );

    const absoluteDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "company-admin",
      companyId,
    );

    await mkdir(absoluteDir, {
      recursive: true,
    });

    const absolutePath = path.join(
      absoluteDir,
      storedName,
    );

    const bytes = Buffer.from(
      await file.arrayBuffer(),
    );

    await writeFile(
      absolutePath,
      bytes,
    );

    const publicUrl =
      `/${relativeDir}/${storedName}`;

    const document = {
      id: randomUUID(),
      companyId,
      uploadedById: user.id,
      uploadedBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      originalName,
      storedName,
      kind,
      mimeType:
        file.type ||
        "application/octet-stream",
      sizeBytes: file.size,
      publicUrl,
      url: publicUrl,
      storagePath: publicUrl,
      compressed: false,
      proofStatus: "PENDING",
      extractedText: null,
      links,
      createdAt: new Date().toISOString(),
    };

    // Upload success must not be turned into a failure just because
    // optional audit logging has a problem.
    try {
      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: "UPLOAD_DOCUMENT",
        module: "DOCUMENTS",
        details:
          `Uploaded ${originalName} as ${kind}.`,
      });
    } catch (auditError) {
      console.error(
        "[COMPANY_ADMIN_UPLOAD_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `${originalName} uploaded successfully.`,
        url: publicUrl,
        document,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}
