import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import StaffVerificationCenterClient from "./StaffVerificationCenterClient";

export const dynamic = "force-dynamic";

export default async function StaffVerificationCenterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "STAFF") redirect("/login");
  if (!user.companyId) throw new Error("The Staff user is not assigned to a company.");

  return (
    <StaffVerificationCenterClient
      staff={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? user.email ?? "Staff"),
        email: String(user.email ?? ""),
      }}
    />
  );
}
