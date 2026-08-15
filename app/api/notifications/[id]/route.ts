import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    await prisma.notification.updateMany({
      where: {
        id,
        userId: user.id,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("READ_NOTIFICATION_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to mark notification as read.",
      },
      { status: 500 }
    );
  }
}