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

    const data: any = {};

    if (body.companyId !== undefined) data.companyId = String(body.companyId);
    if (body.plan !== undefined) data.plan = String(body.plan).trim();
    if (body.amount !== undefined) data.amount = String(body.amount || "0");
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = new Date(body.endsAt);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const subscription = await prisma.subscription.update({
      where: {
        id,
      },
      data,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: subscription.company.id,
        action: "SUBSCRIPTION_UPDATED",
        module: "SUBSCRIPTION",
        details: `${user.name} updated subscription for ${subscription.company.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully.",
      subscription,
    });
  } catch (error) {
    console.error("UPDATE_SUBSCRIPTION_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update subscription.",
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

    const subscription = await prisma.subscription.findUnique({
      where: {
        id,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          message: "Subscription not found.",
        },
        { status: 404 }
      );
    }

    await prisma.subscription.delete({
      where: {
        id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: subscription.company.id,
        action: "SUBSCRIPTION_REMOVED",
        module: "SUBSCRIPTION",
        details: `${user.name} removed subscription for ${subscription.company.name}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription removed successfully.",
    });
  } catch (error) {
    console.error("DELETE_SUBSCRIPTION_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to remove subscription.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}