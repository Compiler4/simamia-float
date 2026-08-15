import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAudit, requireCompanyAdmin, routeError, text, HttpError } from "@/lib/company-admin-server";

const booleanFields = ["sms", "email", "inApp", "gpsAlerts", "dayClosingLock", "attendanceApproval", "bankMismatchHold", "lowCashAlert"] as const;

function boundedInteger(value: unknown, min: number, max: number, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new HttpError(`${label} must be between ${min} and ${max}.`, 422);
  return parsed;
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const field of booleanFields) if (body[field] !== undefined) data[field] = Boolean(body[field]);
    if (body.accent !== undefined) data.accent = text(body.accent) || "TEAL";
    if (body.currency !== undefined) data.currency = text(body.currency) || "TZS";
    if (body.timezone !== undefined) data.timezone = text(body.timezone) || "Africa/Dar_es_Salaam";
    if (body.proofGraceMinutes !== undefined) data.proofGraceMinutes = boundedInteger(body.proofGraceMinutes, 5, 1440, "Proof grace minutes");
    if (body.visitRadiusMeters !== undefined) data.visitRadiusMeters = boundedInteger(body.visitRadiusMeters, 20, 5000, "Visit radius");
    if (body.minimumPerformanceScore !== undefined) data.minimumPerformanceScore = boundedInteger(body.minimumPerformanceScore, 0, 100, "Minimum performance score");

    const reportSettings = [
      ["company.logoUrl", text(body.reportLogoUrl).slice(0, 2000)],
      ["company.registrationNumber", text(body.registrationNumber).slice(0, 255)],
      ["company.tin", text(body.tin).slice(0, 255)],
      ["company.website", text(body.website).slice(0, 1000)],
    ] as const;

    const settings = await (prisma as any).$transaction(async (tx: any) => {
      const portalSettings = await tx.companyAdminSetting.upsert({
        where: { companyId },
        update: data,
        create: { companyId, ...data },
      });

      for (const [key, value] of reportSettings) {
        await tx.companySetting.upsert({
          where: { companyId_key: { companyId, key } },
          update: { value },
          create: { companyId, key, value },
        });
      }
      return portalSettings;
    });
    await createAudit({ companyId, actorId: user.id, actorName: user.name, actorRole: user.role, action: "UPDATE_SETTINGS", module: "SETTINGS", details: "Updated company portal settings and control thresholds." });
    return NextResponse.json({ success: true, settings });
  } catch (error) { return routeError(error); }
}
