import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest } from "next/server";

import { db } from "@/lib/db";
import {
  PortalError,
  audit,
  errorResponse,
  requireAccountant,
  safeQuery,
  text,
} from "@/lib/accountant/portal";

const prisma = db as any;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
  ["text/csv", ".csv"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

function documentKind(mime: string): string {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime === "application/pdf") return "PDF";
  return "DOCUMENT";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const context = await requireAccountant();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new PortalError("Choose a file to upload.", 422);
    }
    if (!ALLOWED.has(file.type)) {
      throw new PortalError(
        "Unsupported file type. Use JPG, PNG, WebP, PDF, CSV, XLS or XLSX.",
        415,
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      throw new PortalError("The file must be between 1 byte and 10 MB.", 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const extension = ALLOWED.get(file.type) || path.extname(file.name).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const relativeDirectory = path.join("uploads", "accountant", context.companyId);
    const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    const storagePath = path.join(absoluteDirectory, storedName);
    await writeFile(storagePath, bytes);

    const publicUrl = `/${relativeDirectory.replaceAll(path.sep, "/")}/${storedName}`;
    const category = text(form.get("category")).trim();

    const document = await safeQuery(
      "portalDocument.create",
      () =>
        prisma.portalDocument.create({
          data: {
            companyId: context.companyId,
            uploadedById: context.accountantId,
            kind: category === "bank-statements" ? "BANK_STATEMENT" : documentKind(file.type),
            originalName: file.name,
            storedName,
            mimeType: file.type,
            sizeBytes: file.size,
            originalSizeBytes: file.size,
            compressed: false,
            checksumSha256,
            storagePath,
            publicUrl,
            proofStatus: "PENDING",
          },
        }),
      null,
    );

    await audit(context, "UPLOAD_DOCUMENT", "DOCUMENTS", {
      documentId: document?.id,
      originalName: file.name,
      publicUrl,
      sizeBytes: file.size,
    });

    return Response.json({
      success: true,
      message: "Document uploaded successfully.",
      url: publicUrl,
      documentId: document?.id || null,
      file: {
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        checksumSha256,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
