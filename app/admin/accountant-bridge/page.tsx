import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CompanyAdminAccountantBridgePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!user.companyId) throw new Error("The Company Admin is not assigned to a company.");
  redirect("/admin/control-centre?module=verification");
}
