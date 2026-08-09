import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import StaffLiveLocationsClient from "./StaffLiveLocationsClient";

export const dynamic = "force-dynamic";

export default async function StaffLiveLocationsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "STAFF") {
    redirect("/dashboard");
  }
  if (!user.companyId) {
    redirect("/dashboard");
  }

  return (
    <StaffLiveLocationsClient
      user={{
        id: String(user.id),
        name: String(
          user.name ||
            user.username ||
            "Staff Officer",
        ),
        email: String(user.email || ""),
        companyId: String(user.companyId),
      }}
    />
  );
}
