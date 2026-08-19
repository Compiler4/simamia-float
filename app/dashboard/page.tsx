import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardRouterPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const destination = getDashboardPath(user.role);

  if (!destination || destination === "/login" || destination === "/dashboard") {
    redirect("/login?error=unsupported-role");
  }

  redirect(destination);
}
