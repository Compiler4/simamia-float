import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import StaffAssignmentsClient from "./StaffAssignmentsClient";

export default async function StaffAssignmentsPage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (user.role !== "COMPANY_ADMIN") redirect("/dashboard");

  return <StaffAssignmentsClient />;
}
