import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_STORAGE_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  "storage",
  "private",
  "staff",
);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json(
      {
        success: false,
        message: "Authentication is required.",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const record = await prisma.staffFile.findUnique({
    where: { id },
  });

  if (!record) {
    return Response.json(
      {
        success: false,
        message: "The requested file was not found.",
      },
      { status: 404 },
    );
  }

  const role = String(user.role).toUpperCase();
  const platformPrivileged = [
    "SYSTEM_DEVELOPER",
    "SUPER_ADMIN",
  ].includes(role);

  const companyReviewer = [
    "COMPANY_ADMIN",
    "ACCOUNTANT",
    "GPS_MANAGER",
  ].includes(role);

  const sameCompany =
    Boolean(user.companyId) &&
    String(user.companyId) === String(record.companyId);

  const ownFile =
    String(record.ownerUserId) === String(user.id);

  /*
   * Staff/Broker users may preview only their own private files.
   * Company Admin/Accountant/GPS Manager may review files belonging
   * to their own company. Platform administrators retain access.
   */
  const allowed =
    platformPrivileged ||
    ownFile ||
    (companyReviewer && sameCompany);

  if (!allowed) {
    return Response.json(
      {
        success: false,
        message: "You cannot access this private staff file.",
      },
      { status: 403 },
    );
  }

  const normalizedStoragePath = record.storagePath.replaceAll("\\", "/");
  const storagePrefix = "storage/private/staff/";

  if (!normalizedStoragePath.startsWith(storagePrefix)) {
    return Response.json(
      {
        success: false,
        message: "The stored file path is invalid.",
      },
      { status: 400 },
    );
  }

  const absolutePath = path.resolve(
    STAFF_STORAGE_ROOT,
    normalizedStoragePath.slice(storagePrefix.length),
  );

  if (
    !absolutePath.startsWith(
      `${STAFF_STORAGE_ROOT}${path.sep}`,
    )
  ) {
    return Response.json(
      {
        success: false,
        message: "The stored file path is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const content = await readFile(absolutePath);
    const safeName = record.originalName
      .replaceAll('"', "")
      .replaceAll("\r", "")
      .replaceAll("\n", "");

    const body = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Length": String(content.length),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=120",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      {
        success: false,
        message:
          "The file exists in the database but is missing from private storage.",
      },
      { status: 404 },
    );
  }
}
