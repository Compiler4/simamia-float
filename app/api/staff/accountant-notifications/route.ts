import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/accountant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePortalRole(["STAFF"]);
  if (auth.response || !auth.user) return auth.response!;
  const notifications = await prisma.accountantNotification.findMany({
    where: { companyId: String(auth.user.companyId), userId: String(auth.user.id) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ success: true, notifications });
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["STAFF"]);
  if (auth.response || !auth.user) return auth.response!;
  try {
    const body = await request.json();
    const notificationId = String(body.notificationId ?? "").trim();
    if (!notificationId) throw new Error("Notification ID is required.");
    await prisma.accountantNotification.updateMany({
      where: { id: notificationId, companyId: String(auth.user.companyId), userId: String(auth.user.id) },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Notification update failed." }, { status: 400 });
  }
}
