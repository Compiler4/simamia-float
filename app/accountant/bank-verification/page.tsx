import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import BankVerificationClient from "./BankVerificationClient";

export default async function BankVerificationPage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (!["ACCOUNTANT", "COMPANY_ADMIN"].includes(String(user.role))) redirect("/dashboard");
  return <BankVerificationClient />;
}
