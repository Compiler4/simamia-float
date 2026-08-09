import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

async function requireAccountant() {
  const session = (await getCurrentUser()) as any;
  if (!session) throw Object.assign(new Error("Authentication is required."), { status: 401 });

  const role = text(session.role).toUpperCase();
  if (!new Set(["ACCOUNTANT", "COMPANY_ADMIN"]).has(role)) {
    throw Object.assign(new Error("Accountant access is required."), { status: 403 });
  }
  if (!session.companyId) {
    throw Object.assign(new Error("The user is not assigned to a company."), { status: 403 });
  }

  return {
    id: text(session.id),
    name: text(session.name || session.username || session.email),
    role,
    companyId: text(session.companyId),
  };
}

export async function GET() {
  try {
    const accountant = await requireAccountant();
    const packets = await (prisma as any).verificationPacket.findMany({
      where: {
        companyId: accountant.companyId,
        OR: [
          { assignedAccountantId: null },
          { assignedAccountantId: accountant.id },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, packets });
  } catch (error) {
    return mappedError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const accountant = await requireAccountant();
    const body = await request.json();
    const action = text(body.action).toUpperCase();

    if (action !== "REVIEW_PACKET") {
      return NextResponse.json(
        { success: false, message: "Unsupported verification action." },
        { status: 400 },
      );
    }

    const packetId = text(body.packetId);
    const decision = text(body.decision).toUpperCase();
    const reason = text(body.reason);

    if (!new Set(["VERIFIED", "REJECTED"]).has(decision)) {
      return NextResponse.json(
        { success: false, message: "Choose VERIFIED or REJECTED." },
        { status: 400 },
      );
    }
    if (decision === "REJECTED" && !reason) {
      return NextResponse.json(
        { success: false, message: "A rejection reason is required." },
        { status: 400 },
      );
    }

    const db = prisma as any;
    const packet = await db.verificationPacket.findFirst({
      where: {
        id: packetId,
        companyId: accountant.companyId,
        OR: [
          { assignedAccountantId: null },
          { assignedAccountantId: accountant.id },
        ],
      },
    });

    if (!packet) {
      return NextResponse.json(
        { success: false, message: "The verification packet was not found." },
        { status: 404 },
      );
    }

    const updated = await db.verificationPacket.update({
      where: { id: packet.id },
      data: {
        status: decision,
        reviewedByAccountantId: accountant.id,
        reviewReason: reason || "Verified by Accountant.",
        reviewedAt: new Date(),
      },
    });

    await db.companyNotification.create({
      data: {
        companyId: accountant.companyId,
        targetUserId: packet.sentByAdminId,
        title: `Verification ${decision.toLowerCase()}`,
        message: `${accountant.name} ${decision.toLowerCase()} “${packet.title || packet.targetId}”.`,
        type: decision === "VERIFIED" ? "SUCCESS" : "ERROR",
        link: "/admin/control-centre?module=verification",
      },
    });

    return NextResponse.json({
      success: true,
      message: `The packet was ${decision.toLowerCase()}.`,
      packet: updated,
    });
  } catch (error) {
    return mappedError(error);
  }
}

function mappedError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;

  return NextResponse.json(
    {
      success: false,
      message: error instanceof Error ? error.message : "Verification request failed.",
    },
    { status },
  );
}
