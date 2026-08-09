import { getCurrentUser } from "@/lib/auth";

export type PortalSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
};

export class PortalHttpError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function requirePortalRole(
  roles: string[],
): Promise<PortalSession> {
  const current = (await getCurrentUser()) as any;

  if (!current) {
    throw new PortalHttpError("Please sign in.", 401);
  }

  const role = String(current.role ?? "").toUpperCase();
  if (!roles.includes(role)) {
    throw new PortalHttpError(
      `${roles.join(" or ")} access is required.`,
      403,
    );
  }

  if (!current.companyId) {
    throw new PortalHttpError(
      "Your account is not attached to a company.",
      403,
    );
  }

  return {
    id: String(current.id),
    name: String(current.name ?? current.username ?? "User"),
    email: String(current.email ?? ""),
    role,
    companyId: String(current.companyId),
  };
}

export function asPortalError(error: unknown) {
  if (error instanceof PortalHttpError) {
    return { status: error.status, message: error.message };
  }

  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as any).code)
      : "";

  if (code === "P2002") {
    return { status: 409, message: "This record already exists." };
  }

  if (code === "P2021" || code === "P2022") {
    return {
      status: 503,
      message:
        "The Prisma schema is not synchronized. Apply the supplied schema upgrade, run npx prisma db push, then npx prisma generate.",
    };
  }

  console.error("[ACCOUNTANT_CONTROL_CENTRE]", error);
  return {
    status: 500,
    message:
      error instanceof Error
        ? error.message
        : "The accountant request could not be completed.",
  };
}
