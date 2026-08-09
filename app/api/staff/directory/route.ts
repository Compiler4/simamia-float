import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff/permissions";
import {
  assignedBrokerCustomers,
  cleanText,
  serialize,
  responseError,
} from "@/lib/staff/operations-v4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await requireStaff();
    const db = prisma as any;
    const url = new URL(request.url);
    const search = cleanText(url.searchParams.get("search")).toLowerCase();

    const staff = await db.user.findFirst({
      where: {
        id: session.id,
        companyId: session.companyId,
        status: "ACTIVE",
      },
      select: {
        assignedRegion: true,
      },
    });

    const brokers = await assignedBrokerCustomers(
      session.companyId,
      session.id,
    );

    const explicitCustomerAssignments =
      await db.staffCustomerAssignment.findMany({
        where: {
          companyId: session.companyId,
          staffId: session.id,
          status: "ACTIVE",
        },
        include: {
          customer: true,
        },
      });

    let customers = explicitCustomerAssignments.map(
      (row: any) => row.customer,
    );

    if (!customers.length && cleanText(staff?.assignedRegion)) {
      const area = cleanText(staff.assignedRegion);
      customers = await db.customer.findMany({
        where: {
          companyId: session.companyId,
          status: "ACTIVE",
          OR: [
            { region: { contains: area } },
            { address: { contains: area } },
          ],
        },
        orderBy: [{ region: "asc" }, { name: "asc" }],
      });
    }

    function matches(item: any) {
      if (!search) return true;
      const terms = search.split(/\s+/).filter(Boolean);
      const source = Object.values(item)
        .filter(
          (value) =>
            typeof value === "string" ||
            typeof value === "number",
        )
        .join(" ")
        .toLowerCase();
      return terms.every((term) => source.includes(term));
    }

    const filteredBrokers = brokers.filter(matches);
    const filteredCustomers = customers.filter(matches);

    const brokerLocations = Array.from(
      new Set<string>(
        brokers
          .map((item: any) =>
            cleanText(
              item.assignedArea ||
                item.ward ||
                item.district ||
                item.location ||
                item.region,
            ),
          )
          .filter(Boolean),
      ),
    ).sort((first: string, second: string) =>
      first.localeCompare(second),
    );

    const customerRegions = Array.from(
      new Set<string>(
        customers
          .map((item: any) => cleanText(item.region))
          .filter(Boolean),
      ),
    ).sort((first: string, second: string) =>
      first.localeCompare(second),
    );

    return NextResponse.json({
      success: true,
      brokers: serialize(filteredBrokers),
      customers: serialize(filteredCustomers),
      brokerLocations,
      customerRegions,
      totals: {
        brokers: filteredBrokers.length,
        customers: filteredCustomers.length,
      },
      restrictedToAssignedArea: true,
    });
  } catch (error) {
    console.error("STAFF_DIRECTORY_ERROR:", error);
    const result = responseError(error);
    return NextResponse.json(
      {
        success: false,
        message:
          result.status === 500
            ? "Could not load brokers and customers assigned to this staff account."
            : result.message,
        details:
          process.env.NODE_ENV === "development" &&
          error instanceof Error
            ? error.message
            : undefined,
      },
      { status: result.status },
    );
  }
}
