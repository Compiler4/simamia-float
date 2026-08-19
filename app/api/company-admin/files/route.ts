import {
  access,
  readFile,
  stat,
} from "fs/promises";

import path from "path";

import {
  NextRequest,
} from "next/server";

import {
  requireCompanyMember,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

function clean(
  value: unknown,
): string {
  return text(value).trim();
}

function storageRoot(): string {
  const configured =
    clean(
      process.env
        .UPLOAD_STORAGE_ROOT,
    );

  if (configured) {
    return path.resolve(
      configured,
    );
  }

  /*
   * IMPORTANT:
   * Keep uploaded files outside .next.
   *
   * .next is disposable.
   */
  return path.resolve(
    process.cwd(),
    "storage",
  );
}

function normalizeSlash(
  value: string,
) {
  return value.replace(
    /\\/g,
    "/",
  );
}

function safeUploadPath(
  value: string,
): string {
  const raw =
    normalizeSlash(
      clean(value),
    );

  if (!raw) {
    throw new HttpError(
      "Document path is required.",
      400,
    );
  }

  if (
    raw.includes("\0")
  ) {
    throw new HttpError(
      "Invalid document path.",
      400,
    );
  }

  /*
   * Standard DB path:
   *
   * /uploads/portal/file.pdf
   */
  if (
    raw.startsWith("/")
  ) {
    const normalized =
      path.posix.normalize(
        raw,
      );

    if (
      !normalized.startsWith(
        "/uploads/",
      )
    ) {
      throw new HttpError(
        "Only registered upload paths can be viewed.",
        403,
      );
    }

    return normalized.slice(
      1,
    );
  }

  /*
   * Older Windows absolute paths.
   */
  if (
    /^[A-Za-z]:\//.test(
      raw,
    )
  ) {
    return raw;
  }

  throw new HttpError(
    "Invalid uploaded document path.",
    400,
  );
}

function isInside(
  parent: string,
  child: string,
): boolean {
  const relative =
    path.relative(
      path.resolve(parent),
      path.resolve(child),
    );

  return (
    relative === "" ||
    (
      !relative.startsWith(
        "..",
      ) &&
      !path.isAbsolute(
        relative,
      )
    )
  );
}

function candidateFiles(
  requestedPath: string,
): string[] {
  const safePath =
    safeUploadPath(
      requestedPath,
    );

  /*
   * Legacy Windows absolute file path.
   */
  if (
    /^[A-Za-z]:\//.test(
      safePath,
    )
  ) {
    const absolute =
      path.resolve(
        safePath,
      );

    const allowedRoots = [
      process.cwd(),
      storageRoot(),
    ];

    if (
      !allowedRoots.some(
        (root) =>
          isInside(
            root,
            absolute,
          ),
      )
    ) {
      throw new HttpError(
        "Document path is outside the allowed application storage.",
        403,
      );
    }

    return [
      absolute,
    ];
  }

  /*
   * Try new durable storage first,
   * then old locations.
   */
  return Array.from(
    new Set([
      path.resolve(
        storageRoot(),
        safePath,
      ),

      path.resolve(
        process.cwd(),
        "storage",
        safePath,
      ),

      path.resolve(
        process.cwd(),
        "public",
        safePath,
      ),
    ]),
  );
}

async function findFile(
  requestedPath: string,
): Promise<string | null> {
  const candidates =
    candidateFiles(
      requestedPath,
    );

  for (
    const candidate of candidates
  ) {
    try {
      const info =
        await stat(
          candidate,
        );

      if (
        info.isFile()
      ) {
        await access(
          candidate,
        );

        return candidate;
      }
    } catch {
      /*
       * Try next location.
       */
    }
  }

  return null;
}

function contentType(
  filePath: string,
): string {
  const extension =
    path
      .extname(
        filePath,
      )
      .toLowerCase();

  const map:
    Record<
      string,
      string
    > = {
      ".pdf":
        "application/pdf",

      ".png":
        "image/png",

      ".jpg":
        "image/jpeg",

      ".jpeg":
        "image/jpeg",

      ".webp":
        "image/webp",

      ".gif":
        "image/gif",

      ".txt":
        "text/plain; charset=utf-8",

      ".csv":
        "text/csv; charset=utf-8",

      ".json":
        "application/json; charset=utf-8",

      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      ".xls":
        "application/vnd.ms-excel",
    };

  return (
    map[extension] ||
    "application/octet-stream"
  );
}

function safeFilename(
  filePath: string,
): string {
  return path
    .basename(
      filePath,
    )
    .replace(
      /["\r\n]/g,
      "_",
    );
}

async function resolveFile(
  request: NextRequest,
) {
  await requireCompanyMember([
    "COMPANY_ADMIN",
    "ACCOUNTANT",
    "STAFF",
  ]);

  const requestedPath =
    clean(
      request.nextUrl
        .searchParams
        .get("path"),
    );

  if (!requestedPath) {
    throw new HttpError(
      "Document path is required.",
      400,
    );
  }

  const absolutePath =
    await findFile(
      requestedPath,
    );

  if (!absolutePath) {
    throw new HttpError(
      "The uploaded document record exists, but the file is not present in durable storage on this server.",
      404,
    );
  }

  const info =
    await stat(
      absolutePath,
    );

  return {
    absolutePath,
    info,
    type:
      contentType(
        absolutePath,
      ),
  };
}

/* ============================================================
   HEAD

   Used by Preview modal to check whether the
   real physical file exists.
============================================================ */

export async function HEAD(
  request: NextRequest,
) {
  try {
    const resolved =
      await resolveFile(
        request,
      );

    return new Response(
      null,
      {
        status: 200,

        headers: {
          "Content-Type":
            resolved.type,

          "Content-Length":
            String(
              resolved
                .info
                .size,
            ),

          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    const status =
      Number(
        (error as any)
          ?.status ||
          (error as any)
            ?.statusCode ||
          404,
      );

    const message =
      error instanceof Error
        ? error.message
        : "Document unavailable.";

    return new Response(
      null,
      {
        status,

        headers: {
          "Cache-Control":
            "no-store",

          "X-Document-Error":
            encodeURIComponent(
              message,
            ),
        },
      },
    );
  }
}

/* ============================================================
   GET

   Actual View / Preview endpoint.
============================================================ */

export async function GET(
  request: NextRequest,
) {
  try {
    const resolved =
      await resolveFile(
        request,
      );

    const bytes =
      await readFile(
        resolved.absolutePath,
      );

    return new Response(
      new Uint8Array(
        bytes,
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            resolved.type,

          "Content-Length":
            String(
              bytes.length,
            ),

          "Content-Disposition":
            `inline; filename="${safeFilename(
              resolved.absolutePath,
            )}"`,

          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    return routeError(
      error,
    );
  }
}