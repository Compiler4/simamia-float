import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AccountingPeriodReviewsClient from "./AccountingPeriodReviewsClient";

export const dynamic = "force-dynamic";

export default async function AccountingPeriodReviewsPage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");
  return <AccountingPeriodReviewsClient />;
}
