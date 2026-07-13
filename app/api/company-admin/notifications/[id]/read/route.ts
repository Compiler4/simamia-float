import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyMember,
  routeError,
  HttpError,
} from "@/lib/company-admin-server";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyMember();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const db = prisma as any;

    const notification = await db.companyNotification.findFirst({
      where: {
        id,
        companyId,
        OR: [
          { targetUserId: user.id },
          { targetRole: user.role },
          { targetUserId: null, targetRole: null },
        ],
      },
    });

    if (!notification) throw new HttpError("Notification not found.", 404);

    const updated = await db.companyNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    return routeError(error);
  }
}
