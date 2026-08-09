import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const statuses = new Set(["ACTIVE", "SUSPENDED"]);

export async function PATCH(
  request: NextRequest,
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const id = text(body.id).trim();
    const db = prisma as any;
    if (!id) throw new HttpError("Branch id is required.", 422);
    const current = await db.branch.findFirst({ where: { id, companyId } });
    if (!current) throw new HttpError("Branch not found.", 404);

    const data: Record<string, unknown> = {};
    for (const key of ["name", "code", "region", "address"] as const) {
      if (body[key] !== undefined) {
        const value = text(body[key]).trim();
        if (!value) throw new HttpError(`${key} cannot be empty.`, 422);
        data[key] = key === "code" ? value.toUpperCase() : value;
      }
    }

    if (body.status !== undefined) {
      const status = text(body.status).trim().toUpperCase();
      if (!statuses.has(status)) {
        throw new HttpError("Branch status must be ACTIVE or SUSPENDED.", 422);
      }
      data.status = status;
    }

    if (data.code) {
      const duplicate = await db.branch.findFirst({
        where: { companyId, code: data.code, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) throw new HttpError("This branch code is already registered.", 409);
    }

    const branch = await db.branch.update({ where: { id }, data });
    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPDATE_BRANCH",
      module: "BRANCHES",
      details: `Updated branch ${current.name}.`,
    });
    return NextResponse.json({ success: true, branch });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const id = text(request.nextUrl.searchParams.get("id")).trim();
    const db = prisma as any;
    if (!id) throw new HttpError("Branch id is required.", 422);
    const current = await db.branch.findFirst({ where: { id, companyId } });
    if (!current) throw new HttpError("Branch not found.", 404);

    const assigned = await db.user.count({
      where: { companyId, branchId: id, NOT: { status: "REMOVED" } },
    });
    if (assigned > 0) {
      throw new HttpError(
        "Move all users to another branch before removing this branch.",
        409,
      );
    }

    await db.branch.delete({ where: { id } });
    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "DELETE_BRANCH",
      module: "BRANCHES",
      details: `Removed branch ${current.name}.`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
