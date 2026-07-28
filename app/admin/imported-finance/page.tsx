import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";
import ImportedFinanceClient from "./ImportedFinanceClient";

const ALLOWED_ROLES = new Set([
  "SYSTEM_DEVELOPER",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "ACCOUNTANT",
]);

export const dynamic = "force-dynamic";

export default async function ImportedFinancePage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");

  const role = String(user.role).toUpperCase();
  if (!ALLOWED_ROLES.has(role)) redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  if (role === "COMPANY_ADMIN") {
    redirect("/admin/control-centre?module=finance");
  }

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
          user.profileImageUrl == null ? null : String(user.profileImageUrl),
      }}
    />
  );
}
