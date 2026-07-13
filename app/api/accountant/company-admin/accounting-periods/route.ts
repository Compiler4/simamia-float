import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) {
      return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    }
    if (session.role !== "COMPANY_ADMIN" || !session.companyId) {
      return NextResponse.json({ success: false, message: "Company Admin approval is required." }, { status: 403 });
    }

    const body = await request.json();
    const requestId = String(body.requestId ?? "").trim();
    const decision = String(body.decision ?? "").toUpperCase();
    const reviewNote = String(body.reviewNote ?? "").trim();

    if (!requestId || !["APPROVE", "REJECT"].includes(decision)) {
      return NextResponse.json({ success: false, message: "Request and decision are required." }, { status: 400 });
    }

    const reopenRequest = await (db as any).periodReopenRequest.findFirst({
      where: { id: requestId, companyId: String(session.companyId), status: "PENDING" },
      include: { period: true, requestedBy: true },
    });
    if (!reopenRequest) {
      return NextResponse.json({ success: false, message: "Pending reopen request not found." }, { status: 404 });
    }

    await (db as any).$transaction(async (tx: any) => {
      await tx.periodReopenRequest.update({
        where: { id: reopenRequest.id },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewNote: reviewNote || null,
          reviewedById: String(session.id),
          reviewedAt: new Date(),
        },
      });

      if (decision === "APPROVE") {
        await tx.accountingPeriod.update({
          where: { id: reopenRequest.periodId },
          data: {
            status: "OPEN",
            reason: `Reopened by Company Admin: ${reviewNote || reopenRequest.reason}`,
            lockedById: null,
            lockedAt: null,
          },
        });
      }

      await tx.notification.create({
        data: {
          companyId: String(session.companyId),
          recipientId: reopenRequest.requestedById,
          title: decision === "APPROVE" ? "Accounting period reopened" : "Reopen request rejected",
          message: reviewNote || `${reopenRequest.period.label} request was ${decision.toLowerCase()}.`,
          type: decision === "APPROVE" ? "SUCCESS" : "ERROR",
        },
      });
    });

    return NextResponse.json({ success: true, message: decision === "APPROVE" ? "Accounting period reopened." : "Reopen request rejected." });
  } catch (error) {
    console.error("[COMPANY_ADMIN_PERIOD_REVIEW]", error);
    return NextResponse.json({ success: false, message: "The reopen request could not be reviewed." }, { status: 500 });
  }
}
