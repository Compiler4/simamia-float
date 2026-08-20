import { redirect } from "next/navigation";

import RoleLandingDashboard from "@/components/RoleLandingDashboard";
import { getCurrentUser, getDashboardPath, normalizeRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GpsManagerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (normalizeRole(user.role) !== "GPS_MANAGER") redirect(getDashboardPath(user.role));

  return (
    <RoleLandingDashboard
      title="GPS manager workspace"
      description="Your SIMAMIA GPS management account is signed in and ready."
      roleLabel="GPS Manager"
      name={user.name || user.username || "GPS Manager"}
      email={user.email}
      companyName={user.companyName}
    />
  );
}
