import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import AccountantVerificationRequestsClient from "./AccountantVerificationRequestsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountantVerificationRequestsPage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "ACCOUNTANT") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  return (
    <AccountantVerificationRequestsClient
      accountant={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Accountant"),
        email: String(user.email ?? ""),
      }}
    />
  );
}
