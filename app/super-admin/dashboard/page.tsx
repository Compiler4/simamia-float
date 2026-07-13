import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SuperAdminDashboardClient from "./SuperAdminDashboardClient";

export default async function SuperAdminDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return <SuperAdminDashboardClient user={user} />;
}