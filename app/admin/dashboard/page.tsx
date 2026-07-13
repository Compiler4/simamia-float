import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import CompanyAdminDashboardClient from "./CompanyAdminDashboardClient";

export default async function CompanyAdminDashboardPage() {
  const session = await getCurrentUser();
  const user = session as any;

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "COMPANY_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <CompanyAdminDashboardClient
      user={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Company Admin"),
        username: user.username == null ? "" : String(user.username),
        email: String(user.email ?? ""),
        role: String(user.role),
        companyId: user.companyId == null ? null : String(user.companyId),
        companyName:
          user.companyName == null ? null : String(user.companyName),
      }}
    />
  );
}
