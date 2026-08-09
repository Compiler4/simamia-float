import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  createNotification,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const allowedRoles = new Set([
  "COMPANY_ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "GPS_MANAGER",
]);
const allowedGenders = new Set(["MALE", "FEMALE", "OTHER"]);
const allowedStatuses = new Set(["ACTIVE", "SUSPENDED"]);

function safeUser(user: any) {
  const { passwordHash: _passwordHash, password: _legacyPassword, ...result } =
    user;
  return result;
}

function validNida(value: string): boolean {
  return /^\d{20}$/.test(value.replace(/\s+/g, ""));
}

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
        NOT: { role: { in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"] } },
      },
    });
    if (!target) throw new HttpError("User was not found in your company.", 404);

    const data: Record<string, unknown> = {};

    for (const field of [
      "name",
      "username",
      "email",
      "phone",
      "nationality",
      "physicalAddress",
      "profileImageUrl",
      "assignedRegion",
    ]) {
      if (body[field] !== undefined) {
        const value = text(body[field]).trim();
        if (!value) {
          throw new HttpError(`${field} cannot be empty.`, 422);
        }
        data[field] = value;
      }
    }

    if (body.email !== undefined) data.email = text(body.email).trim().toLowerCase();

    if (body.status !== undefined) {
      const status = text(body.status).trim().toUpperCase();
      if (!allowedStatuses.has(status)) {
        throw new HttpError("User status must be ACTIVE or SUSPENDED.", 422);
      }
      data.status = status;
    }

    if (body.branchId !== undefined) {
      const branchId = text(body.branchId).trim();
      if (!branchId) throw new HttpError("Branch cannot be empty.", 422);
      const branch = await db.branch.findFirst({ where: { id: branchId, companyId } });
      if (!branch) throw new HttpError("Selected branch was not found.", 404);
      data.branchId = branchId;
    }

    if (body.role !== undefined) {
      const role = text(body.role).toUpperCase();
      if (!allowedRoles.has(role)) throw new HttpError("Invalid user role.", 422);
      data.role = role;
    }

    if (body.gender !== undefined) {
      const gender = text(body.gender).toUpperCase();
      if (!allowedGenders.has(gender)) throw new HttpError("Invalid gender.", 422);
      data.gender = gender;
    }

    if (body.nidaNumber !== undefined) {
      const nidaNumber = text(body.nidaNumber).replace(/\s+/g, "");
      if (!validNida(nidaNumber)) {
        throw new HttpError("NIDA number must contain exactly 20 digits.", 422);
      }
      const duplicate = await db.user.findFirst({
        where: { companyId, nidaNumber, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) throw new HttpError("NIDA number is already registered.", 409);
      data.nidaNumber = nidaNumber;
    }

    if (body.dateOfBirth !== undefined) {
      const date = new Date(text(body.dateOfBirth));
      if (Number.isNaN(date.getTime()) || date >= new Date()) {
        throw new HttpError("Enter a valid date of birth.", 422);
      }
      data.dateOfBirth = date;
    }

    if (text(body.password)) {
      const password = text(body.password);
      if (password.length < 8) {
        throw new HttpError("Password must be at least 8 characters.", 422);
      }
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const loginChecks = [
      data.email ? { email: data.email } : null,
      data.username ? { username: data.username } : null,
    ].filter(Boolean);

    if (loginChecks.length) {
      const duplicateLogin = await db.user.findFirst({
        where: {
          NOT: { id },
          OR: loginChecks,
        },
        select: { id: true },
      });
      if (duplicateLogin) {
        throw new HttpError("Email or username is already in use.", 409);
      }
    }

    const updated = await db.user.update({ where: { id }, data });

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

    return NextResponse.json({ success: true, user: safeUser(updated) });
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

    if (id === sessionUser.id) {
      throw new HttpError("You cannot remove your own account.", 422);
    }

    const target = await db.user.findFirst({
      where: {
        id,
        companyId,
        NOT: { role: { in: ["SYSTEM_DEVELOPER", "SUPER_ADMIN"] } },
      },
    });
    if (!target) throw new HttpError("User was not found in your company.", 404);

    await db.user.update({
      where: { id },
      data: { status: "REMOVED" },
    });

    await createAudit({
      companyId,
      actorId: sessionUser.id,
      actorName: sessionUser.name,
      actorRole: sessionUser.role,
      action: "REMOVE_USER",
      module: "USERS",
      details: `Soft-removed ${text(target.name)} (${id}).`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
