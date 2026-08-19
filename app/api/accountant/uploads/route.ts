import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { type NextRequest, NextResponse } from "next/server";

import { requirePortalRole } from "@/lib/accountant/auth";
import { prisma } from "@/lib/prisma";
import { saveLocalUpload } from "@/lib/accountant/local-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());
const PUBLIC_UPLOAD_ROOT = path.join(PROJECT_ROOT, "public", "uploads");
const PRIVATE_STORAGE_ROOT = path.join(PROJECT_ROOT, "storage", "private");

const CONTENT_TYPES = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".pdf", "application/pdf"],
  [".csv", "text/csv; charset=utf-8"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

function inside(candidate: string, root: string) {
  const resolved = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
}

function safeName(value: string) {
  return path.basename(value).replaceAll('"', "").replaceAll("\r", "").replaceAll("\n", "");
}

function normalizeStoredPath(rawPath: string) {
  return rawPath
    .split("?")[0]
    .split("#")[0]
    .replaceAll("\\", "/")
    .trim();
}

function staffFileIdFromPath(rawPath: string) {
  const match = normalizeStoredPath(rawPath).match(/(?:^|\/)api\/staff\/files\/([^/]+)$/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function candidatePaths(rawPath: string, companyId: string, databasePaths: string[] = []) {
  const withoutQuery = normalizeStoredPath(rawPath);
  const normalized = withoutQuery.replace(/^\/+/, "");
  const candidates = new Set<string>();

  const add = (value: string) => {
    if (!value) return;
    const clean = normalizeStoredPath(value);
    const relative = clean.replace(/^\/+/, "");

    // Native absolute paths are useful when the app is running on the same host.
    if (path.isAbsolute(clean)) candidates.add(path.resolve(clean));

    // Historical database rows can contain Windows absolute paths.  On Linux,
    // use their relative/public tail and basename rather than treating C:/... as
    // a project-relative path.
    if (/^[A-Za-z]:\//.test(clean)) {
      const publicMarker = clean.toLowerCase().indexOf("/public/");
      const storageMarker = clean.toLowerCase().indexOf("/storage/");
      if (publicMarker >= 0) {
        candidates.add(path.resolve(PROJECT_ROOT, clean.slice(publicMarker + 1)));
      }
      if (storageMarker >= 0) {
        candidates.add(path.resolve(PROJECT_ROOT, clean.slice(storageMarker + 1)));
      }
    } else if (relative) {
      candidates.add(path.resolve(PROJECT_ROOT, relative));
      candidates.add(path.resolve(PROJECT_ROOT, "public", relative.replace(/^public\//, "")));
      candidates.add(path.resolve(PROJECT_ROOT, "storage", relative.replace(/^storage\//, "")));
    }
  };

  add(rawPath);
  for (const databasePath of databasePaths) add(databasePath);

  // Always try the safe company-scoped upload locations by basename.  This is
  // important after moving the project between Windows/XAMPP, Hostinger and
  // Linux/Vercel where the original absolute path is no longer meaningful.
  const names = new Set(
    [rawPath, ...databasePaths]
      .map((value) => path.basename(normalizeStoredPath(value)))
      .filter(Boolean),
  );
  for (const filename of names) {
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "accountant", companyId, filename));
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "accountant-control", companyId, "documents", filename));
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "accountant-control", companyId, "float-receipts", filename));
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "company-admin", companyId, filename));
    // Historical seed/admin verification records were stored in these shared
    // public folders before company-scoped uploads were introduced.
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "verification", filename));
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "proofs", filename));
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "expenses", filename));
    candidates.add(path.join(PUBLIC_UPLOAD_ROOT, "receipts", filename));
  }

  return Array.from(candidates).filter((candidate) => {
    if (inside(candidate, PUBLIC_UPLOAD_ROOT)) return true;
    if (inside(candidate, PRIVATE_STORAGE_ROOT)) return true;
    return false;
  });
}

function companyScoped(candidate: string, companyId: string) {
  const normalized = path.resolve(candidate).replaceAll("\\", "/");
  const companyMarker = `/${companyId}/`;
  const scopedRoots = [
    "/public/uploads/accountant/",
    "/public/uploads/accountant-control/",
    "/public/uploads/company-admin/",
    "/storage/private/staff/",
  ];
  if (!scopedRoots.some((root) => normalized.includes(root))) return true;
  return normalized.includes(companyMarker);
}

