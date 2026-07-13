import { getCurrentUser } from "@/lib/auth";

export type CompanyAdminSession = {
  id: string;
  name: string;
  email: string;
  role: "COMPANY_ADMIN";
  companyId: string;
};

export async function requireCompanyAdmin(): Promise<CompanyAdminSession> {
  const session = (await getCurrentUser()) as any;

  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.role !== "COMPANY_ADMIN") throw new Error("FORBIDDEN");
  if (!session.companyId) throw new Error("COMPANY_REQUIRED");

  return {
    id: String(session.id),
    name: String(session.name ?? session.username ?? "Company Admin"),
    email: String(session.email ?? ""),
    role: "COMPANY_ADMIN",
    companyId: String(session.companyId),
  };
}
