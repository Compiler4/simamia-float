import { NextResponse } from "next/server";

import {
  visibleBrokerCustomers,
} from "@/lib/staff/broker-scope";
import {
  requireStaffSession,
} from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function apiError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "UNKNOWN_ERROR";

  if (message === "UNAUTHENTICATED") {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication is required.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    message === "FORBIDDEN" ||
    message === "STAFF_COMPANY_REQUIRED"
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Staff access is required.",
      },
      {
        status: 403,
      },
    );
  }

  const prismaCode = (error as { code?: string })?.code;

  console.error("[STAFF_BROKERS]", error);

  return NextResponse.json(
    {
      success: false,
      message:
        prismaCode === "P2021" ||
        prismaCode === "P2022"
          ? "The broker-location database is not synchronized. Run npx prisma db push and npx prisma generate."
          : "The staff broker directory could not load.",
      code: prismaCode,
      details:
        process.env.NODE_ENV === "development"
          ? message
          : undefined,
    },
    {
      status: 500,
    },
  );
}

export async function GET() {
  try {
    const session = await requireStaffSession();
    const scope = await visibleBrokerCustomers(
      session.companyId,
      session.id,
    );

    const locations = Array.from(
      new Set<string>(
        scope.brokers
          .flatMap((broker) => [
            broker.region,
            broker.district,
            broker.ward,
            broker.location,
          ])
          .map((value) =>
            value == null
              ? ""
              : String(value).trim(),
          )
          .filter(Boolean),
      ),
    ).sort((left, right) =>
      left.localeCompare(right),
    );

    return NextResponse.json({
      success: true,
      areas: scope.areas,
      brokers: scope.brokers,
      locations,
      total: scope.brokers.length,
      assignedTotal: scope.brokers.filter(
        (broker) => broker.directlyAssigned,
      ).length,
      mappedTotal: scope.brokers.filter(
        (broker) =>
          Number.isFinite(
            Number(broker.latitude),
          ) &&
          Number.isFinite(
            Number(broker.longitude),
          ),
      ).length,
    });
  } catch (error) {
    return apiError(error);
  }
}
