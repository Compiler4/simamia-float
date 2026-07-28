import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

export type PortalUser = {
  id: string | number;
  companyId: string | number;
  role: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

export async function requirePortalRole(allowedRoles: string[]) {
  const user = (await getCurrentUser()) as PortalUser | null;

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "Authentication is required." },
        { status: 401 },
      ),
    };
  }

  const role = String(user.role).toUpperCase();
  if (!allowedRoles.includes(role)) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "You are not allowed to perform this action." },
        { status: 403 },
      ),
    };
  }

  if (user.companyId == null || user.companyId === "") {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "Your account is not assigned to a company." },
        { status: 403 },
      ),
    };
  }

  return { user, response: null };
}

export function displayName(user: PortalUser) {
  return String(user.name ?? user.username ?? user.email ?? "User");
}
