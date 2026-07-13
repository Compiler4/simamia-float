import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyMember,
  routeError,
} from "@/lib/company-admin-server";

export async function PATCH() {
  try {
    const user = await requireCompanyMember();
    const companyId = user.companyId as string;
    const db = prisma as any;

    const result = await db.companyNotification.updateMany({
      where: {
        companyId,
        isRead: false,
        OR: [
          { targetUserId: user.id },
          { targetRole: user.role },
          { targetUserId: null, targetRole: null },
        ],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    return routeError(error);
  }
}
