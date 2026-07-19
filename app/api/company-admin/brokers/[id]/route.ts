import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function cleanText(value: unknown): string {
  return value === null ||
    value === undefined
    ? ""
    : String(value).trim();
}

function optionalText(
  value: unknown,
): string | null {
  const text = cleanText(value);
  return text || null;
}

function optionalNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function normalizeStatus(
  value: unknown,
) {
  const status =
    cleanText(value).toUpperCase() ||
    "ACTIVE";

  return ALLOWED_STATUSES.has(status)
    ? status
    : "ACTIVE";
}

function normalizeCode(
  value: unknown,
): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function validEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function serializeBroker(item: any) {
  return {
    id: String(item.id),
    companyId: String(item.companyId),
    code: String(item.code),
    name: String(item.name),
    businessName:
      item.businessName == null
        ? null
        : String(item.businessName),
    phone: String(item.phone),
    alternatePhone:
      item.alternatePhone == null
        ? null
        : String(item.alternatePhone),
    email:
      item.email == null
        ? null
        : String(item.email),
    location: String(item.location),
    region:
      item.region == null
        ? null
        : String(item.region),
    district:
      item.district == null
        ? null
        : String(item.district),
    ward:
      item.ward == null
        ? null
        : String(item.ward),
    address:
      item.address == null
        ? null
        : String(item.address),
    latitude:
      item.latitude == null
        ? null
        : Number(item.latitude),
    longitude:
      item.longitude == null
        ? null
        : Number(item.longitude),
    status: String(item.status),
    notes:
      item.notes == null
        ? null
        : String(item.notes),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function requireCompanyAdmin() {
  const session =
    (await getCurrentUser()) as any;

  if (!session) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          message:
            "Authentication is required.",
        },
        { status: 401 },
      ),
    };
  }

  if (
    String(session.role) !==
    "COMPANY_ADMIN"
  ) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          message:
            "Only Company Admin can manage broker customers.",
        },
        { status: 403 },
      ),
    };
  }

  if (!session.companyId) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          message:
            "Your account is not assigned to a company.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    error: null,
    user: {
      ...session,
      id: String(session.id),
      companyId: String(
        session.companyId,
      ),
    },
  };
}

