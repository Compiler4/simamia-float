import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountantPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (String(user.role).trim().toUpperCase() !== "ACCOUNTANT") {
    redirect("/dashboard");
  }

  redirect("/accountant/dashboard");
}
