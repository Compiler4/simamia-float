import { getCurrentUser, normalizeRole } from "@/lib/auth";

export type RequiredStaffSession = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: string;
};

export async function requireStaffSession(): Promise<RequiredStaffSession> {
  const user = (await getCurrentUser()) as any;

  if (!user) throw new Error("UNAUTHENTICATED");
  if (normalizeRole(user.role) !== "STAFF") {
    throw new Error("FORBIDDEN");
  }
  if (!user.companyId) {
    throw new Error("STAFF_COMPANY_REQUIRED");
  }

  return {
    id: String(user.id),
    companyId: String(user.companyId),
    name: String(
      user.name ||
        user.username ||
        user.email ||
        "Staff Officer",
    ),
    email: String(user.email || ""),
    role: "STAFF",
  };
}
