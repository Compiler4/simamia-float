import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";

import ImportedFinanceClient from "./ImportedFinanceClient";

const ALLOWED_ROLES = new Set([
  "SYSTEM_DEVELOPER",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "ACCOUNTANT",
]);

export default async function ImportedFinancePage() {
  const user = (await getCurrentUser()) as any;

  if (!user) redirect("/login");
  if (!ALLOWED_ROLES.has(String(user.role))) redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  return (
    <ImportedFinanceClient
      user={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Finance User"),
        email: String(user.email ?? ""),
        role: String(user.role),
        roleLabel: getRoleLabel(user.role),
        companyId: String(user.companyId),
        profileImageUrl:
          user.profileImageUrl == null
            ? null
            : String(user.profileImageUrl),
      }}
    />
  );
}
