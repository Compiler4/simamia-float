import { db } from "@/lib/db";

type NoticeInput = {
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
};

export async function createNotice(input: NoticeInput) {
  const database = db as any;

  try {
    if (
      database.notification &&
      typeof database.notification.create === "function"
    ) {
      return await database.notification.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type || "INFO",
          isRead: false,
        },
      });
    }
  } catch (error) {
    console.warn("[LIVE_NOTICE_SKIPPED]", error);
  }

  return null;
}

export async function createRoleNotices(input: {
  companyId: string;
  roles: string[];
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  excludeUserId?: string;
}) {
  const database = db as any;

  try {
    if (
      !database.user ||
      typeof database.user.findMany !== "function"
    ) {
      return [];
    }

    const users = await database.user.findMany({
      where: {
        companyId: input.companyId,
        role: { in: input.roles },
        status: "ACTIVE",
        ...(input.excludeUserId
          ? { id: { not: input.excludeUserId } }
          : {}),
      },
      select: { id: true },
    });

    const results = await Promise.allSettled(
      users.map((user: { id: string }) =>
        createNotice({
          companyId: input.companyId,
          userId: String(user.id),
          title: input.title,
          message: input.message,
          type: input.type || "INFO",
        }),
      ),
    );

    return results;
  } catch (error) {
    console.warn("[ROLE_NOTICES_SKIPPED]", error);
    return [];
  }
}
