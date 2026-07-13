import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type BrokerDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<any[]>;
};

function cleanText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function getBrokerDelegate(): BrokerDelegate | null {
  const client = prisma as unknown as {
    brokerCustomer?: BrokerDelegate;
  };

  return client.brokerCustomer ?? null;
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

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "You are not logged in." },
        { status: 401 },
      );
    }

    if (!user.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is not assigned to a company.",
        },
        { status: 400 },
      );
    }

    const brokerModel = getBrokerDelegate();

    if (!brokerModel) {
      return NextResponse.json(
        {
          success: false,
          message: "The broker directory is not ready.",
          error:
            "Run the BrokerCustomer Prisma migration, run npx prisma generate, clear .next and restart the server.",
        },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    const search = cleanText(url.searchParams.get("search"));
    const location = cleanText(url.searchParams.get("location"));

    const brokers = await brokerModel.findMany({
      where: {
        companyId: user.companyId,
        status: "ACTIVE",
        ...(location ? { location: { equals: location } } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { name: { contains: search } },
                { businessName: { contains: search } },
                { phone: { contains: search } },
                { location: { contains: search } },
                { region: { contains: search } },
                { district: { contains: search } },
                { ward: { contains: search } },
                { address: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ location: "asc" }, { name: "asc" }],
    });

    const locations = Array.from(
      new Set(
        brokers.map((broker) => cleanText(broker.location)).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      success: true,
      brokers: brokers.map(serializeBroker),
      locations,
      total: brokers.length,
    });
  } catch (error) {
    console.error("STAFF_BROKER_DIRECTORY_ERROR:", error);

    const code = cleanText((error as { code?: unknown })?.code);
    const detail =
      code === "P2021"
        ? "The broker_customers table is missing. Run the Prisma migration and regenerate the client."
        : error instanceof Error
          ? error.message
          : String(error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load the company broker directory.",
        error: detail,
      },
      { status: 500 },
    );
  }
}
