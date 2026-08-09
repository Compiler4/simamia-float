import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const receiverId = String(body.receiverId || "");
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!receiverId || !subject || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "Receiver, subject and message are required.",
        },
        { status: 400 }
      );
    }

    const db = prisma as any;

    const savedMessage = await db.message.create({
      data: {
        companyId: user.companyId,
        senderId: user.id,
        receiverId,
        subject,
        body: message,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully.",
      data: savedMessage,
    });
  } catch (error) {
    console.error("SEND_MESSAGE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send message.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}