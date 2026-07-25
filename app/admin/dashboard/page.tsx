import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import CompanyAdminDashboardClient from "./CompanyAdminDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyAdminDashboardPage() {
  const user = (await getCurrentUser()) as any;

  if (!user) redirect("/login");
  if (String(user.role) !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!user.companyId) redirect("/login?error=company-not-assigned");

  return (
    <CompanyAdminDashboardClient
      user={{
        id: String(user.id),
        name: String(user.name || user.email),
        username: user.username ? String(user.username) : null,
        email: String(user.email),
        role: String(user.role),
        companyId: String(user.companyId),
        companyName: user.companyName ? String(user.companyName) : null,
      }}
    />
  );
}
