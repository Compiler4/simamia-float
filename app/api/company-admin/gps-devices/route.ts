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

export async function PATCH(
  request: NextRequest,
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const id = text(body.id ?? body.deviceId).trim();
    const db = prisma as any;
    if (!id) throw new HttpError("GPS device id is required.", 422);

    const existing = await db.companyGpsDevice.findFirst({ where: { id, companyId } });
    if (!existing) throw new HttpError("GPS device not found.", 404);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = text(body.name).trim();
      if (!name) throw new HttpError("Device name cannot be empty.", 422);
      data.name = name;
    }
    if (body.status !== undefined) {
      const status = text(body.status).toUpperCase();
      if (!new Set(["ACTIVE", "INACTIVE"]).has(status)) {
        throw new HttpError("Invalid GPS device status.", 422);
      }
      data.status = status;
    }
    if (body.ownerUserId !== undefined) {
      const ownerUserId = text(body.ownerUserId).trim();
      const owner = await db.user.findFirst({ where: { id: ownerUserId, companyId } });
      if (!owner) throw new HttpError("Assigned user was not found.", 404);
      data.ownerUserId = owner.id;
      data.ownerName = owner.name;
    }
    if (Boolean(body.rotateToken)) {
      data.deviceToken = crypto.randomBytes(32).toString("hex");
    }

    const device = await db.companyGpsDevice.update({ where: { id }, data });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPDATE_GPS_DEVICE",
      module: "GPS",
      details: `Updated GPS device ${existing.name}.`,
    });

    return NextResponse.json({ success: true, device });
  } catch (error) {
    return routeError(error);
  }
}
