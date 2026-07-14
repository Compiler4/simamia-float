import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanText(value: unknown): string {
  return value === null ||
    value === undefined
    ? ""
    : String(value).trim();
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

function serializeCustomer(item: any) {
  return {
    id: String(item.id),
    companyId: String(item.companyId),
    name: String(item.name),
    phone:
      item.phone == null
        ? null
        : String(item.phone),
    email:
      item.email == null
        ? null
        : String(item.email),
    region:
      item.region == null
        ? null
        : String(item.region),
    address:
      item.address == null
        ? null
        : String(item.address),
    status: String(item.status),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const session =
      await requireStaff();

    const url = new URL(request.url);
    const search = cleanText(
      url.searchParams.get("search"),
    );

    const brokerWhere: any = {
      companyId: session.companyId,
      status: "ACTIVE",
    };

    const customerWhere: any = {
      companyId: session.companyId,
      status: "ACTIVE",
    };

    if (search) {
      brokerWhere.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        {
          businessName: {
            contains: search,
          },
        },
        { phone: { contains: search } },
        { email: { contains: search } },
        {
          location: {
            contains: search,
          },
        },
        { region: { contains: search } },
        {
          district: {
            contains: search,
          },
        },
        { ward: { contains: search } },
        { address: { contains: search } },
      ];

      customerWhere.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { region: { contains: search } },
        { address: { contains: search } },
      ];
    }

    const [
      brokers,
      customers,
    ] = await Promise.all([
      prisma.brokerCustomer.findMany({
        where: brokerWhere,
        orderBy: [
          { location: "asc" },
          { name: "asc" },
        ],
      }),
      prisma.customer.findMany({
        where: customerWhere,
        orderBy: [
          { region: "asc" },
          { name: "asc" },
        ],
      }),
    ]);

    const brokerLocations =
      Array.from(
        new Set(
          brokers
            .map((item) =>
              cleanText(item.location),
            )
            .filter(Boolean),
        ),
      ).sort((a, b) =>
        a.localeCompare(b),
      );

    const customerRegions =
      Array.from(
        new Set(
          customers
            .map((item) =>
              cleanText(item.region),
            )
            .filter(Boolean),
        ),
      ).sort((a, b) =>
        a.localeCompare(b),
      );

    return NextResponse.json({
      success: true,
      brokers:
        brokers.map(serializeBroker),
      customers:
        customers.map(
          serializeCustomer,
        ),
      brokerLocations,
      customerRegions,
      totals: {
        brokers: brokers.length,
        customers: customers.length,
      },
    });
  } catch (error) {
    console.error(
      "STAFF_DIRECTORY_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Could not load the registered broker and customer directory.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}
