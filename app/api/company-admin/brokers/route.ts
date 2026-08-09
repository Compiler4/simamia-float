import crypto from "node:crypto";

import {
  type NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  HttpError,
  requireCompanyAdmin,
  routeError,
  text,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<string>([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

type BrokerLocationRow = {
  location: string | null;
};

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function optionalText(
  value: unknown,
): string | null {
  const cleaned = cleanText(value);

  return cleaned || null;
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

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function normaliseStatus(
  value: unknown,
): string {
  const status =
    cleanText(value).toUpperCase() ||
    "ACTIVE";

  return ALLOWED_STATUSES.has(status)
    ? status
    : "ACTIVE";
}

function normaliseCode(
  value: unknown,
): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createBrokerCode(): string {
  const timestamp = Date.now()
    .toString()
    .slice(-8);

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 5)
    .toUpperCase();

  return `BRK-${timestamp}-${randomPart}`;
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function serialiseBroker(item: any) {
  return {
    id: text(item.id),
    companyId: text(item.companyId),
    code: text(item.code),
    name: text(item.name),

    businessName:
      item.businessName === null ||
      item.businessName === undefined
        ? null
        : text(item.businessName),

    phone: text(item.phone),

    alternatePhone:
      item.alternatePhone === null ||
      item.alternatePhone === undefined
        ? null
        : text(item.alternatePhone),

    email:
      item.email === null ||
      item.email === undefined
        ? null
        : text(item.email),

    location: text(item.location),

    region:
      item.region === null ||
      item.region === undefined
        ? null
        : text(item.region),

    district:
      item.district === null ||
      item.district === undefined
        ? null
        : text(item.district),

    ward:
      item.ward === null ||
      item.ward === undefined
        ? null
        : text(item.ward),

    address:
      item.address === null ||
      item.address === undefined
        ? null
        : text(item.address),

    latitude:
      item.latitude === null ||
      item.latitude === undefined
        ? null
        : Number(item.latitude),

    longitude:
      item.longitude === null ||
      item.longitude === undefined
        ? null
        : Number(item.longitude),

    status:
      text(item.status) || "ACTIVE",

    notes:
      item.notes === null ||
      item.notes === undefined
        ? null
        : text(item.notes),

    isImported: Boolean(item.isImported),

    sourceAgentName:
      item.sourceAgentName === null ||
      item.sourceAgentName === undefined
        ? null
        : text(item.sourceAgentName),

    sourceMsisdn:
      item.sourceMsisdn === null ||
      item.sourceMsisdn === undefined
        ? null
        : text(item.sourceMsisdn),

    sourceAliasCode:
      item.sourceAliasCode === null ||
      item.sourceAliasCode === undefined
        ? null
        : text(item.sourceAliasCode),

    sourceRowNumber:
      item.sourceRowNumber === null ||
      item.sourceRowNumber === undefined
        ? null
        : Number(item.sourceRowNumber),

    sourceSheetName:
      item.sourceSheetName === null ||
      item.sourceSheetName === undefined
        ? null
        : text(item.sourceSheetName),

    importedAt:
      item.importedAt ?? null,

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

type SerialisedBroker =
  ReturnType<typeof serialiseBroker>;

/**
 * GET /api/company-admin/brokers
 *
 * Loads broker customers belonging to the logged-in
 * Company Admin's company.
 */
export async function GET(
  request: NextRequest,
): Promise<Response> {
  try {
    const sessionUser =
      await requireCompanyAdmin();

    const companyId =
      sessionUser.companyId as string;

    const db = prisma as any;

    const url = new URL(request.url);

    const search = cleanText(
      url.searchParams.get("search"),
    );

    const location = cleanText(
      url.searchParams.get("location"),
    );

    const requestedStatus = cleanText(
      url.searchParams.get("status"),
    ).toUpperCase();

    const where: Record<
      string,
      unknown
    > = {
      companyId,
    };

    if (location) {
      where.location = location;
    }

    if (
      requestedStatus &&
      ALLOWED_STATUSES.has(requestedStatus)
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
        {
          sourceAgentName: {
            contains: search,
          },
        },
        {
          sourceMsisdn: {
            contains: search,
          },
        },
        {
          sourceAliasCode: {
            contains: search,
          },
        },
      ];
    }

    const [
      brokerRows,
      rawLocationRows,
    ] = await Promise.all([
      db.brokerCustomer.findMany({
        where,
        orderBy: [
          {
            location: "asc",
          },
          {
            name: "asc",
          },
        ],
        take: 10_000,
      }),

      db.brokerCustomer.findMany({
        where: {
          companyId,
        },
        select: {
          location: true,
        },
        orderBy: {
          location: "asc",
        },
        take: 10_000,
      }),
    ]);

    const brokers: SerialisedBroker[] =
      (brokerRows as any[]).map(
        (item: any) =>
          serialiseBroker(item),
      );

    /*
     * Explicit string typing fixes:
     * "'first' is of type 'unknown'"
     */
    const locationSet =
      new Set<string>();

    const locationRows =
      rawLocationRows as BrokerLocationRow[];

    for (const row of locationRows) {
      const locationName =
        cleanText(row.location);

      if (locationName) {
        locationSet.add(locationName);
      }
    }

    const locations: string[] =
      Array.from(locationSet).sort(
        (
          first: string,
          second: string,
        ) =>
          first.localeCompare(second),
      );

    const active = brokers.filter(
      (broker: SerialisedBroker) =>
        broker.status === "ACTIVE",
    ).length;

    const inactive = brokers.filter(
      (broker: SerialisedBroker) =>
        broker.status === "INACTIVE",
    ).length;

    const suspended = brokers.filter(
      (broker: SerialisedBroker) =>
        broker.status === "SUSPENDED",
    ).length;

    const imported = brokers.filter(
      (broker: SerialisedBroker) =>
        broker.isImported,
    ).length;

    return NextResponse.json(
      {
        success: true,
        brokers,
        locations,
        total: brokers.length,
        summary: {
          active,
          inactive,
          suspended,
          imported,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "COMPANY_ADMIN_BROKERS_GET_ERROR:",
      error,
    );

    return routeError(error);
  }
}

/**
 * POST /api/company-admin/brokers
 *
 * Creates a broker customer belonging to the logged-in
 * Company Admin's company.
 */
export async function POST(
  request: NextRequest,
): Promise<Response> {
  try {
    const sessionUser =
      await requireCompanyAdmin();

    const companyId =
      sessionUser.companyId as string;

    const db = prisma as any;

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
      throw new HttpError(
        "The request body must contain valid JSON.",
        400,
      );
    }

    const name =
      cleanText(body.name);

    const phone =
      cleanText(body.phone);

    const alternatePhone =
      optionalText(
        body.alternatePhone,
      );

    const location =
      cleanText(body.location);

    const email =
      optionalText(
        body.email,
      )?.toLowerCase() ?? null;

    const latitude =
      optionalNumber(
        body.latitude,
      );

    const longitude =
      optionalNumber(
        body.longitude,
      );

    if (!name) {
      throw new HttpError(
        "Broker full name is required.",
        422,
      );
    }

    if (!phone) {
      throw new HttpError(
        "Broker phone number is required.",
        422,
      );
    }

    if (!location) {
      throw new HttpError(
        "Broker location is required.",
        422,
      );
    }

    if (
      email &&
      !isValidEmail(email)
    ) {
      throw new HttpError(
        "Enter a valid broker email address.",
        422,
      );
    }

    if (
      alternatePhone &&
      alternatePhone === phone
    ) {
      throw new HttpError(
        "Alternative phone must be different from the primary phone.",
        422,
      );
    }

    if (
      latitude !== null &&
      (
        latitude < -90 ||
        latitude > 90
      )
    ) {
      throw new HttpError(
        "Latitude must be between -90 and 90.",
        422,
      );
    }

    if (
      longitude !== null &&
      (
        longitude < -180 ||
        longitude > 180
      )
    ) {
      throw new HttpError(
        "Longitude must be between -180 and 180.",
        422,
      );
    }

    const phoneNumbers = [
      phone,
      alternatePhone,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    );

    const duplicatePhone =
      await db.brokerCustomer.findFirst({
        where: {
          companyId,
          OR: [
            {
              phone: {
                in: phoneNumbers,
              },
            },
            {
              alternatePhone: {
                in: phoneNumbers,
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          alternatePhone: true,
        },
      });

    if (duplicatePhone) {
      throw new HttpError(
        `One of the supplied phone numbers is already registered for ${cleanText(
          duplicatePhone.name,
        )}.`,
        409,
      );
    }

    if (email) {
      const duplicateEmail =
        await db.brokerCustomer.findFirst({
          where: {
            companyId,
            email,
          },
          select: {
            id: true,
            name: true,
          },
        });

      if (duplicateEmail) {
        throw new HttpError(
          `Email ${email} is already registered for ${cleanText(
            duplicateEmail.name,
          )}.`,
          409,
        );
      }
    }

    const suppliedCode =
      normaliseCode(body.code);

    let code =
      suppliedCode ||
      createBrokerCode();

    let duplicateCode =
      await db.brokerCustomer.findFirst({
        where: {
          companyId,
          code,
        },
        select: {
          id: true,
        },
      });

    if (
      suppliedCode &&
      duplicateCode
    ) {
      throw new HttpError(
        `Broker code ${code} is already registered.`,
        409,
      );
    }

    while (duplicateCode) {
      code = createBrokerCode();

      duplicateCode =
        await db.brokerCustomer.findFirst({
          where: {
            companyId,
            code,
          },
          select: {
            id: true,
          },
        });
    }

    const broker =
      await db.brokerCustomer.create({
        data: {
          companyId,
          code,
          name,

          businessName:
            optionalText(
              body.businessName,
            ),

          phone,
          alternatePhone,
          email,
          location,

          region:
            optionalText(
              body.region,
            ),

          district:
            optionalText(
              body.district,
            ),

          ward:
            optionalText(
              body.ward,
            ),

          address:
            optionalText(
              body.address,
            ),

          latitude,
          longitude,

          status:
            normaliseStatus(
              body.status,
            ),

          notes:
            optionalText(
              body.notes,
            ),

          isImported: false,
        },
      });

    await createAudit({
      companyId,
      actorId:
        sessionUser.id,
      actorName:
        sessionUser.name,
      actorRole:
        sessionUser.role,
      action:
        "CREATE_BROKER_CUSTOMER",
      module:
        "BROKERS",
      details:
        `Registered broker ${name} with code ${code}.`,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Broker customer registered successfully.",
        broker:
          serialiseBroker(broker),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "COMPANY_ADMIN_BROKERS_POST_ERROR:",
      error,
    );

    return routeError(error);
  }
}