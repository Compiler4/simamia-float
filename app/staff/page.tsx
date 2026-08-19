import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath, normalizeRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffPortalEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (normalizeRole(user.role) !== "STAFF") {
    redirect(getDashboardPath(user.role));
  }

  if (!user.companyId) {
    redirect("/login?error=staff-company-required");
  }

  redirect("/staff/dashboard");
}
