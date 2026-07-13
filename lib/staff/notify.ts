import { db } from "@/lib/db";

type NotificationKind = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
type Channel = "IN_APP" | "EMAIL" | "SMS";

type NoticeInput = {
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type?: NotificationKind;
  channels?: Channel[];
};

function webhookFor(channel: Channel): string | null {
  if (channel === "EMAIL") return process.env.EMAIL_NOTIFICATION_WEBHOOK_URL || null;
  if (channel === "SMS") return process.env.SMS_NOTIFICATION_WEBHOOK_URL || null;
  return null;
}

async function deliverWebhook(
  deliveryId: string,
  endpoint: string,
  payload: Record<string, unknown>,
) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NOTIFICATION_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.NOTIFICATION_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    const responseText = (await response.text()).slice(0, 2000);
    await (db as any).notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: response.ok ? "SENT" : "FAILED",
        attempts: { increment: 1 },
        sentAt: response.ok ? new Date() : null,
        providerResponse: responseText || `HTTP ${response.status}`,
      },
    });
  } catch (error) {
    await (db as any).notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        providerResponse: error instanceof Error ? error.message : "Webhook delivery failed",
      },
    });
  }
}

export async function sendNotice(input: NoticeInput) {
  const channels = Array.from(new Set(input.channels || ["IN_APP", "EMAIL", "SMS"]));
  const notification = await (db as any).notification.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type || "INFO",
    },
  });

  for (const channel of channels) {
    const endpoint = webhookFor(channel);
    const delivery = await (db as any).notificationDelivery.create({
      data: {
        notificationId: notification.id,
        companyId: input.companyId,
        userId: input.userId,
        channel,
        status: channel === "IN_APP" ? "SENT" : endpoint ? "QUEUED" : "QUEUED",
        endpoint,
        sentAt: channel === "IN_APP" ? new Date() : null,
      },
    });

    if (endpoint && channel !== "IN_APP") {
      void deliverWebhook(delivery.id, endpoint, {
        userId: input.userId,
        companyId: input.companyId,
        title: input.title,
        message: input.message,
        type: input.type || "INFO",
        channel,
      });
    }
  }

  return notification;
}

export async function sendNoticeToRoles(input: {
  companyId: string;
  roles: string[];
  title: string;
  message: string;
  type?: NotificationKind;
  channels?: Channel[];
  excludeUserId?: string;
}) {
  const users = await (db as any).user.findMany({
    where: {
      companyId: input.companyId,
      role: { in: input.roles },
      status: "ACTIVE",
      ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
    },
    select: { id: true },
  });

  await Promise.all(
    users.map((user: { id: string }) =>
      sendNotice({
        companyId: input.companyId,
        userId: user.id,
        title: input.title,
        message: input.message,
        type: input.type,
        channels: input.channels,
      }),
    ),
  );
}
