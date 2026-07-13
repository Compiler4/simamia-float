import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const name = text(body.name).trim();
    const deviceType = text(body.deviceType).trim();

    if (!name || !deviceType) {
      throw new HttpError("Device name and type are required.", 422);
    }

    const owner = body.ownerUserId
      ? await db.user.findFirst({
          where: {
            id: text(body.ownerUserId),
            companyId,
          },
        })
      : null;

    const device = await db.companyGpsDevice.create({
      data: {
        companyId,
        name,
        deviceType,
        ownerUserId: owner?.id ?? null,
        ownerName: owner?.name ?? (text(body.ownerName).trim() || null),
        deviceToken: crypto.randomBytes(24).toString("hex"),
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
      details: `Created GPS device ${name}.`,
    });

    return NextResponse.json({ success: true, device });
  } catch (error) {
    return routeError(error);
  }
}
