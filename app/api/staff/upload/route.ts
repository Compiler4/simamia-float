import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  prepareStaffUpload,
  type UploadKind,
} from "@/lib/staff/file-compression";
import { requireStaff } from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const kinds: Record<string, UploadKind> = {
  profile: "PROFILE",
  receipt: "RECEIPT",
  proof: "PROOF",
  expense: "EXPENSE",
  bank: "BANK",
  other: "OTHER",
};

function safeOriginalName(name: string): string {
  return (
    name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 240) ||
    "upload"
  );
}

function uploadError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "UNKNOWN_ERROR";

  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Please sign in."],
    FORBIDDEN: [403, "Staff access is required."],
    STAFF_COMPANY_REQUIRED: [
      403,
      "Your staff account is not attached to a company.",
    ],
    EMPTY_FILE: [400, "The selected file is empty."],
    FILE_TOO_LARGE: [
      413,
      "The original file is larger than 25 MB. Choose a smaller file.",
    ],
    UNSUPPORTED_FILE_TYPE: [
      400,
      "Only JPG, PNG, WEBP, and PDF files are supported.",
    ],
    PROFILE_OUTPUT_TOO_LARGE: [
      413,
      "The profile image is still too large after compression.",
    ],
    DOCUMENT_OUTPUT_TOO_LARGE: [
      413,
      "The document is still larger than 12 MB after compression.",
    ],
  };

  if (known[message]) {
    return NextResponse.json(
      { success: false, message: known[message][1] },
      { status: known[message][0] },
    );
  }

  console.error("[STAFF_UPLOAD]", error);

  return NextResponse.json(
    {
      success: false,
      message: "The file could not be compressed and uploaded.",
      error:
        process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedKind = String(
      formData.get("kind") ?? "receipt",
    ).toLowerCase();
    const kind = kinds[requestedKind] ?? "OTHER";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Choose a file to upload." },
        { status: 400 },
      );
    }

    if (!acceptedTypes.has(file.type)) {
      throw new Error("UNSUPPORTED_FILE_TYPE");
    }

    if (kind === "PROFILE" && !file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          message: "A profile file must be an image.",
        },
        { status: 400 },
      );
    }

    const prepared = await prepareStaffUpload({ file, kind });
    const storedName = `${Date.now()}-${randomUUID()}${prepared.extension}`;
    const relativePath = path.join(
      "storage",
      "private",
      "staff",
      session.companyId,
      session.id,
      storedName,
    );
    const absolutePath = path.join(process.cwd(), relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, prepared.buffer, { flag: "wx" });

    const record = await (db as any).staffFile.create({
      data: {
        companyId: session.companyId,
        ownerUserId: session.id,
        kind,
        originalName: safeOriginalName(file.name),
        storedName,
        mimeType: prepared.mimeType,
        sizeBytes: prepared.sizeBytes,
        originalSizeBytes: prepared.originalSizeBytes,
        compressionRatio: prepared.compressionRatio,
        compressed: prepared.compressed,
        checksumSha256: prepared.checksumSha256,
        storagePath: relativePath.replaceAll("\\", "/"),
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        originalSizeBytes: true,
        compressionRatio: true,
        compressed: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      fileId: record.id,
      url: `/api/staff/files/${record.id}`,
      file: record,
      message: record.compressed
        ? `File compressed by ${Number(record.compressionRatio ?? 0).toFixed(1)}% and uploaded.`
        : "File uploaded successfully.",
    });
  } catch (error) {
    return uploadError(error);
  }
}
