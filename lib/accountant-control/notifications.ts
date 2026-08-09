export async function notifyUser(
  db: any,
  input: {
    companyId: string;
    userId: string;
    title: string;
    message: string;
    type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  },
) {
  if (!db.notification?.create) return;

  await db.notification.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
    },
  });
}
