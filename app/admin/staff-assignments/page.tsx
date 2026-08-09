import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffAssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");
  redirect("/admin/control-centre?module=staff-areas");
}
