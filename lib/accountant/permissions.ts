import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type AccountantSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  approvalLimit: number;
};

export async function requireAccountant(): Promise<AccountantSession> {
  const session = (await getCurrentUser()) as any;

  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  if (session.role !== "ACCOUNTANT") {
    throw new Error("FORBIDDEN");
  }

  if (!session.companyId) {
    throw new Error("ACCOUNTANT_COMPANY_REQUIRED");
  }

  const accountant = await (db as any).user.findUnique({
    where: { id: String(session.id) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      approvalLimit: true,
    },
  });

  if (!accountant || accountant.role !== "ACCOUNTANT") {
    throw new Error("ACCOUNTANT_NOT_FOUND");
  }

  return {
    id: String(accountant.id),
    name: String(accountant.name ?? session.name ?? "Accountant"),
    email: String(accountant.email ?? session.email ?? ""),
    role: "ACCOUNTANT",
    companyId: String(accountant.companyId),
    approvalLimit: Number(accountant.approvalLimit ?? 0),
  };
}

export async function assertCompanyRecord(
  delegateName: string,
  id: string,
  companyId: string,
) {
  const delegate = (db as any)[delegateName];

  if (!delegate?.findFirst) {
    throw new Error(`PRISMA_MODEL_MISSING:${delegateName}`);
  }

  const record = await delegate.findFirst({
    where: { id, companyId },
  });

  if (!record) {
    throw new Error("RECORD_NOT_FOUND");
  }

  return record;
}

export function assertNotSelfApproval(
  accountantId: string,
  ownerId?: string | null,
  createdById?: string | null,
) {
  if (ownerId === accountantId || createdById === accountantId) {
    throw new Error("SELF_APPROVAL_FORBIDDEN");
  }
}

export function assertWithinApprovalLimit(
  amount: number,
  approvalLimit: number,
) {
  if (approvalLimit > 0 && amount > approvalLimit) {
    throw new Error("APPROVAL_LIMIT_EXCEEDED");
  }
}
