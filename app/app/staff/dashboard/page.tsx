import { redirect } from "next/navigation";

import {
  getCurrentUser,
  getDashboardPath,
  getRoleLabel,
  normalizeRole,
} from "@/lib/auth";

import StaffDashboardEntry from "./StaffDashboardEntry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function tanzaniaCalendarDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export default async function StaffDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (normalizeRole(user.role) !== "STAFF") {
    redirect(getDashboardPath(user.role));
  }

  if (!user.companyId) {
    redirect("/login?error=staff-company-required");
  }

  return (
    <StaffDashboardEntry
      initialDate={tanzaniaCalendarDate()}
      user={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Float Officer"),
        username: String(user.username ?? ""),
        email: String(user.email ?? ""),
        role: "STAFF",
        roleLabel: getRoleLabel(user.role),
        companyId: String(user.companyId),
      }}
    />
  );
}
