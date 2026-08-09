import "server-only";

import { prisma } from "@/lib/prisma";

export async function notifyUser(input: {
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}) {
  const db = prisma as any;
  if (typeof db.notification?.create !== "function") return;

  try {
    await db.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type ?? "INFO",
        isRead: false,
      },
    });
  } catch (error) {
    console.error("ACCOUNTANT_V3_NOTIFICATION_FAILED", error);
  }
}

export async function notifyRoles(input: {
  companyId: string;
  roles: string[];
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}) {
  const db = prisma as any;
  if (typeof db.user?.findMany !== "function") return;

  const users = await db.user.findMany({
    where: {
      companyId: input.companyId,
      role: { in: input.roles },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await Promise.allSettled(
    users.map((user: any) =>
      notifyUser({
        companyId: input.companyId,
        userId: String(user.id),
        title: input.title,
        message: input.message,
        type: input.type,
      }),
    ),
  );
}
