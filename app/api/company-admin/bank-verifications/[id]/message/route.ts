import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
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
    const user = await requireCompanyMember([
      "COMPANY_ADMIN",
      "ACCOUNTANT",
      "STAFF",
    ]);
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const message = text(body.message).trim();
    const db = prisma as any;

    if (message.length < 3) {
      throw new HttpError("Write a clear bank-review message first.", 422);
    }

    const verification = await db.companyBankVerification.findFirst({
      where: {
        id,
        companyId,
        ...(user.role === "STAFF" ? { uploadedById: user.id } : {}),
      },
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

    const isUploader = user.id === verification.uploadedById;
    await createNotification({
      companyId,
      targetUserId: isUploader ? null : verification.uploadedById,
      targetRole: isUploader ? "COMPANY_ADMIN" : null,
      title: "New bank review message",
      message: `${user.name}: ${message.slice(0, 160)}`,
      type: "MESSAGE",
      link: isUploader ? "/admin/dashboard?section=bank" : "/dashboard",
    });

    if (isUploader) {
      await createNotification({
        companyId,
        targetRole: "ACCOUNTANT",
        title: "Uploader replied to bank review",
        message: `${user.name}: ${message.slice(0, 160)}`,
        type: "MESSAGE",
        link: "/dashboard",
      });
    }

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "SEND_BANK_REVIEW_MESSAGE",
      module: "BANK",
      details: `Reference ${verification.referenceNumber}: ${message.slice(0, 220)}`,
    });

    return NextResponse.json({ success: true, message: created });
  } catch (error) {
    return routeError(error);
  }
}
