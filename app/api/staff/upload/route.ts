import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowed = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
]);

const kinds: Record<string, string> = {
  profile: "PROFILE",
  receipt: "RECEIPT",
  proof: "PROOF",
  expense: "EXPENSE",
  bank: "BANK",
  other: "OTHER",
};

function safeOriginalName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 240) || "upload";
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedKind = String(formData.get("kind") ?? "receipt").toLowerCase();
    const kind = kinds[requestedKind] || "OTHER";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Choose a file to upload." },
        { status: 400 },
      );
    }
    if (!allowed.has(file.type)) {
      return NextResponse.json(
        { success: false, message: "Only JPG, PNG, WEBP, and PDF files are allowed." },
        { status: 400 },
      );
    }
    if (kind === "PROFILE" && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "A profile file must be an image." },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "The file must be between 1 byte and 8 MB." },
        { status: 400 },
      );
    }

    const extension = allowed.get(file.type)!;
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
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
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()), {
      flag: "wx",
    });

    const record = await (db as any).staffFile.create({
      data: {
        companyId: session.companyId,
        ownerUserId: session.id,
        kind,
        originalName: safeOriginalName(file.name),
        storedName,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath: relativePath.replaceAll("\\", "/"),
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      fileId: record.id,
      url: `/api/staff/files/${record.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Staff access is required." }, { status: 403 });
    }
    console.error("[STAFF_UPLOAD]", error);
    return NextResponse.json(
      { success: false, message: "The file could not be uploaded." },
      { status: 500 },
    );
  }
}
