import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = text(body.email).toLowerCase();

    if (!validEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Enter your registered email address." },
        { status: 422 },
      );
    }

    const db = prisma as any;
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        status: true,
      },
    });

    const message =
      "If that email is registered, the company administrator has been notified to reset the password.";

    if (!user?.companyId || text(user.status).toUpperCase() !== "ACTIVE") {
      return NextResponse.json({ success: true, message });
    }

    await db.companyNotification.create({
      data: {
        companyId: user.companyId,
        targetRole: "COMPANY_ADMIN",
        title: "Password reset requested",
        message: `${user.name} (${user.email}) requested a password reset. Open Manage Users, edit this account and enter a new password.`,
        type: "WARNING",
        link: "/admin/dashboard?section=Manage%20Users",
        isRead: false,
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("FORGOT_PASSWORD_ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Password recovery could not be completed.",
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 },
    );
  }
}
