import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count =
      await prisma.brokerCustomer.count();

    return NextResponse.json({
      success: true,
      message:
        "BrokerCustomer Prisma delegate and database table are available.",
      brokerCount: count,
      generatedClient:
        "../generated/prisma/client",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        message:
          "BrokerCustomer health check failed.",
        error: message,
        checks: [
          "prisma/schema.prisma contains model BrokerCustomer",
          "Company contains brokerCustomers BrokerCustomer[]",
          "lib/prisma.ts imports ../generated/prisma/client",
          "generated/prisma was regenerated",
          "broker_customers exists in MySQL",
        ],
      },
      { status: 503 },
    );
  }
}
