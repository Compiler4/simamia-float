import "server-only";

import { getCurrentUser } from "@/lib/auth";

export type PortalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
};

export class PortalAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PortalAccessError";
    this.status = status;
  }
}

function normalizeUser(raw: any): PortalUser {
  if (!raw) {
    throw new PortalAccessError("Authentication is required.", 401);
  }

  const companyId = String(raw.companyId ?? "").trim();
  if (!companyId) {
    throw new PortalAccessError("The signed-in user is not assigned to a company.", 403);
  }

  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.username ?? raw.email ?? "User"),
    email: String(raw.email ?? ""),
    role: String(raw.role ?? "").toUpperCase(),
    companyId,
  };
}

export async function requireRole(allowedRoles: string[]): Promise<PortalUser> {
  const user = normalizeUser(await getCurrentUser());
  const allowed = allowedRoles.map((role) => role.toUpperCase());

  if (!allowed.includes(user.role)) {
    throw new PortalAccessError(
      `This action is restricted to ${allowed.join(" or ")} users.`,
      403,
    );
  }

  return user;
}

export function requireAccountant() {
  return requireRole(["ACCOUNTANT"]);
}

export function requireAccountantOrAdmin() {
  return requireRole(["ACCOUNTANT", "COMPANY_ADMIN"]);
}

export function requireCompanyAdmin() {
  return requireRole(["COMPANY_ADMIN"]);
}

export function requireStaff() {
  return requireRole(["STAFF"]);
}
