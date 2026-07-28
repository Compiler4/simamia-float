import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";

import StaffDashboardClient from "./StaffDashboardClient";

export const dynamic = "force-dynamic";

export default async function StaffDashboardPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "STAFF") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  return (
    <StaffDashboardClient
      user={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Float Officer"),
        username: String(user.username ?? ""),
        email: String(user.email ?? ""),
        role: String(user.role),
        roleLabel: getRoleLabel(user.role),
        companyId: String(user.companyId),
      }}
    />
  );
}
