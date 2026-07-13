import { redirect } from "next/navigation";
import { getCurrentUser, getDashboardPath } from "@/lib/auth";

export default async function DashboardRedirectPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(getDashboardPath(user.role));
}