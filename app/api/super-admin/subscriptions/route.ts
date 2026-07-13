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

    const companyId = String(body.companyId || "");
    const plan = String(body.plan || "").trim();
    const amount = String(body.amount || "0");
    const startsAt = String(body.startsAt || "");
    const endsAt = String(body.endsAt || "");
    const isActive = Boolean(body.isActive);

    if (!companyId || !plan || !startsAt || !endsAt) {
      return NextResponse.json(
        {
          success: false,
          message: "Company, plan, start date and end date are required.",
        },
        { status: 400 }
      );
    }

    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        plan,
        amount,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        isActive,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId,
        action: "SUBSCRIPTION_CREATED",
        module: "SUBSCRIPTION",
        details: `${user.name} created ${plan} subscription for ${subscription.company.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription created successfully.",
      subscription,
    });
  } catch (error) {
    console.error("CREATE_SUBSCRIPTION_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create subscription.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}