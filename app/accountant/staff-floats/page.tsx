import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import IssueStaffFloatClient from "./IssueStaffFloatClient";

export default async function AccountantStaffFloatsPage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (user.role !== "ACCOUNTANT") redirect("/dashboard");
  return <IssueStaffFloatClient accountantName={String(user.name ?? user.username ?? "Accountant")} />;
}
