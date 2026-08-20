import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return text(value).trim();
}

export async function GET() {
  try {
    const user = await requireCompanyAdmin();
    const companyId = String(user.companyId || "").trim();
    if (!companyId) throw new HttpError("Your account is not connected to a company.", 403);

    const db = prisma as any;
    const devices = await db.companyGpsDevice.findMany({
      where: { companyId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(
      { success: true, devices },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = String(user.companyId || "").trim();
    if (!companyId) throw new HttpError("Your account is not connected to a company.", 403);

    const body = (await request.json()) as Record<string, unknown>;
    const name = clean(body.name);
    const deviceType = clean(body.deviceType || "PHONE").toUpperCase();
    const ownerUserId = clean(body.ownerUserId);
    const allowMultiple = Boolean(body.allowMultiple);

    if (name.length < 2) throw new HttpError("Device name must contain at least 2 characters.", 422);
    if (name.length > 150) throw new HttpError("Device name cannot exceed 150 characters.", 422);
    if (!new Set(["PHONE", "TABLET", "GPS", "OTHER"]).has(deviceType)) {
      throw new HttpError("Device type must be PHONE, TABLET, GPS or OTHER.", 422);
    }

    const db = prisma as any;
    let owner: any = null;

    if (ownerUserId) {
      owner = await db.user.findFirst({
        where: { id: ownerUserId, companyId, status: "ACTIVE" },
        select: { id: true, name: true },
      });
      if (!owner) throw new HttpError("The selected active company user was not found.", 404);

      if (!allowMultiple) {
        const existing = await db.companyGpsDevice.findFirst({
          where: { companyId, ownerUserId, status: "ACTIVE" },
          select: { id: true, name: true },
        });
        if (existing) {
          throw new HttpError(
            `${owner.name} already has an active GPS device (${existing.name}). Enable multiple devices or deactivate the existing device first.`,
            409,
          );
        }
      }
    }

    const device = await db.companyGpsDevice.create({
      data: {
        companyId,
        name,
        deviceType,
        ownerUserId: owner?.id || null,
        ownerName: owner?.name || null,
        deviceToken: crypto.randomBytes(32).toString("hex"),
        status: "ACTIVE",
      },
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "CREATE_GPS_DEVICE",
      module: "GPS",
      details: `Created GPS device ${name}${owner ? ` for ${owner.name}` : ""}.`,
    });

    return NextResponse.json({ success: true, device }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
