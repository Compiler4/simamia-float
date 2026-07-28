import { redirect } from "next/navigation";

import CompanyAdminAccountantBridgeClient from "@/app/admin/accountant-bridge/CompanyAdminAccountantBridgeClient";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Primary Company Admin route. The package also keeps /admin/accountant-bridge
 * as a compatibility alias for projects that use the shorter admin prefix.
 */
export default async function CompanyAdminAccountantBridgePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "COMPANY_ADMIN") redirect("/login");
  if (!user.companyId) {
    throw new Error("The Company Admin is not assigned to a company.");
  }

  return (
    <CompanyAdminAccountantBridgeClient
      admin={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? user.email ?? "Company Admin"),
        email: String(user.email ?? ""),
      }}
    />
  );
}
