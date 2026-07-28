import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalized(value: unknown): string {
  return text(value)
    .toLocaleLowerCase("en")
    .replace(/[.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function values(items: unknown[]): string[] {
  return items.map(normalized).filter(Boolean);
}

function matches(items: string[], target: unknown): boolean {
  const needle = normalized(target);
  if (!needle) return true;
  return items.some(
    (item) => item === needle || item.includes(needle) || needle.includes(item),
  );
}

function brokerMatchesArea(broker: any, area: any): boolean {
  return (
    matches(values([broker.region, broker.city, broker.location]), area.region) &&
    matches(values([broker.district, broker.location, broker.address]), area.district) &&
    matches(
      values([broker.ward, broker.location, broker.address, broker.attendedLocation]),
      area.ward,
    ) &&
    matches(
      values([broker.ward, broker.location, broker.address, broker.attendedLocation]),
      area.street,
    )
  );
}

export async function GET() {
  try {
    const session = (await getCurrentUser()) as any;
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication is required." },
        { status: 401 },
      );
    }

    if (text(session.role).toUpperCase() !== "STAFF" || !session.companyId) {
      return NextResponse.json(
        { success: false, message: "Staff access is required." },
        { status: 403 },
      );
    }

    const db = prisma as any;
    const companyId = text(session.companyId);
    const staffId = text(session.id);

    const [areas, assignments, brokers] = await Promise.all([
      db.staffWorkArea.findMany({
        where: { companyId, staffId, status: "ACTIVE" },
        orderBy: { startedAt: "asc" },
      }),
      db.staffBrokerCustomerAssignment.findMany({
        where: { companyId, staffId, status: "ACTIVE" },
        select: { id: true, brokerCustomerId: true, workAreaId: true, assignedArea: true },
      }),
      db.brokerCustomer.findMany({
        where: { companyId, status: "ACTIVE" },
        select: {
          id: true,
          code: true,
          name: true,
          businessName: true,
          phone: true,
          alternatePhone: true,
          email: true,
          location: true,
          region: true,
          district: true,
          ward: true,
          city: true,
          address: true,
          attendedLocation: true,
          latitude: true,
          longitude: true,
          status: true,
        },
        orderBy: [{ region: "asc" }, { district: "asc" }, { name: "asc" }],
      }),
    ]);

    const assignmentByBroker = new Map(
      assignments.map((item: any) => [text(item.brokerCustomerId), item]),
    );

    const visible = brokers
      .filter((broker: any) => {
        const directlyAssigned = assignmentByBroker.has(text(broker.id));
        const inAssignedArea = areas.some((area: any) => brokerMatchesArea(broker, area));
        return directlyAssigned || inAssignedArea;
      })
      .map((broker: any) => {
        const assignment = assignmentByBroker.get(text(broker.id));
        return {
          ...broker,
          directlyAssigned: Boolean(assignment),
          canOperate: Boolean(assignment),
          assignmentId: assignment?.id || null,
          workAreaId: assignment?.workAreaId || null,
          assignedArea: assignment?.assignedArea || null,
        };
      });

    const locations = Array.from(
      new Set(
        visible
          .flatMap((broker: any) => [
            broker.region,
            broker.district,
            broker.ward,
            broker.location,
          ])
          .map(text)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      success: true,
      areas,
      brokers: visible,
      locations,
      total: visible.length,
      assignedTotal: visible.filter((item: any) => item.directlyAssigned).length,
    });
  } catch (error) {
    console.error("[STAFF_AREA_BROKERS]", error);
    return NextResponse.json(
      {
        success: false,
        message: "The staff broker directory could not load.",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
