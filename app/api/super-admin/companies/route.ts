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
    const status = String(body.status || "").toUpperCase();

    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid company status.",
        },
        { status: 400 }
      );
    }

    const company = await prisma.company.update({
      where: {
        id,
      },
      data: {
        status: status as "ACTIVE" | "SUSPENDED",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: company.id,
        action: status === "ACTIVE" ? "COMPANY_ACTIVATED" : "COMPANY_SUSPENDED",
        module: "COMPANY",
        details: `${user.name} changed ${company.name} status to ${status}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Company ${status.toLowerCase()} successfully.`,
      company,
    });
  } catch (error) {
    console.error("UPDATE_COMPANY_STATUS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update company status.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}