// Copy this over app/accountant/dashboard/page.tsx only if your current page
// already imports AccountantDashboardClient from the same folder.
import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";
import AccountantDashboardClient from "@/app/accountant/dashboard/AccountantDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountantDashboardPage() {
  const session = (await getCurrentUser()) as any;
  if (!session) redirect("/login");
  if (String(session.role).toUpperCase() !== "ACCOUNTANT") redirect("/dashboard");
  if (!session.companyId) redirect("/dashboard");

  return (
    <AccountantDashboardClient
      user={{
        id: String(session.id),
        name: String(session.name ?? session.username ?? "Accountant"),
        email: String(session.email ?? ""),
        role: String(session.role),
        roleLabel: getRoleLabel(session.role),
        companyId: String(session.companyId),
      }}
    />
  );
}
