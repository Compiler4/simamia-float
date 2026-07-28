import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanText(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}

async function communicationSummary(
  companyId: string,
  userId: string,
) {
  const db = prisma as any;

  const [
    notificationCount,
    messageCount,
    notifications,
    messages,
  ] = await Promise.all([
    db.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [
          { companyId },
          { companyId: null },
        ],
      },
    }),

    db.message.count({
      where: {
        receiverId: userId,
        isRead: false,
        OR: [
          { companyId },
          { companyId: null },
        ],
      },
    }),

    db.notification.findMany({
      where: {
        userId,
        isRead: false,
        OR: [
          { companyId },
          { companyId: null },
        ],
      },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    }),

    db.message.findMany({
      where: {
        receiverId: userId,
        isRead: false,
        OR: [
          { companyId },
          { companyId: null },
        ],
      },
      select: {
        id: true,
        subject: true,
        body: true,
        isRead: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    }),
  ]);

  const items = [
    ...notifications.map((row: any) => ({
      id: String(row.id),
      kind: "NOTIFICATION" as const,
      title: String(row.title),
      message: String(row.message),
      type: String(row.type),
      isRead: Boolean(row.isRead),
      createdAt: row.createdAt,
    })),

    ...messages.map((row: any) => ({
      id: String(row.id),
      kind: "MESSAGE" as const,
      title: String(row.subject || "Direct message"),
      message: `${String(row.sender?.name || "System")}: ${String(row.body)}`,
      type: "MESSAGE",
      isRead: Boolean(row.isRead),
      createdAt: row.createdAt,
    })),
  ]
    .sort(
      (left, right) =>
        new Date(String(right.createdAt)).getTime() -
        new Date(String(left.createdAt)).getTime(),
    )
    .slice(0, 30);

  return {
    success: true,
    total: Number(notificationCount) + Number(messageCount),
    notifications: Number(notificationCount),
    messages: Number(messageCount),
    items,
  };
}

export async function GET() {
  try {
    const session = await requireStaff();

    return NextResponse.json(
      await communicationSummary(
        session.companyId,
        session.id,
      ),
    );
  } catch (error) {
    console.error("STAFF_UNREAD_COUNT_GET_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unread notifications and messages could not be loaded.",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const db = prisma as any;
    const body = await request.json();
    const action = cleanText(body.action).toUpperCase();

    if (action === "MARK_ALL_READ") {
      await Promise.all([
        db.notification.updateMany({
          where: {
            userId: session.id,
            isRead: false,
            OR: [
              { companyId: session.companyId },
              { companyId: null },
            ],
          },
          data: {
            isRead: true,
          },
        }),

        db.message.updateMany({
          where: {
            receiverId: session.id,
            isRead: false,
            OR: [
              { companyId: session.companyId },
              { companyId: null },
            ],
          },
          data: {
            isRead: true,
          },
        }),
      ]);

      return NextResponse.json({
        ...(await communicationSummary(
          session.companyId,
          session.id,
        )),
        message: "All notifications and direct messages were marked as read.",
      });
    }

    if (action === "MARK_READ") {
      const id = cleanText(body.id);
      const kind = cleanText(body.kind).toUpperCase();

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            message: "The unread item ID is required.",
          },
          { status: 422 },
        );
      }

      if (kind === "MESSAGE") {
        const message = await db.message.findFirst({
          where: {
            id,
            receiverId: session.id,
            OR: [
              { companyId: session.companyId },
              { companyId: null },
            ],
          },
          select: {
            id: true,
          },
        });

        if (!message) {
          return NextResponse.json(
            {
              success: false,
              message: "The direct message was not found.",
            },
            { status: 404 },
          );
        }

        await db.message.update({
          where: {
            id: message.id,
          },
          data: {
            isRead: true,
          },
        });
      } else {
        const notification = await db.notification.findFirst({
          where: {
            id,
            userId: session.id,
            OR: [
              { companyId: session.companyId },
              { companyId: null },
            ],
          },
          select: {
            id: true,
          },
        });

        if (!notification) {
          return NextResponse.json(
            {
              success: false,
              message: "The notification was not found.",
            },
            { status: 404 },
          );
        }

        await db.notification.update({
          where: {
            id: notification.id,
          },
          data: {
            isRead: true,
          },
        });
      }

      return NextResponse.json({
        ...(await communicationSummary(
          session.companyId,
          session.id,
        )),
        message: "The item was marked as read.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "The unread-item action is not supported.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("STAFF_UNREAD_COUNT_POST_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "The unread item could not be updated.",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
