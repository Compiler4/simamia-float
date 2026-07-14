import {
  readFile,
} from "node:fs/promises";
import path from "node:path";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return Response.json(
      {
        success: false,
        message:
          "Authentication is required.",
      },
      { status: 401 },
    );
  }

  const { id } =
    await context.params;

  const record =
    await prisma.staffFile.findUnique(
      {
        where: {
          id,
        },
      },
    );

  if (!record) {
    return Response.json(
      {
        success: false,
        message:
          "The requested file was not found.",
      },
      { status: 404 },
    );
  }

  const privileged =
    [
      "SYSTEM_DEVELOPER",
      "SUPER_ADMIN",
    ].includes(
      String(user.role),
    );

  const sameCompany =
    Boolean(user.companyId) &&
    String(user.companyId) ===
      String(record.companyId);

  if (
    !privileged &&
    !sameCompany
  ) {
    return Response.json(
      {
        success: false,
        message:
          "You cannot access this file.",
      },
      { status: 403 },
    );
  }

  const storageRoot =
    path.resolve(
      process.cwd(),
      "storage",
      "private",
      "staff",
    );

  const absolutePath =
    path.resolve(
      process.cwd(),
      record.storagePath,
    );

  if (
    !absolutePath.startsWith(
      `${storageRoot}${path.sep}`,
    )
  ) {
    return Response.json(
      {
        success: false,
        message:
          "The stored file path is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const content =
      await readFile(
        absolutePath,
      );

    return new Response(content, {
      headers: {
        "Content-Type":
          record.mimeType,
        "Content-Length":
          String(content.length),
        "Content-Disposition":
          `inline; filename="${record.originalName.replaceAll('"', "")}"`,
        "Cache-Control":
          "private, max-age=300",
        "X-Content-Type-Options":
          "nosniff",
      },
    });
  } catch {
    return Response.json(
      {
        success: false,
        message:
          "The file exists in the database but is missing from storage.",
      },
      { status: 404 },
    );
  }
}
