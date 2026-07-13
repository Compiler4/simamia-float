import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendNotice } from "@/lib/staff/notify";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}


export async function GET() {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    if (session.role !== "ACCOUNTANT") return NextResponse.json({ success: false, message: "Accountant access is required." }, { status: 403 });
    if (!session.companyId) return NextResponse.json({ success: false, message: "Your account is not attached to a company." }, { status: 403 });

    const [staff, transactions] = await Promise.all([
      (db as any).user.findMany({
        where: { companyId: String(session.companyId), role: "STAFF", status: "ACTIVE" },
        select: { id: true, name: true, username: true, email: true, profileImageUrl: true },
        orderBy: { name: "asc" },
      }),
      (db as any).floatTransaction.findMany({
        where: { companyId: String(session.companyId), transactionType: "ACCOUNTANT_TO_STAFF", fromUserId: String(session.id) },
        include: { toUser: { select: { id: true, name: true, username: true, email: true, profileImageUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    return NextResponse.json(JSON.parse(JSON.stringify({ success: true, staff, transactions })));
  } catch (error) {
    console.error("[ACCOUNTANT_STAFF_FLOAT_GET]", error);
    return NextResponse.json({ success: false, message: "Staff float assignments could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    if (session.role !== "ACCOUNTANT") {
      return NextResponse.json({ success: false, message: "Accountant access is required." }, { status: 403 });
    }
    if (!session.companyId) {
      return NextResponse.json({ success: false, message: "Your account is not attached to a company." }, { status: 403 });
    }

    const body = await request.json();
    const staffId = text(body.staffId);
    const purpose = text(body.purpose);
    const amount = Number(body.amount);
    if (!staffId || !purpose || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "staffId, purpose, and a valid amount are required." },
        { status: 400 },
      );
    }

    const staff = await (db as any).user.findFirst({
      where: { id: staffId, companyId: String(session.companyId), role: "STAFF", status: "ACTIVE" },
    });
    if (!staff) return NextResponse.json({ success: false, message: "The active staff officer was not found." }, { status: 404 });

    const transaction = await (db as any).floatTransaction.create({
      data: {
        companyId: String(session.companyId),
        fromUserId: String(session.id),
        toUserId: staff.id,
        transactionType: "ACCOUNTANT_TO_STAFF",
        referenceNo: text(body.referenceNo) || `AFS-${Date.now().toString(36).toUpperCase()}`,
        amount,
        purpose,
        notes: text(body.notes) || null,
        status: "ISSUED",
        issuedAt: new Date(),
      },
    });

    await sendNotice({
      companyId: String(session.companyId),
      userId: staff.id,
      title: "Morning float assigned",
      message: `${session.name ?? "Accountant"} assigned TZS ${amount.toLocaleString()} to you. Open Receive Float to confirm it.`,
      type: "INFO",
    });

    return NextResponse.json({ success: true, message: "Float assigned to staff successfully.", transaction });
  } catch (error) {
    console.error("[ACCOUNTANT_STAFF_FLOAT]", error);
    return NextResponse.json(
      { success: false, message: "The float could not be assigned to staff." },
      { status: 500 },
    );
  }
}
