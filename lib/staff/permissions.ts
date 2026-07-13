import { getCurrentUser } from "@/lib/auth";

export type StaffSession = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: "STAFF";
  companyId: string;
  branchId?: string | null;
};

export async function requireStaff(): Promise<StaffSession> {
  const session = (await getCurrentUser()) as any;

  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.role !== "STAFF") throw new Error("FORBIDDEN");
  if (!session.companyId) throw new Error("STAFF_COMPANY_REQUIRED");

  return {
    id: String(session.id),
    name: String(session.name ?? session.username ?? "Staff Officer"),
    username: session.username == null ? null : String(session.username),
    email: String(session.email ?? ""),
    role: "STAFF",
    companyId: String(session.companyId),
    branchId: session.branchId == null ? null : String(session.branchId),
  };
}
