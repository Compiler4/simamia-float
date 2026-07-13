import { cookies } from "next/headers";
import type { Role } from "../generated/prisma/client";

export const AUTH_COOKIE = "simamia_float_session";

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  companyId: string | null;
  companyName: string | null;
};

export function getDashboardPath(role: Role) {
  switch (role) {
    case "SYSTEM_DEVELOPER":
      return "/developer/dashboard";
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "COMPANY_ADMIN":
      return "/admin/dashboard";
    case "ACCOUNTANT":
      return "/accountant/dashboard";
    case "STAFF":
      return "/staff/dashboard";
    case "BROKER":
      return "/broker/dashboard";
    case "GPS_MANAGER":
      return "/gps-manager/dashboard";
    default:
      return "/login";
  }
}

export function getRoleLabel(role: Role) {
  switch (role) {
    case "SYSTEM_DEVELOPER":
      return "Developer Portal";
    case "SUPER_ADMIN":
      return "Super Admin Portal";
    case "COMPANY_ADMIN":
      return "Company Admin Portal";
    case "ACCOUNTANT":
      return "Accountant Portal";
    case "STAFF":
      return "Staff Float Portal";
    case "BROKER":
      return "Broker Portal";
    case "GPS_MANAGER":
      return "GPS Manager Portal";
    default:
      return "ERP Portal";
  }
}

export function createSessionValue(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64");
}

export function parseSessionValue(value?: string) {
  if (!value) return null;

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(decoded) as SessionUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE);

  return parseSessionValue(sessionCookie?.value);
}