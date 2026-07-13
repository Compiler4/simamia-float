import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createNotification,
  requireCompanyMember,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyMember();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const message = text(body.message).trim();
    if (!message) throw new HttpError("Write a message first.", 422);

    const verification = await db.companyBankVerification.findFirst({
      where: { id, companyId },
    });

    if (!verification) {
      throw new HttpError("Bank verification record not found.", 404);
    }

    const created = await db.companyBankMessage.create({
      data: {
        verificationId: id,
        companyId,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        message,
      },
    });

    const targetUserId =
      user.id === verification.uploadedById
        ? null
        : verification.uploadedById;

    await createNotification({
      companyId,
      targetUserId,
      targetRole: targetUserId ? null : "COMPANY_ADMIN",
      title: "New bank review message",
      message: `${user.name}: ${message.slice(0, 120)}`,
      type: "MESSAGE",
      link: "/admin/dashboard?section=bank",
    });

    return NextResponse.json({ success: true, message: created });
  } catch (error) {
    return routeError(error);
  }
}
