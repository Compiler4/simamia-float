import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = [
  "COMPANY_ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "BROKER",
  "GPS_MANAGER",
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

function normalizeUsername(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, "");
}

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "You are not logged in." },
        { status: 401 },
      ),
    };
  }
  if (user.role !== "SUPER_ADMIN") {
    return {
      user,
      response: NextResponse.json(
        { success: false, message: "Only Super Admin can manage platform users." },
        { status: 403 },
      ),
    };
  }
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;

    const companyId = clean(request.nextUrl.searchParams.get("companyId"));
    const role = clean(request.nextUrl.searchParams.get("role")).toUpperCase();

    const users = await prisma.user.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(role && ALLOWED_ROLES.includes(role as AllowedRole)
          ? { role: role as AllowedRole }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true, code: true, status: true } },
        branch: { select: { id: true, name: true, code: true, status: true } },
      },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("SUPER_ADMIN_USERS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to load users." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;

    const body = await request.json();
    const companyId = clean(body.companyId);
    const branchId = clean(body.branchId) || null;
    const name = clean(body.name);
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const phone = clean(body.phone) || null;
    const password = String(body.password ?? "");
    const role = clean(body.role).toUpperCase() as AllowedRole;

    if (!companyId || !name || !username || !email || !password || !role) {
      return NextResponse.json(
        { success: false, message: "Company, name, username, email, role and password are required." },
        { status: 422 },
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, message: "Role must be Company Admin, Accountant, Staff, Broker or GPS Manager." },
        { status: 422 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid user email address." },
        { status: 422 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must contain at least 8 characters." },
        { status: 422 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, status: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, message: "The selected company was not found." },
        { status: 404 },
      );
    }

    if (company.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Users can only be created for an active company." },
        { status: 409 },
      );
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, companyId },
        select: { id: true },
      });
      if (!branch) {
        return NextResponse.json(
          { success: false, message: "The selected branch does not belong to this company." },
          { status: 422 },
        );
      }
    }

    const duplicate = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true, username: true, email: true },
    });

    if (duplicate) {
      const field = duplicate.email.toLowerCase() === email ? "email" : "username";
      return NextResponse.json(
        { success: false, message: `Another user already uses this ${field}.` },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId,
          branchId,
          name,
          username,
          email,
          phone,
          passwordHash,
          role,
          status: "ACTIVE",
        },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId,
          action: "USER_CREATED",
          module: "USER",
          details: `${auth.user!.name} created ${role.replaceAll("_", " ")} user ${user.name} for ${company.name}.`,
        },
      });

      return user;
    });

    return NextResponse.json(
      { success: true, message: "User created successfully.", user: created },
      { status: 201 },
    );
  } catch (error) {
    console.error("SUPER_ADMIN_USER_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to create user." },
      { status: 500 },
    );
  }
}
