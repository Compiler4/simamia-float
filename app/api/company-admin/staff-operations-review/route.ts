import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanText, serialize } from "@/lib/staff/operations-v4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEW_ROLES = new Set([
  "SYSTEM_DEVELOPER",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "ACCOUNTANT",
]);

async function requireReviewer() {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  if (!user.companyId) throw new Error("COMPANY_REQUIRED");
  const role = String(user.role).toUpperCase();
  if (!REVIEW_ROLES.has(role)) throw new Error("ROLE_REQUIRED");
  return {
    id: String(user.id),
    name: String(user.name),
    role,
    companyId: String(user.companyId),
  };
}

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  const known: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, "Authentication is required."],
    COMPANY_REQUIRED: [403, "Your account is not assigned to a company."],
    ROLE_REQUIRED: [403, "Company Admin or Accountant access is required."],
    PROOF_NOT_FOUND: [404, "The proof submission was not found."],
    EXPENSE_NOT_FOUND: [404, "The expense request was not found."],
    INVALID_DECISION: [422, "Select VERIFIED/APPROVED or REJECTED."],
  };
  const result = known[code] ?? [500, "The review action could not be completed."];
  return NextResponse.json(
    {
      success: false,
      message: result[1],
      details:
        process.env.NODE_ENV === "development"
          ? code
          : undefined,
    },
    { status: result[0] },
  );
}

export async function GET(request: Request) {
  try {
    const reviewer = await requireReviewer();
    const db = prisma as any;
    const url = new URL(request.url);
    const status = cleanText(url.searchParams.get("status")).toUpperCase();
    const staffId = cleanText(url.searchParams.get("staffId"));

    const [proofs, expenses, staff] = await Promise.all([
      db.staffProofSubmission.findMany({
        where: {
          companyId: reviewer.companyId,
          ...(staffId ? { staffId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              profileImageUrl: true,
            },
          },
          broker: true,
          networkLine: true,
          file: true,
          verifiedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 1000,
      }),
      db.expense.findMany({
        where: {
          companyId: reviewer.companyId,
          ...(staffId ? { employeeId: staffId } : {}),
          ...(status === "PENDING" ? { status: "PENDING" } : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              profileImageUrl: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 1000,
      }),
      db.user.findMany({
        where: {
          companyId: reviewer.companyId,
          role: "STAFF",
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      proofs: serialize(proofs),
      expenses: serialize(expenses),
      staff,
      summary: {
        pendingProofs: proofs.filter((row: any) => row.status === "PENDING").length,
        verifiedProofs: proofs.filter((row: any) => row.status === "VERIFIED").length,
        rejectedProofs: proofs.filter((row: any) => row.status === "REJECTED").length,
        pendingExpenses: expenses.filter((row: any) => row.status === "PENDING").length,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const reviewer = await requireReviewer();
    const db = prisma as any;
    const body = (await request.json()) as Record<string, unknown>;
    const action = cleanText(body.action).toUpperCase();
    const decision = cleanText(body.decision).toUpperCase();
    const note = cleanText(body.note);

    if (action === "REVIEW_PROOF") {
      if (!["VERIFIED", "REJECTED"].includes(decision)) {
        throw new Error("INVALID_DECISION");
      }

      const id = cleanText(body.id ?? body.proofId);
      const proof = await db.staffProofSubmission.findFirst({
        where: {
          id,
          companyId: reviewer.companyId,
        },
      });
      if (!proof) throw new Error("PROOF_NOT_FOUND");

      const updated = await db.staffProofSubmission.update({
        where: { id: proof.id },
        data: {
          status: decision,
          verificationNote: note || null,
          verifiedById: reviewer.id,
          verifiedAt: new Date(),
        },
        include: {
          staff: {
            select: { id: true, name: true, email: true },
          },
          broker: true,
        },
      });

      if (proof.serviceVisitId) {
        await db.brokerServiceVisit.update({
          where: { id: proof.serviceVisitId },
          data: {
            status: decision === "VERIFIED" ? "COMPLETED" : "PROOF_PENDING",
            completedAt: decision === "VERIFIED" ? new Date() : null,
          },
        });
      }

      await db.notification.create({
        data: {
          companyId: reviewer.companyId,
          userId: proof.staffId,
          title:
            decision === "VERIFIED"
              ? "Transaction proof verified"
              : "Transaction proof rejected",
          message:
            `${proof.referenceNo} was ${decision.toLowerCase()} by ${reviewer.name}.` +
            (note ? ` ${note}` : ""),
          type: decision === "VERIFIED" ? "SUCCESS" : "ERROR",
          isRead: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Proof ${decision.toLowerCase()} successfully.`,
        proof: serialize(updated),
      });
    }

    if (action === "REVIEW_EXPENSE") {
      if (!["APPROVED", "REJECTED"].includes(decision)) {
        throw new Error("INVALID_DECISION");
      }

      const id = cleanText(body.id ?? body.expenseId);
      const expense = await db.expense.findFirst({
        where: {
          id,
          companyId: reviewer.companyId,
        },
      });
      if (!expense) throw new Error("EXPENSE_NOT_FOUND");

      const updated = await db.expense.update({
        where: { id: expense.id },
        data: {
          status: decision,
          reviewNote: note || null,
          reviewedById: reviewer.id,
          reviewedAt: new Date(),
        },
        include: {
          employee: {
            select: { id: true, name: true, email: true },
          },
          reviewedBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      await db.notification.create({
        data: {
          companyId: reviewer.companyId,
          userId: expense.employeeId,
          title:
            decision === "APPROVED"
              ? "Expense request approved"
              : "Expense request rejected",
          message:
            `${expense.otherCategory ?? expense.category} was ${decision.toLowerCase()} by ${reviewer.name}.` +
            (note ? ` ${note}` : ""),
          type: decision === "APPROVED" ? "SUCCESS" : "ERROR",
          isRead: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Expense request ${decision.toLowerCase()} successfully.`,
        expense: serialize(updated),
      });
    }

    return NextResponse.json(
      { success: false, message: "Unsupported review action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("STAFF_OPERATIONS_REVIEW_ERROR:", error);
    return fail(error);
  }
}
