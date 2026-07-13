import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const allowedRoles = [
  "COMPANY_ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "BROKER",
  "GPS_MANAGER",
];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await requireCompanyAdmin();
    const companyId = sessionUser.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const target = await db.user.findFirst({
      where: {
        id,
        companyId,
        NOT: {
          role: {
            in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"],
          },
        },
      },
    });

    if (!target) {
      throw new HttpError("User was not found in your company.", 404);
    }

    const data: Record<string, unknown> = {};

    for (const field of ["name", "username", "email", "phone", "status"]) {
      if (body[field] !== undefined) {
        data[field] =
          field === "phone"
            ? text(body[field]).trim() || null
            : text(body[field]).trim();
      }
    }

    if (body.branchId !== undefined) {
      data.branchId = text(body.branchId) || null;
    }

    if (body.role !== undefined) {
      const role = text(body.role);
      if (!allowedRoles.includes(role)) {
        throw new HttpError("Invalid company user role.", 422);
      }
      data.role = role;
    }

    if (text(body.password)) {
      data.password = await bcrypt.hash(text(body.password), 12);
    }

    const updated = await db.user.update({
      where: { id },
      data,
    });

    if (body.status !== undefined && text(body.status) !== text(target.status)) {
      await createNotification({
        companyId,
        targetUserId: id,
        title: `Account ${text(body.status).toLowerCase()}`,
        message: `${sessionUser.name} changed your account status to ${text(body.status)}.`,
        type: text(body.status) === "ACTIVE" ? "SUCCESS" : "WARNING",
        link: "/dashboard",
      });
    }

    await createAudit({
      companyId,
      actorId: sessionUser.id,
      actorName: sessionUser.name,
      actorRole: sessionUser.role,
      action: "UPDATE_USER",
      module: "USERS",
      details: `Updated ${text(target.name)} (${id}).`,
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updated,
        password: undefined,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await requireCompanyAdmin();
    const companyId = sessionUser.companyId as string;
    const { id } = await context.params;
    const db = prisma as any;

    const target = await db.user.findFirst({
      where: {
        id,
        companyId,
        NOT: {
          role: {
            in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"],
          },
        },
      },
    });

    if (!target) {
      throw new HttpError("User was not found in your company.", 404);
    }

    if (id === sessionUser.id) {
      throw new HttpError("You cannot remove your own account.", 422);
    }

    await db.user.delete({ where: { id } });

    await createAudit({
      companyId,
      actorId: sessionUser.id,
      actorName: sessionUser.name,
      actorRole: sessionUser.role,
      action: "DELETE_USER",
      module: "USERS",
      details: `Removed ${text(target.name)} (${id}).`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
