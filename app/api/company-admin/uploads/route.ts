import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import {
  createNotification,
  requireCompanyMember,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";
import { analyseProofFile } from "@/lib/proof-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const COMPRESS_IMAGE_ABOVE = 900 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const allowedKinds = new Set([
  "PROFILE_IMAGE",
  "SMS_SCREENSHOT",
  "BANK_SLIP",
  "BANK_RECEIPT",
  "BANK_STATEMENT",
  "PDF",
  "DOCUMENT",
  "IMAGE",
  "SERVICE_PROOF",
  "EXPENSE_RECEIPT",
  "SIGNATURE",
  "OTHER",
]);

const proofKinds = new Set([
  "SMS_SCREENSHOT",
  "BANK_SLIP",
  "BANK_RECEIPT",
  "BANK_STATEMENT",
  "SERVICE_PROOF",
]);

const UPLOAD_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "uploads",
  "company-admin",
);

function safeExtension(name: string, mimeType: string): string {
  const extension = path.extname(name).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(extension)) return extension;
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "application/pdf") return ".pdf";
  return ".bin";
}

function cleanLinkId(value: FormDataEntryValue | null): string | null {
  const result = typeof value === "string" ? value.trim() : "";
  return result || null;
}

async function prepareImage(
  source: Buffer,
  mimeType: string,
): Promise<{ bytes: Buffer; extension: string; compressed: boolean }> {
  if (source.byteLength <= COMPRESS_IMAGE_ABOVE) {
    return {
      bytes: source,
      extension:
        mimeType === "image/png"
          ? ".png"
          : mimeType === "image/webp"
            ? ".webp"
            : ".jpg",
      compressed: false,
    };
  }

  const pipeline = sharp(source, { failOn: "none" }).rotate().resize({
    width: 2000,
    height: 2000,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (mimeType === "image/png") {
    return {
      bytes: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
      extension: ".png",
      compressed: true,
    };
  }

  return {
    bytes: await pipeline.webp({ quality: 82, effort: 5 }).toBuffer(),
    extension: ".webp",
    compressed: true,
  };
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
        "Only JPG, PNG, WEBP, PDF, TXT, DOC, DOCX, CSV and Excel files are allowed.",
        415,
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new HttpError("The file must be between 1 byte and 20 MB.", 413);
    }

    const requestedKind = text(formData.get("kind")).toUpperCase();
    const kind = allowedKinds.has(requestedKind) ? requestedKind : "OTHER";
    const brokerCustomerId = cleanLinkId(formData.get("brokerCustomerId"));
    const bankVerificationId = cleanLinkId(formData.get("bankVerificationId"));
    const serviceVisitId = cleanLinkId(formData.get("serviceVisitId"));

    const originalBytes = Buffer.from(await file.arrayBuffer());
    let bytes: Uint8Array = originalBytes;
    let extension = safeExtension(file.name, file.type);
    let compressed = false;

    if (file.type.startsWith("image/")) {
      const prepared = await prepareImage(originalBytes, file.type);
      bytes = prepared.bytes;
      extension = prepared.extension;
      compressed = prepared.compressed;
    }

    const folder = path.join(UPLOAD_ROOT, companyId);
    await mkdir(folder, { recursive: true });

    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const storagePath = path.join(folder, storedName);
    await writeFile(storagePath, bytes);

    const publicUrl = `/uploads/company-admin/${companyId}/${storedName}`;
    const checksumSha256 = crypto
      .createHash("sha256")
      .update(await readFile(storagePath))
      .digest("hex");

    const initial = proofKinds.has(kind)
      ? await analyseProofFile(storagePath, file.type)
      : null;

    const db = prisma as any;
    const document = await db.portalDocument.create({
      data: {
        companyId,
        uploadedById: user.id,
        brokerCustomerId,
        bankVerificationId,
        serviceVisitId,
        kind,
        originalName: file.name,
        storedName,
        mimeType: file.type,
        sizeBytes: bytes.byteLength,
        originalSizeBytes: originalBytes.byteLength,
        compressed,
        checksumSha256,
        storagePath,
        publicUrl,
        extractedText: initial?.extractedText || null,
        proofStatus: initial?.status || "PENDING",
        missingFieldsJson: initial
          ? JSON.stringify({ missing: initial.missing, detected: initial.detected })
          : null,
        analyzedAt: initial ? new Date() : null,
      },
    });

    if (initial?.status === "INSUFFICIENT") {
      await createNotification({
        companyId,
        targetUserId: user.id,
        title: "Insufficient transaction proof",
        message: `${user.name}, ${initial.note}`,
        type: "WARNING",
        link: "/dashboard",
      });

      await createNotification({
        companyId,
        targetRole: "COMPANY_ADMIN",
        title: "Insufficient proof uploaded",
        message: `${user.name} uploaded ${file.name}. ${initial.note}`,
        type: "BANK",
        link: "/admin/dashboard?section=bank",
      });
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      document,
      proofAnalysis: initial,
      filename: file.name,
      mimeType: file.type,
      originalSize: originalBytes.byteLength,
      storedSize: bytes.byteLength,
      compressed,
    });
  } catch (error) {
    return routeError(error);
  }
}
