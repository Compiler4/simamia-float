import { redirect } from "next/navigation";
import { getCurrentUser, getDashboardPath, normalizeRole } from "@/lib/auth";
import SuperAdminDashboardClient from "./SuperAdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (normalizeRole(user.role) !== "SUPER_ADMIN") {
    redirect(getDashboardPath(user.role));
  }

  return <SuperAdminDashboardClient user={user} />;
}
