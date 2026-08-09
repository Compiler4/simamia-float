import { createHash } from "crypto";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export type UploadKind =
  | "PROFILE"
  | "RECEIPT"
  | "PROOF"
  | "EXPENSE"
  | "BANK"
  | "OTHER";

export type CompressedUpload = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalSizeBytes: number;
  sizeBytes: number;
  compressed: boolean;
  compressionRatio: number;
  checksumSha256: string;
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_PROFILE_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENT_OUTPUT_BYTES = 12 * 1024 * 1024;

function ratio(original: number, output: number): number {
  if (original <= 0) return 0;
  return Number((((original - output) / original) * 100).toFixed(2));
}

function checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function compressImage(
  input: Buffer,
  kind: UploadKind,
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  const pipeline = sharp(input, {
    failOn: "none",
    limitInputPixels: 50_000_000,
  }).rotate();

  if (kind === "PROFILE") {
    const buffer = await pipeline
      .resize(640, 640, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: true,
      })
      .webp({ quality: 78, effort: 5, smartSubsample: true })
      .toBuffer();

    return {
      buffer,
      mimeType: "image/webp",
      extension: ".webp",
    };
  }

  const buffer = await pipeline
    .resize(1800, 1800, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toBuffer();

  return {
    buffer,
    mimeType: "image/webp",
    extension: ".webp",
  };
}

async function compressPdf(
  input: Buffer,
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  // Re-saving with object streams provides safe, lossless structural compression.
  // It preserves the document's pages and embedded content.
  const document = await PDFDocument.load(input, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  const output = Buffer.from(
    await document.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 40,
    }),
  );

  return {
    buffer: output.length < input.length ? output : input,
    mimeType: "application/pdf",
    extension: ".pdf",
  };
}

export async function prepareStaffUpload(input: {
  file: File;
  kind: UploadKind;
}): Promise<CompressedUpload> {
  const { file, kind } = input;

  if (file.size <= 0) {
    throw new Error("EMPTY_FILE");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const original = Buffer.from(await file.arrayBuffer());
  let prepared: { buffer: Buffer; mimeType: string; extension: string };

  if (file.type.startsWith("image/")) {
    prepared = await compressImage(original, kind);
  } else if (file.type === "application/pdf") {
    prepared = await compressPdf(original);
  } else {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  const outputLimit =
    kind === "PROFILE"
      ? MAX_PROFILE_OUTPUT_BYTES
      : MAX_DOCUMENT_OUTPUT_BYTES;

  if (prepared.buffer.length > outputLimit) {
    throw new Error(
      kind === "PROFILE"
        ? "PROFILE_OUTPUT_TOO_LARGE"
        : "DOCUMENT_OUTPUT_TOO_LARGE",
    );
  }

  return {
    ...prepared,
    originalSizeBytes: original.length,
    sizeBytes: prepared.buffer.length,
    compressed: prepared.buffer.length < original.length || prepared.mimeType !== file.type,
    compressionRatio: ratio(original.length, prepared.buffer.length),
    checksumSha256: checksum(prepared.buffer),
  };
}
