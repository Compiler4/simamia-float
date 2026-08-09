import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { asPortalError, PortalHttpError, requirePortalRole } from "@/lib/accountant-control/auth";
import { notifyUser } from "@/lib/accountant-control/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown) => String(value ?? "").trim();

export async function GET() {
  try {
    const staff = await requirePortalRole(["STAFF"]);
    const proofs = await (prisma as any).staffProofSubmission.findMany({
      where: { companyId: staff.companyId, staffId: staff.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return NextResponse.json({ success: true, proofs });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requirePortalRole(["STAFF"]);
    const body = await request.json();
    const kind = text(body.kind).toUpperCase();
    const referenceNo = text(body.referenceNo);
    const documentUrl = text(body.documentUrl);
    const smsText = text(body.smsText);
    if (!referenceNo || (!documentUrl && !smsText)) {
      throw new PortalHttpError("Reference and an uploaded document or SMS text are required.", 400);
    }

    const db = prisma as any;
    const proof = await db.staffProofSubmission.create({
      data: {
        companyId: staff.companyId,
        staffId: staff.id,
        brokerId: text(body.brokerId) || null,
        networkLineId: text(body.networkLineId) || null,
        kind: kind || "OTHER",
        referenceNo,
        smsText: smsText || null,
        documentUrl: documentUrl || null,
        amount: Number.isFinite(Number(body.amount)) ? Number(body.amount).toFixed(2) : null,
        status: "PENDING",
      },
    });

    const accountants = await db.user.findMany({
      where: { companyId: staff.companyId, role: "ACCOUNTANT", status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(accountants.map((accountant: any) => notifyUser(db, {
      companyId: staff.companyId,
      userId: String(accountant.id),
      title: "Staff proof uploaded",
      message: `${staff.name} uploaded ${kind || "proof"} with reference ${referenceNo}.`,
      type: "INFO",
    })));

    return NextResponse.json({ success: true, message: "Proof submitted for verification.", proof }, { status: 201 });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
