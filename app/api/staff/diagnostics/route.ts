import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireStaff,
} from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session =
      await requireStaff();

    const requiredDelegates = [
      "user",
      "brokerCustomer",
      "customer",
      "floatTransaction",
      "staffCollection",
      "bankDeposit",
      "expense",
      "attendance",
      "notification",
      "serviceActivity",
      "companyGpsDevice",
      "gpsAlert",
      "staffFile",
    ] as const;

    const missingDelegates =
      requiredDelegates.filter(
        (name) => {
          const delegate =
            (prisma as any)[name];

          return (
            !delegate ||
            typeof delegate.findMany !==
              "function"
          );
        },
      );

    const actionRoute = {
      path:
        "/api/staff/actions",
      expectedMethods: [
        "GET",
        "POST",
      ],
    };

    const [
      brokerCount,
      customerCount,
      ownFloatCount,
      ownCollectionCount,
    ] = await Promise.all([
      prisma.brokerCustomer.count({
        where: {
          companyId:
            session.companyId,
        },
      }),
      prisma.customer.count({
        where: {
          companyId:
            session.companyId,
        },
      }),
      prisma.floatTransaction.count({
        where: {
          companyId:
            session.companyId,
          OR: [
            {
              fromUserId:
                session.id,
            },
            {
              toUserId:
                session.id,
            },
          ],
        },
      }),
      prisma.staffCollection.count({
        where: {
          companyId:
            session.companyId,
          staffId:
            session.id,
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        healthy:
          missingDelegates.length ===
          0,
        staffId:
          session.id,
        companyId:
          session.companyId,
        missingDelegates,
        actionRoute,
        counts: {
          brokers:
            brokerCount,
          customers:
            customerCount,
          ownFloats:
            ownFloatCount,
          ownCollections:
            ownCollectionCount,
        },
      },
      {
        status:
          missingDelegates.length ===
          0
            ? 200
            : 503,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        message:
          "Staff diagnostics failed.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}
