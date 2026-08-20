import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPANY_STATUSES = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
type CompanyStatusValue = (typeof COMPANY_STATUSES)[number];

type RouteContext = { params: Promise<{ id: string }> };

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown): string {
  return clean(value).toUpperCase().replace(/[^A-Z0-9_-]+/g, "-");
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
        { success: false, message: "Only Super Admin can manage companies." },
        { status: 403 },
      ),
    };
  }
  return { user, response: null };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;
    const { id } = await context.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        branches: { orderBy: { createdAt: "desc" } },
        users: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            branchId: true,
            createdAt: true,
          },
        },
        subscriptions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, company });
  } catch (error) {
    console.error("SUPER_ADMIN_COMPANY_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to load company." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;
    const { id } = await context.params;

    const existing = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Company was not found." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) {
        return NextResponse.json(
          { success: false, message: "Company name cannot be empty." },
          { status: 422 },
        );
      }
      data.name = name;
    }

    if (body.code !== undefined) {
      const code = normalizeCode(body.code);
      if (!code) {
        return NextResponse.json(
          { success: false, message: "Company code cannot be empty." },
          { status: 422 },
        );
      }
      const duplicate = await prisma.company.findFirst({
        where: { code, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "Another company already uses that code." },
          { status: 409 },
        );
      }
      data.code = code;
    }

    if (body.email !== undefined) {
      const email = clean(body.email).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid company email address." },
          { status: 422 },
        );
      }
      data.email = email || null;
    }

    if (body.phone !== undefined) data.phone = clean(body.phone) || null;
    if (body.address !== undefined) data.address = clean(body.address) || null;

    if (body.status !== undefined) {
      const status = clean(body.status).toUpperCase() as CompanyStatusValue;
      if (!COMPANY_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, message: "Company status must be ACTIVE, SUSPENDED or DISABLED." },
          { status: 422 },
        );
      }
      data.status = status;
    }

    const company = await prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id },
        data: data as any,
      });

      if (data.status === "SUSPENDED" || data.status === "DISABLED") {
        await tx.user.updateMany({
          where: { companyId: id, status: "ACTIVE" },
          data: { status: "SUSPENDED" },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: id,
          action: "COMPANY_UPDATED",
          module: "COMPANY",
          details: `${auth.user!.name} updated ${updated.name}.`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Company updated successfully.",
      company,
    });
  } catch (error) {
    console.error("SUPER_ADMIN_COMPANY_UPDATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update company." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;
    const { id } = await context.params;

    const existing = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Company was not found." },
        { status: 404 },
      );
    }

    const company = await prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id },
        data: { status: "DISABLED" },
      });

      await tx.user.updateMany({
        where: { companyId: id, status: { not: "REMOVED" } },
        data: { status: "SUSPENDED" },
      });

      await tx.subscription.updateMany({
        where: { companyId: id, isActive: true },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: id,
          action: "COMPANY_DISABLED",
          module: "COMPANY",
          details: `${auth.user!.name} disabled ${existing.name}. Data was retained.`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Company disabled successfully. Existing company data was retained.",
      company,
    });
  } catch (error) {
    console.error("SUPER_ADMIN_COMPANY_DISABLE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to disable company." },
      { status: 500 },
    );
  }
}
