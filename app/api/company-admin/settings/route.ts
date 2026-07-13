import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
} from "@/lib/company-admin-server";

const booleanFields = [
  "sms",
  "email",
  "inApp",
  "gpsAlerts",
  "dayClosingLock",
  "attendanceApproval",
  "bankMismatchHold",
  "lowCashAlert",
];

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const db = prisma as any;
    const data: Record<string, unknown> = {};

    for (const field of booleanFields) {
      if (body[field] !== undefined) data[field] = Boolean(body[field]);
    }

    if (body.accent !== undefined) data.accent = text(body.accent) || "TEAL";
    if (body.currency !== undefined) {
      data.currency = text(body.currency) || "TZS";
    }
    if (body.timezone !== undefined) {
      data.timezone = text(body.timezone) || "Africa/Dar_es_Salaam";
    }

    const settings = await db.companyAdminSetting.upsert({
      where: { companyId },
      update: data,
      create: {
        companyId,
        ...data,
      },
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPDATE_SETTINGS",
      module: "SETTINGS",
      details: "Updated company portal settings.",
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return routeError(error);
  }
}
