import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";

import AccountantDashboardClient from "./AccountantDashboardClient";

export default async function AccountantDashboardPage() {
  const session = (await getCurrentUser()) as any;

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ACCOUNTANT") {
    redirect("/dashboard");
  }

  return (
    <AccountantDashboardClient
      user={{
        id: String(session.id),
        name: String(session.name ?? session.username ?? "Accountant"),
        email: String(session.email ?? ""),
        role: String(session.role),
        roleLabel: getRoleLabel(session.role),
        companyId:
          session.companyId == null
            ? null
            : String(session.companyId),
      }}
    />
  );
}
