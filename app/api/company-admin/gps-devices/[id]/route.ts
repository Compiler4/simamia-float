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
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const existing = await db.companyGpsDevice.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new HttpError("GPS device not found.", 404);

    const device = await db.companyGpsDevice.update({
      where: { id },
      data: {
        name: body.name !== undefined ? text(body.name).trim() : undefined,
        status: body.status !== undefined ? text(body.status) : undefined,
        ownerUserId:
          body.ownerUserId !== undefined
            ? text(body.ownerUserId) || null
            : undefined,
        ownerName:
          body.ownerName !== undefined
            ? text(body.ownerName).trim() || null
            : undefined,
      },
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPDATE_GPS_DEVICE",
      module: "GPS",
      details: `Updated GPS device ${text(existing.name)}.`,
    });

    return NextResponse.json({ success: true, device });
  } catch (error) {
    return routeError(error);
  }
}
