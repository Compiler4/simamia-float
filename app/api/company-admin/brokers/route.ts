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

function generatedCode(): string {
  const timestamp = Date.now()
    .toString()
    .slice(-8);

  const random = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `BRK-${timestamp}-${random}`;
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

function prismaErrorDetails(
  error: unknown,
) {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const value = error as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
    };

    return {
      code:
        typeof value.code === "string"
          ? value.code
          : "",
      name:
        typeof value.name === "string"
          ? value.name
          : "Error",
      message:
        typeof value.message === "string"
          ? value.message
          : String(error),
    };
  }

  return {
    code: "",
    name: "Error",
    message: String(error),
  };
}

function brokerRouteError(
  error: unknown,
) {
  const details =
    prismaErrorDetails(error);

  if (details.code === "P2021") {
    return NextResponse.json(
      {
        success: false,
        message:
          "The broker_customers database table does not exist.",
        error:
          "Run npx prisma migrate dev --name add_broker_customers or npx prisma db push, then run npx prisma generate.",
      },
      { status: 503 },
    );
  }

  if (details.code === "P2022") {
    return NextResponse.json(
      {
        success: false,
        message:
          "The broker_customers table is missing a required column.",
        error:
          "Synchronize prisma/schema.prisma with MySQL and regenerate Prisma Client.",
      },
      { status: 503 },
    );
  }

  if (details.code === "P2002") {
    return NextResponse.json(
      {
        success: false,
        message:
          "A broker with the same unique value already exists.",
        error: details.message,
      },
      { status: 409 },
    );
  }

  if (
    details.code === "P1001" ||
    details.code === "P1002"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The MariaDB/MySQL server could not be reached.",
        error: details.message,
      },
      { status: 503 },
    );
  }

  if (
    details.message.includes(
      "Cannot read properties of undefined",
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The running Prisma Client does not contain BrokerCustomer.",
        error:
          "Replace lib/prisma.ts with the generated/prisma version, stop all Node processes, remove generated/prisma, run npx prisma generate, clear .next, and restart.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message:
        "The broker request could not be completed.",
      error: details.message,
    },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
) {
  try {
    const access =
      await requireCompanyAdmin();

    // ✅ FIXED: Explicit error handling
    if (access.error) {
      return access.error;
    }

    if (!access.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication failed.",
        },
        { status: 401 },
      );
    }

    const url = new URL(request.url);

    const search = cleanText(
      url.searchParams.get("search"),
    );

    const location = cleanText(
      url.searchParams.get("location"),
    );

    const requestedStatus =
      cleanText(
        url.searchParams.get("status"),
      ).toUpperCase();

    const where: any = {
      companyId: access.user.companyId,
    };

    if (location) {
      where.location = location;
    }

    if (
      requestedStatus &&
      ALLOWED_STATUSES.has(
        requestedStatus,
      )
    ) {
      where.status = requestedStatus;
    }

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
          },
        },
        {
          name: {
            contains: search,
          },
        },
        {
          businessName: {
            contains: search,
          },
        },
        {
          phone: {
            contains: search,
          },
        },
        {
          alternatePhone: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
          },
        },
        {
          location: {
            contains: search,
          },
        },
        {
          region: {
            contains: search,
          },
        },
        {
          district: {
            contains: search,
          },
        },
        {
          ward: {
            contains: search,
          },
        },
        {
          address: {
            contains: search,
          },
        },
      ];
    }

    const [
      brokers,
      locationRows,
    ] = await Promise.all([
      prisma.brokerCustomer.findMany({
        where,
        orderBy: [
          { location: "asc" },
          { name: "asc" },
        ],
      }),

      prisma.brokerCustomer.findMany({
        where: {
          companyId:
            access.user.companyId,
        },
        select: {
          location: true,
        },
        orderBy: {
          location: "asc",
        },
      }),
    ]);

    const locations = Array.from(
      new Set(
        locationRows
          .map((item) =>
            cleanText(item.location),
          )
          .filter(Boolean),
      ),
    );

    const result =
      brokers.map(serializeBroker);

    return NextResponse.json({
      success: true,
      brokers: result,
      locations,
      total: result.length,

      summary: {
        active: result.filter(
          (item) =>
            item.status === "ACTIVE",
        ).length,

        inactive: result.filter(
          (item) =>
            item.status === "INACTIVE",
        ).length,

        suspended: result.filter(
          (item) =>
            item.status === "SUSPENDED",
        ).length,
      },
    });
  } catch (error) {
    console.warn(
      "COMPANY_ADMIN_BROKER_GET",
      prismaErrorDetails(error),
    );

    return brokerRouteError(error);
  }
}

export async function POST(
  request: Request,
) {
  try {
    const access =
      await requireCompanyAdmin();

    // ✅ FIXED: Explicit error handling
    if (access.error) {
      return access.error;
    }

    if (!access.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication failed.",
        },
        { status: 401 },
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
      cleanText(body.name);

    const phone =
      cleanText(body.phone);

    const location =
      cleanText(body.location);

    const email =
      optionalText(
        body.email,
      )?.toLowerCase() ?? null;

    const latitude =
      optionalNumber(body.latitude);

    const longitude =
      optionalNumber(body.longitude);

    if (
      !name ||
      !phone ||
      !location
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Broker name, phone and location are required.",
        },
        { status: 400 },
      );
    }

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

    if (
      latitude !== null &&
      (
        latitude < -90 ||
        latitude > 90
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
        longitude < -180 ||
        longitude > 180
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

    const duplicatePhone =
      await prisma.brokerCustomer.findFirst({
        where: {
          companyId:
            access.user.companyId,
          phone,
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

    const duplicateEmail =
      email
        ? await prisma.brokerCustomer.findFirst(
            {
              where: {
                companyId:
                  access.user.companyId,
                email,
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

    let code =
      normalizeCode(body.code) ||
      generatedCode();

    let duplicateCode =
      await prisma.brokerCustomer.findFirst(
        {
          where: {
            companyId:
              access.user.companyId,
            code,
          },
          select: {
            id: true,
          },
        },
      );

    if (
      cleanText(body.code) &&
      duplicateCode
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Broker code ${code} is already in use.`,
        },
        { status: 409 },
      );
    }

    while (duplicateCode) {
      code = generatedCode();

      duplicateCode =
        await prisma.brokerCustomer.findFirst(
          {
            where: {
              companyId:
                access.user.companyId,
              code,
            },
            select: {
              id: true,
            },
          },
        );
    }

    const broker =
      await prisma.brokerCustomer.create({
        data: {
          companyId:
            access.user.companyId,

          code,
          name,

          businessName:
            optionalText(
              body.businessName,
            ),

          phone,

          alternatePhone:
            optionalText(
              body.alternatePhone,
            ),

          email,
          location,

          region:
            optionalText(body.region),

          district:
            optionalText(
              body.district,
            ),

          ward:
            optionalText(body.ward),

          address:
            optionalText(body.address),

          latitude,
          longitude,

          status:
            normalizeStatus(
              body.status,
            ) as any,

          notes:
            optionalText(body.notes),
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Broker customer created successfully.",
        broker:
          serializeBroker(broker),
      },
      { status: 201 },
    );
  } catch (error) {
    console.warn(
      "COMPANY_ADMIN_BROKER_POST",
      prismaErrorDetails(error),
    );

    return brokerRouteError(error);
  }
}
