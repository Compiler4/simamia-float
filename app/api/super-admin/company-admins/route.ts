import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_USER_STATUSES = ["ACTIVE", "SUSPENDED", "REMOVED"] as const;
type AllowedUserStatus = (typeof ALLOWED_USER_STATUSES)[number];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function normalizeUsername(value: unknown) {
  return cleanText(value).toLowerCase().replace(/\s+/g, "");
}

function isAllowedStatus(value: unknown): value is AllowedUserStatus {
  return ALLOWED_USER_STATUSES.includes(
    String(value || "").toUpperCase() as AllowedUserStatus,
  );
}

async function requireSuperAdmin() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      currentUser: null,
      response: NextResponse.json(
        {
          success: false,
          message: "You are not logged in.",
        },
        { status: 401 },
      ),
    };
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return {
      currentUser,
      response: NextResponse.json(
        {
          success: false,
          message: "Only Super Admin can manage company administrators.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    currentUser,
    response: null,
  };
}

export async function GET() {
  try {
    const authorization = await requireSuperAdmin();

    if (authorization.response) {
      return authorization.response;
    }

    const companyAdmins = await prisma.user.findMany({
      where: {
        role: "COMPANY_ADMIN" as any,
      },
      orderBy: {
        createdAt: "desc",
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
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      companyAdmins,
    });
  } catch (error) {
    console.error("GET_COMPANY_ADMINS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load company administrators.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireSuperAdmin();

    if (authorization.response) {
      return authorization.response;
    }

    const body = await request.json();

    const companyId = cleanText(body.companyId);
    const name = cleanText(body.name);
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const phone = cleanText(body.phone);
    const password = cleanText(body.password);
    const requestedStatus = String(body.status || "ACTIVE").toUpperCase();
    const status: AllowedUserStatus = isAllowedStatus(requestedStatus)
      ? requestedStatus
      : "ACTIVE";

    if (!companyId || !name || !username || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Company, full name, username, email and password are required.",
        },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must contain at least 8 characters.",
        },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message: "The selected registered company was not found.",
        },
        { status: 404 },
      );
    }

    const duplicateUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (duplicateUser) {
      const duplicateField =
        duplicateUser.email.toLowerCase() === email ? "email" : "username";

      return NextResponse.json(
        {
          success: false,
          message: `Another user already uses this ${duplicateField}.`,
        },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const companyAdmin = await prisma.user.create({
      data: {
        companyId,
        branchId: null,
        name,
        username,
        email,
        phone: phone || null,
        passwordHash,
        role: "COMPANY_ADMIN" as any,
        status: status as any,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Company administrator created for ${company.name}.`,
        companyAdmin,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_COMPANY_ADMIN_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create company administrator.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
