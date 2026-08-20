import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown): string {
  return clean(value).toUpperCase().replace(/[^A-Z0-9_-]+/g, "-");
}

function normalizeEmail(value: unknown): string | null {
  const email = clean(value).toLowerCase();
  return email || null;
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

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            branches: true,
            subscriptions: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        email: company.email,
        phone: company.phone,
        address: company.address,
        status: company.status,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        usersCount: company._count.users,
        branchesCount: company._count.branches,
        subscriptionsCount: company._count.subscriptions,
        latestPlan: company.subscriptions[0]?.plan ?? "No Plan",
        latestAmount: company.subscriptions[0]
          ? Number(company.subscriptions[0].amount)
          : 0,
      })),
    });
  } catch (error) {
    console.error("SUPER_ADMIN_COMPANIES_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to load companies." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;

    const body = await request.json();
    const name = clean(body.name);
    const code = normalizeCode(body.code);
    const email = normalizeEmail(body.email);
    const phone = clean(body.phone) || null;
    const address = clean(body.address) || null;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, message: "Company name and company code are required." },
        { status: 422 },
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid company email address." },
        { status: 422 },
      );
    }

    const duplicate = await prisma.company.findUnique({
      where: { code },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "That company code is already registered." },
        { status: 409 },
      );
    }

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name,
          code,
          email,
          phone,
          address,
          status: "ACTIVE",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: created.id,
          action: "COMPANY_CREATED",
          module: "COMPANY",
          details: `${auth.user!.name} registered company ${created.name} (${created.code}).`,
        },
      });

      return created;
    });

    return NextResponse.json(
      { success: true, message: "Company registered successfully.", company },
      { status: 201 },
    );
  } catch (error) {
    console.error("SUPER_ADMIN_COMPANY_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to register company." },
      { status: 500 },
    );
  }
}
