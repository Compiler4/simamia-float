import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath, normalizeRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DeveloperEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (normalizeRole(user.role) !== "SYSTEM_DEVELOPER") {
    redirect(getDashboardPath(user.role));
  }

  redirect("/developer/dashboard");
}
