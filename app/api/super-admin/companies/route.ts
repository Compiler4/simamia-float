import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

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

    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim().toUpperCase();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();

    if (!name || !code) {
      return NextResponse.json(
        {
          success: false,
          message: "Company name and code are required.",
        },
        { status: 400 }
      );
    }

    const company = await prisma.company.create({
      data: {
        name,
        code,
        email: email || null,
        phone: phone || null,
        address: address || null,
        status: "ACTIVE",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: company.id,
        action: "COMPANY_CREATED",
        module: "COMPANY",
        details: `${user.name} created company ${company.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Company created successfully.",
      company,
    });
  } catch (error) {
    console.error("CREATE_COMPANY_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create company.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}