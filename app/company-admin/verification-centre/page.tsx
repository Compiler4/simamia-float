import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import CompanyAdminVerificationClient from "./CompanyAdminVerificationClient";

export const dynamic = "force-dynamic";

export default async function CompanyAdminVerificationCentrePage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");
  return <CompanyAdminVerificationClient adminName={String(user.name ?? user.username ?? "Company Admin")} />;
}
