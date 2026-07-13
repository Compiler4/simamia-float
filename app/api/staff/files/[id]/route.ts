import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) {
      return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    }
    if (!session.companyId) {
      return NextResponse.json({ success: false, message: "Company access is required." }, { status: 403 });
    }

    const { id } = await context.params;
    const file = await (db as any).staffFile.findFirst({
      where: { id, companyId: String(session.companyId) },
    });
    if (!file) {
      return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
    }

    const role = String(session.role || "");
    const isOwner = String(file.ownerUserId) === String(session.id);
    const isReviewer = ["ACCOUNTANT", "COMPANY_ADMIN"].includes(role);

    // Other staff, brokers, GPS managers, and unrelated roles can never open it.
    if (!isOwner && !isReviewer) {
      return NextResponse.json({ success: false, message: "You cannot access this file." }, { status: 403 });
    }

    const root = path.resolve(process.cwd());
    const absolutePath = path.resolve(root, String(file.storagePath));
    const allowedRoot = path.resolve(root, "storage", "private", "staff");
    if (!absolutePath.startsWith(`${allowedRoot}${path.sep}`)) {
      return NextResponse.json({ success: false, message: "Invalid file path." }, { status: 403 });
    }

    const content = await readFile(absolutePath);
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": String(file.mimeType),
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `inline; filename="${String(file.originalName).replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[STAFF_FILE_GET]", error);
    return NextResponse.json({ success: false, message: "The file could not be opened." }, { status: 500 });
  }
}
