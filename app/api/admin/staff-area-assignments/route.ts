import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_ROLES = new Set([
  "COMPANY_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM_DEVELOPER",
]);

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeArea(value: unknown): string {
  return text(value)
    .toLocaleLowerCase("en")
    .replace(/[.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function brokerAreaValues(broker: any): string[] {
  return [
    broker.region,
    broker.district,
    broker.ward,
    broker.city,
    broker.location,
    broker.address,
    broker.attendedLocation,
  ]
    .map(normalizeArea)
    .filter(Boolean);
}

function brokerMatchesArea(broker: any, area: string): boolean {
  const target = normalizeArea(area);
  if (!target) return false;

  return brokerAreaValues(broker).some(
    (value) => value === target || value.includes(target) || target.includes(value),
  );
}

function areaLabel(value: unknown): string {
  return text(value).replace(/\s+/g, " ").slice(0, 191);
}

function prismaCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return text((error as { code?: unknown }).code);
  }
  return "";
}

async function requireCompanyAdmin() {
  const session = (await getCurrentUser()) as any;

  if (!session) {
    throw Object.assign(new Error("Authentication is required."), { status: 401 });
  }

  if (!ADMIN_ROLES.has(text(session.role).toUpperCase())) {
    throw Object.assign(new Error("Company Admin access is required."), {
      status: 403,
    });
  }

  if (!session.companyId) {
    throw Object.assign(
      new Error("The signed-in administrator is not assigned to a company."),
      { status: 403 },
    );
  }

  return {
    id: text(session.id),
    companyId: text(session.companyId),
    name: text(session.name || session.username || session.email),
  };
}

async function requireStaff(db: any, companyId: string, staffId: unknown) {
  const id = text(staffId);
  if (!id) {
    throw Object.assign(new Error("Choose a staff user."), { status: 400 });
  }

  const staff = await db.user.findFirst({
    where: {
      id,
      companyId,
      role: "STAFF",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      assignedRegion: true,
    },
  });

  if (!staff) {
    throw Object.assign(
      new Error("The selected user is not an active STAFF user in this company."),
      { status: 404 },
    );
  }

  return staff;
}

async function loadData(companyId: string) {
  const db = prisma as any;

  const [staff, brokers, customers, brokerAssignments, customerAssignments, branches] =
    await Promise.all([
      db.user.findMany({
        where: {
          companyId,
          role: "STAFF",
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          profileImageUrl: true,
          assignedRegion: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              region: true,
            },
          },
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
      db.brokerCustomer.findMany({
        where: {
          companyId,
          status: "ACTIVE",
        },
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
          isImported: true,
          status: true,
        },
        orderBy: [{ region: "asc" }, { district: "asc" }, { name: "asc" }],
      }),
      db.customer.findMany({
        where: {
          companyId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          region: true,
          address: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),
      db.staffBrokerCustomerAssignment.findMany({
        where: { companyId },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
              assignedRegion: true,
              profileImageUrl: true,
            },
          },
          brokerCustomer: {
            select: {
              id: true,
              code: true,
              name: true,
              businessName: true,
              phone: true,
              region: true,
              district: true,
              ward: true,
              location: true,
            },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.staffCustomerAssignment.findMany({
        where: { companyId },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
              assignedRegion: true,
              profileImageUrl: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              region: true,
              address: true,
            },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.branch.findMany({
        where: { companyId, status: "ACTIVE" },
        select: { id: true, name: true, code: true, region: true, address: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const activeAssignmentByBroker = new Map<string, any>();
  for (const assignment of brokerAssignments) {
    if (text(assignment.status).toUpperCase() === "ACTIVE") {
      assignment.broker = assignment.brokerCustomer;
      activeAssignmentByBroker.set(text(assignment.brokerCustomerId), assignment);
    }
  }

  const brokerAssignmentRows = brokerAssignments.map((assignment: any) => ({
    ...assignment,
    broker: assignment.brokerCustomer,
  }));

  const areas = Array.from(
    new Set<string>(
      [
        ...staff.map((item: any) => item.assignedRegion),
        ...branches.flatMap((item: any) => [item.region, item.address]),
        ...brokers.flatMap((item: any) => [
          item.region,
          item.district,
          item.ward,
          item.city,
          item.location,
          item.attendedLocation,
        ]),
      ]
        .map(areaLabel)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const brokerRows = brokers.map((broker: any) => {
    const assignment = activeAssignmentByBroker.get(text(broker.id));
    return {
      ...broker,
      activeAssignment: assignment
        ? {
            id: assignment.id,
            staffId: assignment.staffId,
            staffName: assignment.staff?.name || "Staff",
            assignedArea: assignment.assignedArea,
            startedAt: assignment.startedAt,
          }
        : null,
    };
  });

  return {
    success: true,
    staff,
    areas,
    branches,
    brokers: brokerRows,
    customers,
    brokerAssignments: brokerAssignmentRows,
    customerAssignments,
    summary: {
      staff: staff.length,
      areas: areas.length,
      brokers: brokers.length,
      assignedBrokers: brokerAssignments.filter(
        (item: any) => text(item.status).toUpperCase() === "ACTIVE",
      ).length,
      customers: customers.length,
      assignedCustomers: customerAssignments.filter(
        (item: any) => text(item.status).toUpperCase() === "ACTIVE",
      ).length,
    },
  };
}

export async function GET() {
  try {
    const session = await requireCompanyAdmin();
    return NextResponse.json(await loadData(session.companyId));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCompanyAdmin();
    const body = await request.json();
    const action = text(body.action).toUpperCase();
    const db = prisma as any;

    if (action === "ASSIGN_AREA") {
      const staff = await requireStaff(db, session.companyId, body.staffId);
      const area = areaLabel(body.area);
      if (!area) {
        throw Object.assign(new Error("Enter or choose an area."), { status: 400 });
      }

      await db.user.update({
        where: { id: staff.id },
        data: { assignedRegion: area },
      });

      return NextResponse.json({
        success: true,
        message: `${staff.name} was assigned to ${area}.`,
      });
    }

    if (
      action === "ASSIGN_AREA_BROKERS" ||
      action === "AUTO_ASSIGN_AREA_BROKERS"
    ) {
      const staff = await requireStaff(db, session.companyId, body.staffId);
      const area = areaLabel(body.area || staff.assignedRegion);
      if (!area) {
        throw Object.assign(new Error("Assign an area before assigning brokers."), {
          status: 400,
        });
      }

      const allAreaBrokers = (
        await db.brokerCustomer.findMany({
          where: { companyId: session.companyId, status: "ACTIVE" },
        })
      ).filter((broker: any) => brokerMatchesArea(broker, area));

      const requestedIds = Array.isArray(body.brokerIds)
        ? Array.from(new Set(body.brokerIds.map(text).filter(Boolean)))
        : [];

      const selected =
        action === "AUTO_ASSIGN_AREA_BROKERS"
          ? allAreaBrokers
          : allAreaBrokers.filter((broker: any) => requestedIds.includes(text(broker.id)));

      if (!selected.length) {
        throw Object.assign(
          new Error("No matching available brokers were selected for this area."),
          { status: 400 },
        );
      }

      if (action === "ASSIGN_AREA_BROKERS" && selected.length !== requestedIds.length) {
        throw Object.assign(
          new Error("One or more selected brokers do not belong to the selected area."),
          { status: 400 },
        );
      }

      const brokerIds = selected.map((broker: any) => text(broker.id));
      const existingAssignments = await db.staffBrokerCustomerAssignment.findMany({
        where: {
          companyId: session.companyId,
          brokerCustomerId: { in: brokerIds },
          status: "ACTIVE",
        },
        select: {
          id: true,
          staffId: true,
          brokerCustomerId: true,
        },
      });

      const assignedElsewhere = new Set(
        existingAssignments
          .filter((item: any) => text(item.staffId) !== staff.id)
          .map((item: any) => text(item.brokerCustomerId)),
      );
      const assignable = selected.filter(
        (broker: any) => !assignedElsewhere.has(text(broker.id)),
      );

      if (!assignable.length) {
        throw Object.assign(
          new Error("Every broker in this selection is already assigned to another staff user."),
          { status: 409 },
        );
      }

      await db.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: staff.id },
          data: { assignedRegion: area },
        });

        for (const broker of assignable) {
          await tx.staffBrokerCustomerAssignment.upsert({
            where: {
              companyId_brokerCustomerId: {
                companyId: session.companyId,
                brokerCustomerId: text(broker.id),
              },
            },
            create: {
              companyId: session.companyId,
              staffId: staff.id,
              brokerCustomerId: text(broker.id),
              assignedById: session.id,
              assignedArea: area,
              status: "ACTIVE",
              notes: text(body.notes) || null,
            },
            update: {
              staffId: staff.id,
              assignedById: session.id,
              assignedArea: area,
              status: "ACTIVE",
              startedAt: new Date(),
              endedAt: null,
              notes: text(body.notes) || null,
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `${assignable.length} broker${assignable.length === 1 ? "" : "s"} in ${area} assigned to ${staff.name}.${
          assignedElsewhere.size
            ? ` ${assignedElsewhere.size} broker(s) were skipped because another staff user already owns them.`
            : ""
        }`,
      });
    }

    if (action === "UNASSIGN_BROKER") {
      const assignmentId = text(body.assignmentId);
      const assignment = await db.staffBrokerCustomerAssignment.findFirst({
        where: { id: assignmentId, companyId: session.companyId },
        include: { brokerCustomer: { select: { name: true } } },
      });

      if (!assignment) {
        throw Object.assign(new Error("Broker assignment was not found."), {
          status: 404,
        });
      }

      await db.staffBrokerCustomerAssignment.update({
        where: { id: assignment.id },
        data: { status: "INACTIVE", endedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: `${assignment.brokerCustomer?.name || "Broker"} was removed from the staff assignment.`,
      });
    }

    if (action === "ASSIGN_CUSTOMER") {
      const staff = await requireStaff(db, session.companyId, body.staffId);
      const customerId = text(body.customerId);
      const customer = await db.customer.findFirst({
        where: {
          id: customerId,
          companyId: session.companyId,
          status: "ACTIVE",
        },
        select: { id: true, name: true },
      });

      if (!customer) {
        throw Object.assign(new Error("The selected customer was not found."), {
          status: 404,
        });
      }

      await db.staffCustomerAssignment.upsert({
        where: {
          companyId_customerId: {
            companyId: session.companyId,
            customerId: customer.id,
          },
        },
        create: {
          companyId: session.companyId,
          staffId: staff.id,
          customerId: customer.id,
          assignedById: session.id,
          status: "ACTIVE",
          notes: text(body.notes) || null,
        },
        update: {
          staffId: staff.id,
          assignedById: session.id,
          status: "ACTIVE",
          startedAt: new Date(),
          endedAt: null,
          notes: text(body.notes) || null,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${customer.name} was assigned to ${staff.name}.`,
      });
    }

    if (action === "UNASSIGN_CUSTOMER") {
      const assignmentId = text(body.assignmentId);
      const assignment = await db.staffCustomerAssignment.findFirst({
        where: { id: assignmentId, companyId: session.companyId },
        include: { customer: { select: { name: true } } },
      });

      if (!assignment) {
        throw Object.assign(new Error("Customer assignment was not found."), {
          status: 404,
        });
      }

      await db.staffCustomerAssignment.update({
        where: { id: assignment.id },
        data: { status: "INACTIVE", endedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: `${assignment.customer?.name || "Customer"} was removed from the staff assignment.`,
      });
    }

    if (action === "RELEASE_STAFF_AREA") {
      const staff = await requireStaff(db, session.companyId, body.staffId);

      await db.$transaction([
        db.user.update({
          where: { id: staff.id },
          data: { assignedRegion: null },
        }),
        db.staffBrokerCustomerAssignment.updateMany({
          where: {
            companyId: session.companyId,
            staffId: staff.id,
            status: "ACTIVE",
          },
          data: { status: "INACTIVE", endedAt: new Date() },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `${staff.name}'s area and active broker assignments were released.`,
      });
    }

    throw Object.assign(new Error("Unsupported assignment action."), {
      status: 400,
    });
  } catch (error) {
    return routeError(error);
  }
}

function routeError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
  const code = prismaCode(error);
  const schemaProblem = code === "P2021" || code === "P2022";

  console.error("[STAFF_AREA_ASSIGNMENTS]", error);

  return NextResponse.json(
    {
      success: false,
      message: schemaProblem
        ? "The staff-area assignment database is not synchronized."
        : error instanceof Error
          ? error.message
          : "The staff-area assignment action failed.",
      code: code || undefined,
      details: schemaProblem
        ? "Run npx prisma db push, npx prisma generate, clear .next, then restart the server."
        : process.env.NODE_ENV === "development"
          ? String(error)
          : undefined,
    },
    { status: schemaProblem ? 503 : status },
  );
}
