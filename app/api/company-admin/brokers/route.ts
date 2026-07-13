import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_STATUSES = new Set(["ACTIVE", "INACTIVE", "SUSPENDED"]);

type BrokerDelegate = {
  findFirst: (args: Record<string, unknown>) => Promise<any | null>;
  update: (args: Record<string, unknown>) => Promise<any>;
  delete: (args: Record<string, unknown>) => Promise<any>;
};

function getBrokerDelegate(): BrokerDelegate | null {
  const client = prisma as unknown as {
    brokerCustomer?: BrokerDelegate;
  };

  return client.brokerCustomer ?? null;
}

function missingDelegateResponse() {
  return NextResponse.json(
    {
      success: false,
      message:
        "BrokerCustomer is not available in the generated Prisma Client.",
      error:
        "Run the BrokerCustomer migration, run npx prisma generate, delete .next and restart npm run dev.",
    },
    { status: 503 },
  );
}

function cleanText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function optionalText(value: unknown): string | null {
  const result = cleanText(value);
  return result || null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStatus(value: unknown) {
  const status = cleanText(value).toUpperCase() || "ACTIVE";
  return ALLOWED_STATUSES.has(status) ? status : "ACTIVE";
}

function normalizeCode(value: unknown): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function serializeBroker(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    code: item.code,
    name: item.name,
    businessName: item.businessName,
    phone: item.phone,
    alternatePhone: item.alternatePhone,
    email: item.email,
    location: item.location,
    region: item.region,
    district: item.district,
    ward: item.ward,
    address: item.address,
    latitude:
      item.latitude === null || item.latitude === undefined
        ? null
        : Number(item.latitude),
    longitude:
      item.longitude === null || item.longitude === undefined
        ? null
        : Number(item.longitude),
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function requireCompanyAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "You are not logged in.",
        },
        { status: 401 },
      ),
      user: null,
    };
  }

  if (String(user.role) !== "COMPANY_ADMIN") {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Only Company Admin can manage broker customers.",
        },
        { status: 403 },
      ),
      user: null,
    };
  }

  if (!user.companyId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Your account is not assigned to a company.",
        },
        { status: 400 },
      ),
      user: null,
    };
  }

  return {
    error: null,
    user,
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCompanyAdmin();
    if (access.error || !access.user) return access.error;

    const brokerModel = getBrokerDelegate();
    if (!brokerModel) return missingDelegateResponse();

    const { id } = await context.params;
    const body = await request.json();

    const existing = await brokerModel.findFirst({
      where: {
        id,
        companyId: access.user.companyId!,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Broker customer was not found in your company.",
        },
        { status: 404 },
      );
    }

    const name = body.name === undefined ? existing.name : cleanText(body.name);
    const phone =
      body.phone === undefined ? existing.phone : cleanText(body.phone);
    const location =
      body.location === undefined
        ? existing.location
        : cleanText(body.location);

    if (!name || !phone || !location) {
      return NextResponse.json(
        {
          success: false,
          message: "Broker name, phone and location cannot be empty.",
        },
        { status: 400 },
      );
    }

    const latitude =
      body.latitude === undefined
        ? existing.latitude
        : optionalNumber(body.latitude);
    const longitude =
      body.longitude === undefined
        ? existing.longitude
        : optionalNumber(body.longitude);

    if (
      latitude !== null &&
      latitude !== undefined &&
      (Number(latitude) < -90 || Number(latitude) > 90)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Latitude must be between -90 and 90.",
        },
        { status: 400 },
      );
    }

    if (
      longitude !== null &&
      longitude !== undefined &&
      (Number(longitude) < -180 || Number(longitude) > 180)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Longitude must be between -180 and 180.",
        },
        { status: 400 },
      );
    }

    const requestedCode =
      body.code === undefined
        ? existing.code
        : normalizeCode(body.code) || existing.code;

    const duplicateCode = await brokerModel.findFirst({
      where: {
        companyId: access.user.companyId!,
        code: requestedCode,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateCode) {
      return NextResponse.json(
        {
          success: false,
          message: `Broker code ${requestedCode} is already in use.`,
        },
        { status: 409 },
      );
    }

    const duplicatePhone = await brokerModel.findFirst({
      where: {
        companyId: access.user.companyId!,
        phone,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (duplicatePhone) {
      return NextResponse.json(
        {
          success: false,
          message: `Phone ${phone} is already registered for ${duplicatePhone.name}.`,
        },
        { status: 409 },
      );
    }

    const broker = await brokerModel.update({
      where: {
        id,
      },
      data: {
        code: requestedCode,
        name,
        businessName:
          body.businessName === undefined
            ? existing.businessName
            : optionalText(body.businessName),
        phone,
        alternatePhone:
          body.alternatePhone === undefined
            ? existing.alternatePhone
            : optionalText(body.alternatePhone),
        email:
          body.email === undefined
            ? existing.email
            : (optionalText(body.email)?.toLowerCase() ?? null),
        location,
        region:
          body.region === undefined
            ? existing.region
            : optionalText(body.region),
        district:
          body.district === undefined
            ? existing.district
            : optionalText(body.district),
        ward: body.ward === undefined ? existing.ward : optionalText(body.ward),
        address:
          body.address === undefined
            ? existing.address
            : optionalText(body.address),
        latitude: latitude === undefined ? existing.latitude : latitude,
        longitude: longitude === undefined ? existing.longitude : longitude,
        status:
          body.status === undefined
            ? existing.status
            : (normalizeStatus(body.status) as any),
        notes:
          body.notes === undefined ? existing.notes : optionalText(body.notes),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Broker customer updated successfully.",
      broker: serializeBroker(broker),
    });
  } catch (error) {
    console.error("COMPANY_ADMIN_BROKER_PATCH_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not update broker customer.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireCompanyAdmin();
    if (access.error || !access.user) return access.error;

    const brokerModel = getBrokerDelegate();
    if (!brokerModel) return missingDelegateResponse();

    const { id } = await context.params;

    const existing = await brokerModel.findFirst({
      where: {
        id,
        companyId: access.user.companyId!,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Broker customer was not found in your company.",
        },
        { status: 404 },
      );
    }

    await brokerModel.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${existing.name} was removed successfully.`,
    });
  } catch (error) {
    console.error("COMPANY_ADMIN_BROKER_DELETE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Could not remove broker customer. If the broker is already used by service records, deactivate it instead.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
