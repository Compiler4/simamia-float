export async function createNotification(
  db: any,
  input: {
    companyId: string;
    userId?: string | null;
    roleTarget?: string | null;
    title: string;
    message: string;
    type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  },
) {
  return db.accountantNotification.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      roleTarget: input.roleTarget ?? null,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
    },
  });
}
