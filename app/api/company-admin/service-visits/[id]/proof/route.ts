import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  requireCompanyMember,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyMember([
      "COMPANY_ADMIN",
      "ACCOUNTANT",
      "STAFF",
    ]);
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const documentId = text(body.documentId).trim();
    const db = prisma as any;

    const visit = await db.brokerServiceVisit.findFirst({
      where: {
        id,
        companyId,
        ...(user.role === "STAFF" ? { staffId: user.id } : {}),
      },
      include: { brokerCustomer: true, staff: true },
    });
    if (!visit) throw new HttpError("Service visit was not found.", 404);

    const document = await db.portalDocument.findFirst({
      where: {
        id: documentId,
        companyId,
        ...(user.role === "STAFF" ? { uploadedById: user.id } : {}),
      },
    });
    if (!document) throw new HttpError("Service proof document was not found.", 404);

    const completed = document.proofStatus === "SUFFICIENT";
    const updated = await db.$transaction(async (tx: any) => {
      await tx.portalDocument.update({
        where: { id: document.id },
        data: { serviceVisitId: visit.id, kind: "SERVICE_PROOF" },
      });

      return tx.brokerServiceVisit.update({
        where: { id: visit.id },
        data: {
          proofUrl: document.publicUrl || document.url || document.storagePath || null,
          completedAt: completed ? new Date() : null,
          status: completed ? "COMPLETED" : "PROOF_PENDING",
        },
      });
    });

    await createNotification({
      companyId,
      targetRole: "COMPANY_ADMIN",
      title: completed ? "Service proof completed" : "Service proof needs review",
      message: `${visit.staff.name} uploaded proof for ${visit.brokerCustomer.name}. Automatic status: ${document.proofStatus}.`,
      type: completed ? "SUCCESS" : "WARNING",
      link: "/admin/dashboard?section=gps",
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPLOAD_SERVICE_PROOF",
      module: "GPS",
      details: `${visit.staff.name} / ${visit.brokerCustomer.name}: ${document.proofStatus}.`,
    });

    return NextResponse.json({ success: true, visit: updated, document });
  } catch (error) {
    return routeError(error);
  }
}
