import { redirect } from "next/navigation";

import RoleLandingDashboard from "@/components/RoleLandingDashboard";
import { getCurrentUser, getDashboardPath, normalizeRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (normalizeRole(user.role) !== "BROKER") redirect(getDashboardPath(user.role));

  return (
    <RoleLandingDashboard
      title="Broker workspace"
      description="Your SIMAMIA broker account is signed in and ready."
      roleLabel="Broker"
      name={user.name || user.username || "Broker"}
      email={user.email}
      companyName={user.companyName}
    />
  );
}
