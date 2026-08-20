import {
  mkdir,
  writeFile,
} from "fs/promises";

import path from "path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAudit,
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

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

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

  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "storage",
  );
}

function assertMultipart(
  request: NextRequest,
) {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ||
    "";

  if (
    !contentType.startsWith(
      "multipart/form-data",
    ) ||
    !contentType.includes(
      "boundary=",
    )
  ) {
    throw new HttpError(
      "Replacement proof must be sent using FormData. Do not manually set the Content-Type header.",
      415,
    );
  }
}

function targetPath(
  value: unknown,
) {
  const raw =
    clean(value)
      .replace(
        /\\/g,
        "/",
      );

  if (
    !raw.startsWith(
      "/uploads/",
    )
  ) {
    throw new HttpError(
      "Only existing /uploads/... document paths can be restored.",
      422,
    );
  }

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
      "Invalid document path.",
      422,
    );
  }

  const relative =
    normalized.slice(
      1,
    );

  const root =
    storageRoot();

  const absolute =
    path.resolve(
      root,
      relative,
    );

  const difference =
    path.relative(
      root,
      absolute,
    );

  if (
    difference.startsWith(
      "..",
    ) ||
    path.isAbsolute(
      difference,
    )
  ) {
    throw new HttpError(
      "Invalid document storage path.",
      422,
    );
  }

  return {
    raw:
      normalized,

    absolute,
  };
}

export async function POST(
  request: NextRequest,
) {
  try {
    const user =
      await requireCompanyMember([
        "COMPANY_ADMIN",
        "ACCOUNTANT",
      ]);

    const companyId =
      clean(
        user.companyId,
      );

    if (!companyId) {
      throw new HttpError(
        "Your account is not connected to a company.",
        403,
      );
    }

    assertMultipart(
      request,
    );

    const form =
      await request.formData();

    const file =
      form.get(
        "file",
      );

    const pathValue =
      form.get(
        "path",
      );

    if (
      !(file instanceof File)
    ) {
      throw new HttpError(
        "Choose the original proof file to restore.",
        422,
      );
    }

    if (
      !file.size ||
      file.size >
        MAX_FILE_SIZE
    ) {
      throw new HttpError(
        "Replacement proof must be between 1 byte and 10 MB.",
        413,
      );
    }

    const target =
      targetPath(
        pathValue,
      );

    /*
     * Do not let a .pdf DB record suddenly
     * become a JPG, etc.
     */
    const expectedExtension =
      path
        .extname(
          target.absolute,
        )
        .toLowerCase();

    const uploadedExtension =
      path
        .extname(
          file.name,
        )
        .toLowerCase();

    if (
      expectedExtension &&
      uploadedExtension &&
      expectedExtension !==
        uploadedExtension
    ) {
      throw new HttpError(
        `Select a ${expectedExtension} file because the existing document record uses that file type.`,
        422,
      );
    }

    await mkdir(
      path.dirname(
        target.absolute,
      ),
      {
        recursive:
          true,
      },
    );

    const bytes =
      Buffer.from(
        await file.arrayBuffer(),
      );

    await writeFile(
      target.absolute,
      bytes,
    );

    try {
      await createAudit({
        companyId,

        actorId:
          user.id,

        actorName:
          user.name,

        actorRole:
          user.role,

        action:
          "RESTORE_MISSING_DOCUMENT",

        module:
          "DOCUMENTS",

        details:
          `Restored missing file ${target.raw} using ${file.name}.`,
      });
    } catch (
      auditError
    ) {
      console.error(
        "[RESTORE_DOCUMENT_AUDIT_ERROR]",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Original proof restored successfully.",

        path:
          target.raw,

        sizeBytes:
          bytes.length,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return routeError(
      error,
    );
  }
}