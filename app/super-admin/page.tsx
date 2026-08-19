import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath, normalizeRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (normalizeRole(user.role) !== "SUPER_ADMIN") {
    redirect(getDashboardPath(user.role));
  }

  redirect("/super-admin/dashboard");
}
