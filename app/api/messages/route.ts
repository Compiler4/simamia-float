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

    const db = prisma as any;

    await db.message.updateMany({
      where: {
        id,
        receiverId: user.id,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Message marked as read.",
    });
  } catch (error) {
    console.error("READ_MESSAGE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to mark message as read.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}