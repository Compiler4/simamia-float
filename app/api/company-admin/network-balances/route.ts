import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAudit, requireCompanyMember, routeError, text, toNumber, HttpError } from "@/lib/company-admin-server";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyMember(["COMPANY_ADMIN", "ACCOUNTANT"]);
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;
    const existing = await db.networkBalance.findFirst({ where: { id, companyId } });
    if (!existing) throw new HttpError("Network balance record not found.", 404);
    const data: Record<string, unknown> = { updatedByName: user.name };
    if (body.accountName !== undefined) data.accountName = text(body.accountName).trim() || null;
    if (body.floatBalance !== undefined) { const value = toNumber(body.floatBalance); if (value < 0) throw new HttpError("Float balance cannot be negative.", 422); data.floatBalance = value; }
    if (body.cashBalance !== undefined) { const value = toNumber(body.cashBalance); if (value < 0) throw new HttpError("Cash balance cannot be negative.", 422); data.cashBalance = value; }
    const balance = await db.networkBalance.update({ where: { id }, data });
    await createAudit({ companyId, actorId: user.id, actorName: user.name, actorRole: user.role, action: "UPDATE_NETWORK_BALANCE", module: "ACCOUNTING", details: `Updated ${existing.network} ${existing.simCardNumber}.` });
    return NextResponse.json({ success: true, balance });
  } catch (error) { return routeError(error); }
}
