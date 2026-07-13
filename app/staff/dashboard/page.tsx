import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";

import StaffDashboardClient from "./StaffDashboardClient";

export default async function StaffDashboardPage() {
  const user = (await getCurrentUser()) as any;

  if (!user) redirect("/login");
  if (user.role !== "STAFF") redirect("/dashboard");

  return (
    <StaffDashboardClient
      user={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Float Officer"),
        username: String(user.username ?? ""),
        email: String(user.email ?? ""),
        role: String(user.role),
        roleLabel: getRoleLabel(user.role),
        companyId: user.companyId == null ? null : String(user.companyId),
      }}
    />
  );
}