function routeError(
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(
          (error as {
            code?: unknown;
          }).code ?? "",
        )
      : "";

  if (code === "P2021") {
    return NextResponse.json(
      {
        success: false,
        message:
          "The broker_customers table does not exist.",
        error:
          "Synchronize the Prisma schema with MySQL and regenerate Prisma Client.",
      },
      { status: 503 },
    );
  }

  if (
    message.includes(
      "Cannot read properties of undefined",
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The running Prisma Client does not contain BrokerCustomer.",
        error:
          "Replace lib/prisma.ts, regenerate generated/prisma, clear .next and restart all Node processes.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message:
        "The broker operation could not be completed.",
      error: message,
    },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const access =
      await requireCompanyAdmin();

    if (
      access.error ||
      !access.user
    ) {
      return access.error || NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } =
      await context.params;

    if (!cleanText(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A broker ID is required.",
        },
        { status: 400 },
      );
    }

    const existing =
      await prisma.brokerCustomer.findFirst(
        {
          where: {
            id,
            companyId:
              access.user.companyId,
          },
        },
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Broker customer was not found in your company.",
        },
        { status: 404 },
      );
    }

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "The request body must contain valid JSON.",
        },
        { status: 400 },
      );
    }

    const name =
      body.name === undefined
        ? existing.name
        : cleanText(body.name);

    const phone =
      body.phone === undefined
        ? existing.phone
        : cleanText(body.phone);

    const location =
      body.location === undefined
        ? existing.location
        : cleanText(body.location);

    if (
      !name ||
      !phone ||
      !location
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Broker name, phone and location cannot be empty.",
        },
        { status: 400 },
      );
    }

    const email =
      body.email === undefined
        ? existing.email
        : optionalText(
            body.email,
          )?.toLowerCase() ?? null;

    if (
      email &&
      !validEmail(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Enter a valid broker email address.",
        },
        { status: 400 },
      );
    }

    const latitude =
      body.latitude === undefined
        ? existing.latitude
        : optionalNumber(
            body.latitude,
          );

    const longitude =
      body.longitude === undefined
        ? existing.longitude
        : optionalNumber(
            body.longitude,
          );

    if (
      latitude !== null &&
      (
        Number(latitude) < -90 ||
        Number(latitude) > 90
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Latitude must be between -90 and 90.",
        },
        { status: 400 },
      );
    }

    if (
      longitude !== null &&
      (
        Number(longitude) < -180 ||
        Number(longitude) > 180
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Longitude must be between -180 and 180.",
        },
        { status: 400 },
      );
    }

    const code =
      body.code === undefined
        ? existing.code
        : normalizeCode(body.code) ||
          existing.code;

    const duplicateCode =
      await prisma.brokerCustomer.findFirst(
        {
          where: {
            companyId:
              access.user.companyId,
            code,
            NOT: {
              id,
            },
          },
          select: {
            id: true,
          },
        },
      );

    if (duplicateCode) {
      return NextResponse.json(
        {
          success: false,
          message: `Broker code ${code} is already in use.`,
        },
        { status: 409 },
      );
    }

    const duplicatePhone =
      await prisma.brokerCustomer.findFirst(
        {
          where: {
            companyId:
              access.user.companyId,
            phone,
            NOT: {
              id,
            },
          },
          select: {
            id: true,
            name: true,
          },
        },
      );

    if (duplicatePhone) {
      return NextResponse.json(
        {
          success: false,
          message: `Phone ${phone} is already registered for ${duplicatePhone.name}.`,
        },
        { status: 409 },
      );
    }

    const duplicateEmail =
      email
        ? await prisma.brokerCustomer.findFirst(
            {
              where: {
                companyId:
                  access.user.companyId,
                email,
                NOT: {
                  id,
                },
              },
              select: {
                id: true,
                name: true,
              },
            },
          )
        : null;

    if (duplicateEmail) {
      return NextResponse.json(
        {
          success: false,
          message: `Email ${email} is already registered for ${duplicateEmail.name}.`,
        },
        { status: 409 },
      );
    }

    const broker =
      await prisma.brokerCustomer.update({
        where: {
          id,
        },
        data: {
          code,
          name,

          businessName:
            body.businessName === undefined
              ? existing.businessName
              : optionalText(
                  body.businessName,
                ),

          phone,

          alternatePhone:
            body.alternatePhone ===
            undefined
              ? existing.alternatePhone
              : optionalText(
                  body.alternatePhone,
                ),

          email,
          location,

          region:
            body.region === undefined
              ? existing.region
              : optionalText(
                  body.region,
                ),

          district:
            body.district === undefined
              ? existing.district
              : optionalText(
                  body.district,
                ),

          ward:
            body.ward === undefined
              ? existing.ward
              : optionalText(
                  body.ward,
                ),

          address:
            body.address === undefined
              ? existing.address
              : optionalText(
                  body.address,
                ),

          latitude,
          longitude,

          status:
            body.status === undefined
              ? existing.status
              : normalizeStatus(
                  body.status,
                ) as any,

          notes:
            body.notes === undefined
              ? existing.notes
              : optionalText(
                  body.notes,
                ),
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Broker customer updated successfully.",
      broker:
        serializeBroker(broker),
    });
  } catch (error) {
    console.warn(
      "COMPANY_ADMIN_BROKER_PATCH",
      error,
    );

    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const access =
      await requireCompanyAdmin();

    if (
      access.error ||
      !access.user
    ) {
      return access.error || NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } =
      await context.params;

    const existing =
      await prisma.brokerCustomer.findFirst(
        {
          where: {
            id,
            companyId:
              access.user.companyId,
          },
          select: {
            id: true,
            name: true,
          },
        },
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Broker customer was not found in your company.",
        },
        { status: 404 },
      );
    }

    await prisma.brokerCustomer.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        `${existing.name} was removed successfully.`,
    });
  } catch (error) {
    console.warn(
      "COMPANY_ADMIN_BROKER_DELETE",
      error,
    );

    return routeError(error);
  }
}