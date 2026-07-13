import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;

    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.code !== undefined) {
      updateData.code = String(body.code).trim().toUpperCase();
    }
    if (body.email !== undefined) {
      updateData.email = String(body.email || "").trim() || null;
    }
    if (body.phone !== undefined) {
      updateData.phone = String(body.phone || "").trim() || null;
    }
    if (body.address !== undefined) {
      updateData.address = String(body.address || "").trim() || null;
    }
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();

      if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid company status.",
          },
          { status: 400 }
        );
      }

      updateData.status = status;
    }

    const company = await prisma.company.update({
      where: {
        id,
      },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: company.id,
        action: "COMPANY_UPDATED",
        module: "COMPANY",
        details: `${user.name} updated company ${company.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Company updated successfully.",
      company,
    });
  } catch (error) {
    console.error("UPDATE_COMPANY_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update company.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;

    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const company = await prisma.company.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message: "Company not found.",
        },
        { status: 404 }
      );
    }

    await prisma.company.delete({
      where: {
        id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "COMPANY_REMOVED",
        module: "COMPANY",
        details: `${user.name} removed company ${company.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Company removed successfully.",
    });
  } catch (error) {
    console.error("DELETE_COMPANY_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to remove company. Check if company has protected records.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}