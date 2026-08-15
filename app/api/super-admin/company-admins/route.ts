import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_USER_STATUSES = ["ACTIVE", "SUSPENDED", "REMOVED"] as const;
type AllowedUserStatus = (typeof ALLOWED_USER_STATUSES)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

async function findCompanyAdmin(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      role: "COMPANY_ADMIN" as any,
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
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireSuperAdmin();

    if (authorization.response) {
      return authorization.response;
    }

    const { id } = await context.params;
    const existingAdmin = await findCompanyAdmin(id);

    if (!existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "Company administrator was not found.",
        },
        { status: 404 },
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.companyId !== undefined) {
      const companyId = cleanText(body.companyId);

      if (!companyId) {
        return NextResponse.json(
          {
            success: false,
            message: "A registered company must be selected.",
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

      updateData.companyId = companyId;
      updateData.branchId = null;
    }

    if (body.name !== undefined) {
      const name = cleanText(body.name);

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            message: "Full name is required.",
          },
          { status: 400 },
        );
      }

      updateData.name = name;
    }

    const username =
      body.username !== undefined
        ? normalizeUsername(body.username)
        : existingAdmin.username;

    const email =
      body.email !== undefined
        ? normalizeEmail(body.email)
        : existingAdmin.email.toLowerCase();

    if (!username || !email) {
      return NextResponse.json(
        {
          success: false,
          message: "Username and email are required.",
        },
        { status: 400 },
      );
    }

    if (body.username !== undefined || body.email !== undefined) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [{ username }, { email }],
        },
        select: {
          id: true,
          username: true,
          email: true,
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

      updateData.username = username;
      updateData.email = email;
    }

    if (body.phone !== undefined) {
      updateData.phone = cleanText(body.phone) || null;
    }

    if (body.status !== undefined) {
      const status = String(body.status || "").toUpperCase();

      if (!isAllowedStatus(status)) {
        return NextResponse.json(
          {
            success: false,
            message: "Status must be ACTIVE, SUSPENDED or REMOVED.",
          },
          { status: 400 },
        );
      }

      updateData.status = status as any;
    }

    if (body.password !== undefined && cleanText(body.password)) {
      const password = cleanText(body.password);

      if (password.length < 8) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must contain at least 8 characters.",
          },
          { status: 400 },
        );
      }

      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    updateData.role = "COMPANY_ADMIN" as any;

    const companyAdmin = await prisma.user.update({
      where: {
        id,
      },
      data: updateData as any,
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

    return NextResponse.json({
      success: true,
      message: "Company administrator updated successfully.",
      companyAdmin,
    });
  } catch (error) {
    console.error("UPDATE_COMPANY_ADMIN_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update company administrator.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireSuperAdmin();

    if (authorization.response) {
      return authorization.response;
    }

    const { id } = await context.params;
    const existingAdmin = await findCompanyAdmin(id);

    if (!existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "Company administrator was not found.",
        },
        { status: 404 },
      );
    }

    const companyAdmin = await prisma.user.update({
      where: {
        id,
      },
      data: {
        status: "REMOVED" as any,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        companyId: true,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Company administrator removed successfully. The account can be restored later.",
      companyAdmin,
    });
  } catch (error) {
    console.error("REMOVE_COMPANY_ADMIN_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to remove company administrator.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
