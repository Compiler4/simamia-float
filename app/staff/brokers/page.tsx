import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import StaffBrokerDirectoryClient from "./StaffBrokerDirectoryClient";

export default async function StaffBrokerDirectoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.companyId) {
    redirect("/dashboard");
  }

  return (
    <StaffBrokerDirectoryClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: String(user.role),
        companyId: user.companyId,
      }}
    />
  );
}
