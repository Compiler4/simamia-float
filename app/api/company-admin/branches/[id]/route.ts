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

    const branch = await db.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw new HttpError("Branch not found.", 404);

    const updated = await db.branch.update({
      where: { id },
      data: {
        name: body.name !== undefined ? text(body.name).trim() : undefined,
        code: body.code !== undefined ? text(body.code).trim() : undefined,
        region:
          body.region !== undefined ? text(body.region).trim() || null : undefined,
        address:
          body.address !== undefined
            ? text(body.address).trim() || null
            : undefined,
        status: body.status !== undefined ? text(body.status) : undefined,
      },
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPDATE_BRANCH",
      module: "BRANCHES",
      details: `Updated branch ${text(branch.name)}.`,
    });

    return NextResponse.json({ success: true, branch: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const db = prisma as any;

    const branch = await db.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw new HttpError("Branch not found.", 404);

    const assignedUsers = await db.user.count({
      where: { companyId, branchId: id },
    });

    if (assignedUsers > 0) {
      throw new HttpError(
        "Move users to another branch before removing this branch.",
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
      details: `Removed branch ${text(branch.name)}.`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
