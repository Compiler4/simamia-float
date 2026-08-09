import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;

    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const temporaryPassword = `Temp@${Math.floor(
      100000 + Math.random() * 900000
    )}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: {
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        companyId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: updatedUser.companyId,
        action: "PASSWORD_RESET",
        module: "USER",
        details: `${user.name} reset password for ${updatedUser.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully.",
      temporaryPassword,
      user: updatedUser,
    });
  } catch (error) {
    console.error("RESET_PASSWORD_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset password.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}