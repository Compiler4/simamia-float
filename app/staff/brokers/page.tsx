import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import StaffBrokerDirectoryClient from "./StaffBrokerDirectoryClient";

export const dynamic = "force-dynamic";

export default async function StaffBrokerDirectoryPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "STAFF") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  return (
    <StaffBrokerDirectoryClient
      user={{
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role),
        companyId: String(user.companyId),
      }}
    />
  );
}