async function databaseFileHints(rawPath: string, companyId: string) {
  const normalized = normalizeStoredPath(rawPath);
  const basename = path.basename(normalized);
  const staffFileId = staffFileIdFromPath(normalized);
  const hints: string[] = [];
  let mimeType = "";
  let originalName = basename;

  try {
    const staffFile = staffFileId
      ? await prisma.staffFile.findFirst({
          where: { id: staffFileId, companyId },
          select: { storagePath: true, storedName: true, originalName: true, mimeType: true },
        })
      : basename
        ? await prisma.staffFile.findFirst({
            where: {
              companyId,
              OR: [
                { storedName: basename },
                { storagePath: normalized },
              ],
            },
            orderBy: { createdAt: "desc" },
            select: { storagePath: true, storedName: true, originalName: true, mimeType: true },
          })
        : null;

    if (staffFile) {
      hints.push(staffFile.storagePath, staffFile.storedName);
      mimeType = staffFile.mimeType || mimeType;
      originalName = staffFile.originalName || originalName;
    }
  } catch {
    // Older databases may not have the newest StaffFile columns yet.
  }

  try {
    const portalDocument = basename
      ? await prisma.portalDocument.findFirst({
          where: {
            companyId,
            OR: [
              { storedName: basename },
              { publicUrl: normalized },
              { storagePath: normalized },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { storagePath: true, publicUrl: true, storedName: true, originalName: true, mimeType: true },
        })
      : null;

    if (portalDocument) {
      hints.push(portalDocument.storagePath, portalDocument.publicUrl, portalDocument.storedName);
      mimeType = portalDocument.mimeType || mimeType;
      originalName = portalDocument.originalName || originalName;
    }
  } catch {
    // PortalDocument is optional on installations that have not run that migration.
  }

  return { hints: hints.filter(Boolean), mimeType, originalName };
}

export async function GET(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT", "COMPANY_ADMIN", "STAFF"]);
  if (auth.response || !auth.user) return auth.response!;

  const rawPath = String(
    request.nextUrl.searchParams.get("path") ||
      request.nextUrl.searchParams.get("url") ||
      "",
  ).trim();

  if (!rawPath || /^(https?:|blob:|data:|file:)/i.test(rawPath)) {
    return NextResponse.json(
      { success: false, message: "A local upload path is required." },
      { status: 422 },
    );
  }

  const companyId = String(auth.user.companyId || "");
  const dbFile = await databaseFileHints(rawPath, companyId);

  for (const candidate of candidatePaths(rawPath, companyId, dbFile.hints)) {
    if (!companyScoped(candidate, companyId)) continue;

    try {
      const info = await stat(candidate);
      if (!info.isFile()) continue;
      const content = await readFile(candidate);
      const responseName = safeName(dbFile.originalName || path.basename(candidate) || rawPath);
      return new NextResponse(new Uint8Array(content), {
        headers: {
          "Content-Type": dbFile.mimeType || CONTENT_TYPES.get(path.extname(candidate).toLowerCase()) || "application/octet-stream",
          "Content-Length": String(content.length),
          "Content-Disposition": `inline; filename="${responseName}"`,
          "Cache-Control": "private, max-age=120",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Try the next safe candidate path.
    }
  }

  return NextResponse.json(
    {
      success: false,
      message: "The uploaded document record exists, but the file is not present in durable storage on this server.",
      path: rawPath,
    },
    { status: 404 },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT", "COMPANY_ADMIN", "STAFF"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const category = String(form.get("category") ?? "documents").trim() || "documents";
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");

    const uploaded = await saveLocalUpload({
      file,
      companyId: String(auth.user.companyId),
      category,
      maxBytes: 12 * 1024 * 1024,
    });

    return NextResponse.json({ success: true, message: "Document uploaded successfully.", ...uploaded });
  } catch (error) {
    console.error("[ACCOUNTANT_UPLOAD]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "The file could not be uploaded." },
      { status: 400 },
    );
  }
}
