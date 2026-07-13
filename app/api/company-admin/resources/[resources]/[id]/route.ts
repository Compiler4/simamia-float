import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function getModel(resource: string) {
  const db = prisma as any;

  const models: Record<string, any> = {
    branches: prisma.branch,
    products: db.product,
    customers: db.customer,
    services: db.serviceActivity,
    gps: db.gpsTracking,
  };

  return models[resource];
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { resource, id } = await context.params;

    if (!user || user.role !== "COMPANY_ADMIN" || !user.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const model = getModel(resource);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid resource.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data: any = {};

    for (const [key, value] of Object.entries(body)) {
      if (key === "companyId") continue;

      if (
        ["price", "amount", "speed", "distanceTraveled"].includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        data[key] = String(value);
      } else if (
        ["stock", "stops", "geofenceViolations"].includes(key) &&
        value !== null &&
        value !== undefined
      ) {
        data[key] = Number(value);
      } else if (["servedAt", "recordedAt"].includes(key) && value) {
        data[key] = new Date(String(value));
      } else {
        data[key] = value === "" ? null : value;
      }
    }

    const saved = await model.update({
      where: {
        id,
      },
      data,
    });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: `${resource.toUpperCase()}_UPDATED`,
        module: "COMPANY_ADMIN",
        details: `${user.name} updated ${resource} record.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Record updated successfully.",
      data: saved,
    });
  } catch (error) {
    console.error("COMPANY_ADMIN_RESOURCE_UPDATE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update record.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { resource, id } = await context.params;

    if (!user || user.role !== "COMPANY_ADMIN" || !user.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const model = getModel(resource);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid resource.",
        },
        { status: 400 }
      );
    }

    await model.delete({
      where: {
        id,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: `${resource.toUpperCase()}_REMOVED`,
        module: "COMPANY_ADMIN",
        details: `${user.name} removed ${resource} record.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Record removed successfully.",
    });
  } catch (error) {
    console.error("COMPANY_ADMIN_RESOURCE_DELETE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to remove record.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}