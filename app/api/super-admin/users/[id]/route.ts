import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["COMPANY_ADMIN", "ACCOUNTANT", "STAFF", "BROKER", "GPS_MANAGER"] as const;
const ALLOWED_STATUSES = ["ACTIVE", "SUSPENDED", "REMOVED"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];
type RouteContext = { params: Promise<{ id: string }> };

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ success: false, message: "You are not logged in." }, { status: 401 }) };
  }
  if (user.role !== "SUPER_ADMIN") {
    return { user, response: NextResponse.json({ success: false, message: "Only Super Admin can manage platform users." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;
    const { id } = await context.params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, companyId: true, role: true, email: true, username: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: "User was not found." }, { status: 404 });
    }
    if (existing.role === "SUPER_ADMIN" || existing.role === "SYSTEM_DEVELOPER") {
      return NextResponse.json({ success: false, message: "Protected system identities cannot be changed from this route." }, { status: 403 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.companyId !== undefined) {
      const companyId = clean(body.companyId);
      if (!companyId) return NextResponse.json({ success: false, message: "Company is required." }, { status: 422 });
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) return NextResponse.json({ success: false, message: "Selected company was not found." }, { status: 404 });
      data.companyId = companyId;
      data.branchId = null;
    }

    if (body.branchId !== undefined) data.branchId = clean(body.branchId) || null;
    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) return NextResponse.json({ success: false, message: "Name cannot be empty." }, { status: 422 });
      data.name = name;
    }
    if (body.phone !== undefined) data.phone = clean(body.phone) || null;

    const username = body.username !== undefined ? clean(body.username).toLowerCase().replace(/\s+/g, "") : existing.username;
    const email = body.email !== undefined ? clean(body.email).toLowerCase() : existing.email.toLowerCase();

    if (body.username !== undefined || body.email !== undefined) {
      if (!username || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ success: false, message: "Valid username and email are required." }, { status: 422 });
      }
      const duplicate = await prisma.user.findFirst({
        where: { id: { not: id }, OR: [{ username }, { email }] },
        select: { id: true, username: true, email: true },
      });
      if (duplicate) {
        const field = duplicate.email.toLowerCase() === email ? "email" : "username";
        return NextResponse.json({ success: false, message: `Another user already uses this ${field}.` }, { status: 409 });
      }
      data.username = username;
      data.email = email;
    }

    if (body.role !== undefined) {
      const role = clean(body.role).toUpperCase() as AllowedRole;
      if (!ALLOWED_ROLES.includes(role)) {
        return NextResponse.json({ success: false, message: "Invalid user role." }, { status: 422 });
      }
      data.role = role;
    }

    if (body.status !== undefined) {
      const status = clean(body.status).toUpperCase() as AllowedStatus;
      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json({ success: false, message: "Invalid user status." }, { status: 422 });
      }
      data.status = status;
    }

    if (body.password !== undefined && String(body.password ?? "")) {
      const password = String(body.password);
      if (password.length < 8) return NextResponse.json({ success: false, message: "Password must contain at least 8 characters." }, { status: 422 });
      data.passwordHash = await bcrypt.hash(password, 12);
      data.passwordChangedAt = new Date();
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: data as any,
        select: {
          id: true, companyId: true, branchId: true, name: true, username: true, email: true,
          phone: true, role: true, status: true, createdAt: true, updatedAt: true,
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: updated.companyId,
          action: "USER_UPDATED",
          module: "USER",
          details: `${auth.user!.name} updated user ${updated.name}.`,
        },
      });
      return updated;
    });

    return NextResponse.json({ success: true, message: "User updated successfully.", user });
  } catch (error) {
    console.error("SUPER_ADMIN_USER_UPDATE_ERROR", error);
    return NextResponse.json({ success: false, message: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;
    const { id } = await context.params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, companyId: true },
    });
    if (!existing) return NextResponse.json({ success: false, message: "User was not found." }, { status: 404 });
    if (existing.role === "SUPER_ADMIN" || existing.role === "SYSTEM_DEVELOPER") {
      return NextResponse.json({ success: false, message: "Protected system identities cannot be removed." }, { status: 403 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: "REMOVED" },
        select: { id: true, name: true, companyId: true, role: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: updated.companyId,
          action: "USER_REMOVED",
          module: "USER",
          details: `${auth.user!.name} removed user ${updated.name}.`,
        },
      });
      return updated;
    });

    return NextResponse.json({ success: true, message: "User removed successfully.", user });
  } catch (error) {
    console.error("SUPER_ADMIN_USER_REMOVE_ERROR", error);
    return NextResponse.json({ success: false, message: "Failed to remove user." }, { status: 500 });
  }
}
