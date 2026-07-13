import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRoles = ["STAFF", "BROKER", "GPS_MANAGER", "ACCOUNTANT"];
const maxSize = 5 * 1024 * 1024;
const allowed = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"],
]);

export async function POST(request: Request) {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) {
      return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
    }
    if (!allowedRoles.includes(String(session.role)) || !session.companyId) {
      return NextResponse.json({ success: false, message: "Float receipt access is not allowed." }, { status: 403 });
    }

    const form = await request.formData();
    const floatId = String(form.get("floatId") ?? "").trim();
    const returnedAmount = Number(form.get("returnedAmount") ?? 0);
    const file = form.get("file");

    if (!floatId || !Number.isFinite(returnedAmount) || returnedAmount <= 0) {
      return NextResponse.json({ success: false, message: "Float and returned amount are required." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size <= 0 || file.size > maxSize) {
      return NextResponse.json({ success: false, message: "Upload a receipt smaller than 5 MB." }, { status: 400 });
    }

    const extension = allowed.get(file.type);
    if (!extension) {
      return NextResponse.json({ success: false, message: "Use JPG, PNG, WebP or PDF." }, { status: 400 });
    }

    const float = await (db as any).floatTransaction.findFirst({
      where: {
        id: floatId,
        companyId: String(session.companyId),
        OR: [{ toUserId: String(session.id) }, { fromUserId: String(session.id) }],
        status: { in: ["PENDING", "ISSUED", "CONFIRMED"] },
      },
    });

    if (!float) {
      return NextResponse.json({ success: false, message: "The float was not found or is already completed." }, { status: 404 });
    }

    if (returnedAmount > Number(float.amount)) {
      return NextResponse.json({ success: false, message: "Returned amount cannot exceed the issued float." }, { status: 400 });
    }

    const directory = path.join(process.cwd(), "public", "uploads", "float-receipts", String(session.companyId));
    await mkdir(directory, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
    const receiptUrl = `/uploads/float-receipts/${session.companyId}/${filename}`;

    await (db as any).floatTransaction.update({
      where: { id: float.id },
      data: {
        receiptUrl,
        returnedAmount,
        returnedAt: new Date(),
        status: "RETURNED",
      },
    });

    const accountants = await (db as any).user.findMany({
      where: { companyId: String(session.companyId), role: "ACCOUNTANT", status: "ACTIVE" },
      select: { id: true },
    });

    for (const accountant of accountants) {
      await (db as any).notification.create({
        data: {
          companyId: String(session.companyId),
          userId: accountant.id,
          title: "Float receipt uploaded",
          message: `${session.name ?? session.email ?? "Staff"} returned ${returnedAmount.toLocaleString()} and uploaded a receipt for verification.`,
          type: "INFO",
        },
      });
    }

    return NextResponse.json({ success: true, message: "Receipt uploaded. The float is waiting for accountant verification.", receiptUrl });
  } catch (error) {
    console.error("[STAFF_FLOAT_RECEIPT]", error);
    return NextResponse.json({ success: false, message: "The float receipt could not be submitted." }, { status: 500 });
  }
}
