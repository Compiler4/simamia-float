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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { resource } = await context.params;

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
    let data: any = { companyId: user.companyId };

    if (resource === "branches") {
      data = {
        companyId: user.companyId,
        name: String(body.name || "").trim(),
        code: String(body.code || "").trim().toUpperCase(),
        region: String(body.region || "").trim() || null,
        address: String(body.address || "").trim() || null,
        status: "ACTIVE",
      };
    }

    if (resource === "products") {
      data = {
        companyId: user.companyId,
        name: String(body.name || "").trim(),
        sku: String(body.sku || "").trim() || null,
        category: String(body.category || "").trim() || null,
        price: String(body.price || "0"),
        stock: Number(body.stock || 0),
        status: String(body.status || "ACTIVE"),
        description: String(body.description || "").trim() || null,
      };
    }

    if (resource === "customers") {
      data = {
        companyId: user.companyId,
        name: String(body.name || "").trim(),
        phone: String(body.phone || "").trim() || null,
        email: String(body.email || "").trim() || null,
        region: String(body.region || "").trim() || null,
        address: String(body.address || "").trim() || null,
        status: String(body.status || "ACTIVE"),
      };
    }

    if (resource === "services") {
      data = {
        companyId: user.companyId,
        staffId: String(body.staffId || ""),
        brokerId: String(body.brokerId || "") || null,
        customerId: String(body.customerId || "") || null,
        serviceType: String(body.serviceType || "Service"),
        amount: String(body.amount || "0"),
        status: String(body.status || "COMPLETED"),
        servedAt: body.servedAt ? new Date(body.servedAt) : new Date(),
        notes: String(body.notes || "").trim() || null,
      };
    }

    if (resource === "gps") {
      data = {
        companyId: user.companyId,
        userId: String(body.userId || "") || null,
        assetType: String(body.assetType || "Employee"),
        assetName: String(body.assetName || "").trim(),
        liveLocation: String(body.liveLocation || "").trim() || null,
        speed: body.speed ? String(body.speed) : null,
        stops: Number(body.stops || 0),
        routeHistory: String(body.routeHistory || "").trim() || null,
        distanceTraveled: body.distanceTraveled
          ? String(body.distanceTraveled)
          : null,
        batteryStatus: String(body.batteryStatus || "").trim() || null,
        gpsSignal: String(body.gpsSignal || "").trim() || null,
        geofenceViolations: Number(body.geofenceViolations || 0),
        alert: String(body.alert || "").trim() || null,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
      };
    }

    const saved = await model.create({ data });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: `${resource.toUpperCase()}_CREATED`,
        module: "COMPANY_ADMIN",
        details: `${user.name} created ${resource} record.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Record created successfully.",
      data: saved,
    });
  } catch (error) {
    console.error("COMPANY_ADMIN_RESOURCE_CREATE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create record.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}