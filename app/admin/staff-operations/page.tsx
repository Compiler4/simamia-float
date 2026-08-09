import { redirect } from "next/navigation";

import StaffOperationsAdminClient from "@/components/staff-operations/StaffOperationsAdminClient";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffOperationsAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = String(user.role).toUpperCase();
  const allowed = new Set([
    "ACCOUNTANT",
    "COMPANY_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_DEVELOPER",
  ]);

  if (!allowed.has(role)) redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  if (role === "COMPANY_ADMIN") {
    redirect("/admin/control-centre?module=staff-operations");
  }

  return <StaffOperationsAdminClient portalTitle="Accountant Portal" />;
}
