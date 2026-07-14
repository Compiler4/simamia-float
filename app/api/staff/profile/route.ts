import {
  unlink,
} from "node:fs/promises";
import path from "node:path";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireStaff,
} from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(
  value: unknown,
): string {
  return value === null ||
    value === undefined
    ? ""
    : String(value).trim();
}

async function safeAudit(
  companyId: string,
  userId: string,
  action: string,
  details: string,
) {
  await prisma.auditLog
    .create({
      data: {
        companyId,
        userId,
        action,
        module:
          "STAFF_PROFILE",
        details,
      },
    })
    .catch((error) => {
      console.warn(
        "STAFF_PROFILE_AUDIT_WARNING:",
        error,
      );
    });
}

async function removeOldProfileFile(
  ownerUserId: string,
  oldUrl: string | null,
  newUrl: string,
) {
  if (
    !oldUrl ||
    oldUrl === newUrl
  ) {
    return;
  }

  const match =
    oldUrl.match(
      /^\/api\/staff\/files\/([^/?#]+)$/,
    );

  if (!match) {
    return;
  }

  const oldRecord =
    await prisma.staffFile.findFirst(
      {
        where: {
          id: match[1],
          ownerUserId,
          kind: "PROFILE",
        },
      },
    );

  if (!oldRecord) {
    return;
  }

  await prisma.staffFile
    .delete({
      where: {
        id: oldRecord.id,
      },
    })
    .catch(() => undefined);

  const absolutePath =
    path.resolve(
      process.cwd(),
      oldRecord.storagePath,
    );

  const storageRoot =
    path.resolve(
      process.cwd(),
      "storage",
      "private",
      "staff",
    );

  if (
    absolutePath.startsWith(
      `${storageRoot}${path.sep}`,
    )
  ) {
    await unlink(
      absolutePath,
    ).catch(() => undefined);
  }
}

export async function POST(
  request: Request,
) {
  try {
    const session =
      await requireStaff();

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "The request body must contain valid JSON.",
        },
        { status: 400 },
      );
    }

    const action =
      cleanText(
        body.action,
      ).toUpperCase();

    const currentUser =
      await prisma.user.findFirst({
        where: {
          id: String(
            session.id,
          ),
          companyId: String(
            session.companyId,
          ),
          role: "STAFF",
          status: "ACTIVE",
        },
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The active staff account was not found.",
        },
        { status: 404 },
      );
    }

    if (
      action ===
      "UPDATE_PROFILE_IMAGE"
    ) {
      const profileImageUrl =
        cleanText(
          body.profileImageUrl,
        );

      const match =
        profileImageUrl.match(
          /^\/api\/staff\/files\/([^/?#]+)$/,
        );

      if (!match) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Upload a valid profile image first.",
          },
          { status: 400 },
        );
      }

      const file =
        await prisma.staffFile.findFirst(
          {
            where: {
              id: match[1],
              companyId:
                String(
                  session.companyId,
                ),
              ownerUserId:
                String(
                  session.id,
                ),
              kind: "PROFILE",
              mimeType: {
                startsWith:
                  "image/",
              },
            },
          },
        );

      if (!file) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The uploaded profile image does not belong to this account.",
          },
          { status: 403 },
        );
      }

      const updated =
        await prisma.user.update({
          where: {
            id: currentUser.id,
          },
          data: {
            profileImageUrl,
          },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profileImageUrl:
              true,
            updatedAt: true,
          },
        });

      await safeAudit(
        String(session.companyId),
        String(session.id),
        "UPDATE_PROFILE_IMAGE",
        `Profile image changed to StaffFile ${file.id}.`,
      );

      await removeOldProfileFile(
        currentUser.id,
        currentUser.profileImageUrl,
        profileImageUrl,
      );

      return NextResponse.json({
        success: true,
        message:
          "Profile image updated successfully.",
        user: updated,
      });
    }

    if (
      action ===
      "UPDATE_USERNAME"
    ) {
      const username =
        cleanText(
          body.username,
        ).toLowerCase();

      const currentPassword =
        cleanText(
          body.currentPassword,
        );

      if (
        !/^[a-z0-9._-]{3,40}$/.test(
          username,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Username must contain 3–40 lowercase letters, numbers, dots, underscores or hyphens.",
          },
          { status: 400 },
        );
      }

      const passwordCorrect =
        await bcrypt.compare(
          currentPassword,
          currentUser.passwordHash,
        );

      if (!passwordCorrect) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The current password is incorrect.",
          },
          { status: 403 },
        );
      }

      const duplicate =
        await prisma.user.findFirst({
          where: {
            username,
            NOT: {
              id: currentUser.id,
            },
          },
          select: {
            id: true,
          },
        });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "That username is already in use.",
          },
          { status: 409 },
        );
      }

      const updated =
        await prisma.user.update({
          where: {
            id: currentUser.id,
          },
          data: {
            username,
          },
          select: {
            id: true,
            username: true,
            updatedAt: true,
          },
        });

      await safeAudit(
        String(session.companyId),
        String(session.id),
        "UPDATE_USERNAME",
        `Username changed from ${currentUser.username} to ${username}.`,
      );

      return NextResponse.json({
        success: true,
        message:
          "Username updated successfully.",
        user: updated,
      });
    }

    if (
      action ===
      "CHANGE_PASSWORD"
    ) {
      const currentPassword =
        cleanText(
          body.currentPassword,
        );

      const newPassword =
        cleanText(
          body.newPassword,
        );

      const confirmPassword =
        cleanText(
          body.confirmPassword,
        );

      if (
        newPassword !==
        confirmPassword
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The new password and confirmation do not match.",
          },
          { status: 400 },
        );
      }

      if (
        newPassword.length < 8 ||
        !/[A-Z]/.test(
          newPassword,
        ) ||
        !/[a-z]/.test(
          newPassword,
        ) ||
        !/[0-9]/.test(
          newPassword,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The password must contain at least 8 characters, uppercase, lowercase and a number.",
          },
          { status: 400 },
        );
      }

      const passwordCorrect =
        await bcrypt.compare(
          currentPassword,
          currentUser.passwordHash,
        );

      if (!passwordCorrect) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The current password is incorrect.",
          },
          { status: 403 },
        );
      }

      const samePassword =
        await bcrypt.compare(
          newPassword,
          currentUser.passwordHash,
        );

      if (samePassword) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The new password must be different from the current password.",
          },
          { status: 400 },
        );
      }

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          12,
        );

      await prisma.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          passwordHash,
        },
      });

      await safeAudit(
        String(session.companyId),
        String(session.id),
        "CHANGE_PASSWORD",
        "The staff user changed their password.",
      );

      return NextResponse.json({
        success: true,
        message:
          "Password changed successfully.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "This profile action is not supported.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "STAFF_PROFILE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "The profile operation could not be completed.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}
