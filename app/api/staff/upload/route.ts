import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireStaff,
} from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ORIGINAL_SIZE =
  25 * 1024 * 1024;

const MAX_PROFILE_SIZE =
  2 * 1024 * 1024;

const allowedKinds = new Set([
  "PROFILE",
  "RECEIPT",
  "PROOF",
  "EXPENSE",
  "BANK",
  "OTHER",
]);

const allowedMimeTypes =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);

function cleanText(
  value: unknown,
): string {
  return value === null ||
    value === undefined
    ? ""
    : String(value).trim();
}

function safeOriginalName(
  value: string,
): string {
  return (
    value
      .replace(/[^\w.\- ()]+/g, "_")
      .slice(0, 240) ||
    "upload"
  );
}

function extensionForMime(
  mimeType: string,
): string {
  if (
    mimeType === "image/jpeg"
  ) {
    return ".jpg";
  }

  if (
    mimeType === "image/png"
  ) {
    return ".png";
  }

  if (
    mimeType === "image/webp"
  ) {
    return ".webp";
  }

  if (
    mimeType ===
    "application/pdf"
  ) {
    return ".pdf";
  }

  return ".bin";
}

async function compressImage(
  input: Buffer,
  kind: string,
) {
  try {
    const sharpModule =
      await import("sharp");

    const sharp =
      sharpModule.default;

    const profile =
      kind === "PROFILE";

    const first =
      await sharp(input, {
        failOn: "none",
      })
        .rotate()
        .resize({
          width:
            profile
              ? 720
              : 1800,
          height:
            profile
              ? 720
              : 1800,
          fit: "inside",
          withoutEnlargement:
            true,
        })
        .webp({
          quality:
            profile
              ? 78
              : 82,
          effort: 4,
        })
        .toBuffer();

    if (
      profile &&
      first.length >
        MAX_PROFILE_SIZE
    ) {
      const second =
        await sharp(input, {
          failOn: "none",
        })
          .rotate()
          .resize({
            width: 520,
            height: 520,
            fit: "inside",
            withoutEnlargement:
              true,
          })
          .webp({
            quality: 68,
            effort: 5,
          })
          .toBuffer();

      return second;
    }

    return first;
  } catch (error) {
    console.warn(
      "STAFF_IMAGE_COMPRESSION_FALLBACK:",
      error,
    );

    return input;
  }
}

export async function POST(
  request: Request,
) {
  let writtenPath:
    string | null = null;

  try {
    const session =
      await requireStaff();

    const form =
      await request.formData();

    const file =
      form.get("file");

    const kind =
      cleanText(
        form.get("kind"),
      ).toUpperCase() ||
      "OTHER";

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Choose a file to upload.",
        },
        { status: 400 },
      );
    }

    if (!allowedKinds.has(kind)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected upload category is invalid.",
        },
        { status: 400 },
      );
    }

    if (
      !allowedMimeTypes.has(
        file.type,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only JPG, PNG, WEBP and PDF files are supported.",
        },
        { status: 415 },
      );
    }

    if (
      kind === "PROFILE" &&
      !file.type.startsWith(
        "image/",
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A profile image must be JPG, PNG or WEBP.",
        },
        { status: 415 },
      );
    }

    if (
      file.size <= 0 ||
      file.size >
        MAX_ORIGINAL_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The file must be between 1 byte and 25 MB.",
        },
        { status: 413 },
      );
    }

    const original =
      Buffer.from(
        await file.arrayBuffer(),
      );

    const shouldCompress =
      file.type.startsWith(
        "image/",
      );

    const compressedBuffer =
      shouldCompress
        ? await compressImage(
            original,
            kind,
          )
        : original;

    const useCompressed =
      shouldCompress &&
      compressedBuffer.length <
        original.length;

    const finalBuffer =
      useCompressed
        ? compressedBuffer
        : original;

    const finalMimeType =
      useCompressed
        ? "image/webp"
        : file.type;

    if (
      kind === "PROFILE" &&
      finalBuffer.length >
        MAX_PROFILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The profile image is still larger than 2 MB after compression. Choose a smaller image.",
        },
        { status: 413 },
      );
    }

    const extension =
      extensionForMime(
        finalMimeType,
      );

    const storedName =
      `${Date.now()}-${randomUUID()}${extension}`;

    const relativeDirectory =
      path.join(
        "storage",
        "private",
        "staff",
        String(
          session.companyId,
        ),
        String(session.id),
      );

    const absoluteDirectory =
      path.join(
        process.cwd(),
        relativeDirectory,
      );

    await mkdir(
      absoluteDirectory,
      {
        recursive: true,
      },
    );

    const relativePath =
      path
        .join(
          relativeDirectory,
          storedName,
        )
        .replaceAll("\\", "/");

    const absolutePath =
      path.join(
        process.cwd(),
        relativePath,
      );

    await writeFile(
      absolutePath,
      finalBuffer,
      {
        flag: "wx",
      },
    );

    writtenPath =
      absolutePath;

    const originalSizeBytes =
      original.length;

    const sizeBytes =
      finalBuffer.length;

    const compressionRatio =
      originalSizeBytes > 0
        ? Number(
            (
              (1 -
                sizeBytes /
                  originalSizeBytes) *
              100
            ).toFixed(2),
          )
        : 0;

    const checksumSha256 =
      createHash("sha256")
        .update(finalBuffer)
        .digest("hex");

    const record =
      await prisma.staffFile.create(
        {
          data: {
            companyId:
              String(
                session.companyId,
              ),
            ownerUserId:
              String(session.id),
            kind: kind as any,
            originalName:
              safeOriginalName(
                file.name,
              ),
            storedName,
            mimeType:
              finalMimeType,
            sizeBytes,
            originalSizeBytes,
            compressionRatio,
            compressed:
              useCompressed,
            checksumSha256,
            storagePath:
              relativePath,
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            originalSizeBytes:
              true,
            compressionRatio:
              true,
            compressed: true,
            createdAt: true,
          },
        },
      );

    return NextResponse.json(
      {
        success: true,
        message:
          useCompressed
            ? "The file was compressed and uploaded successfully."
            : "The file was uploaded successfully.",
        url:
          `/api/staff/files/${record.id}`,
        file: record,
      },
      { status: 201 },
    );
  } catch (error) {
    if (writtenPath) {
      await unlink(
        writtenPath,
      ).catch(() => undefined);
    }

    console.error(
      "STAFF_UPLOAD_ERROR:",
      error,
    );

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(
            (error as {
              code?: unknown;
            }).code ?? "",
          )
        : "";

    const details =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        message:
          code === "P2022"
            ? "The StaffFile database columns are not synchronized."
            : "The file could not be compressed and uploaded.",
        details:
          code === "P2022"
            ? "Run npx prisma db push, regenerate Prisma Client, clear .next and restart."
            : details,
        originalError:
          details,
      },
      { status: 500 },
    );
  }
}
