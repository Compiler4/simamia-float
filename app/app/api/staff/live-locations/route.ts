import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { visibleBrokerCustomers } from "@/lib/staff/broker-scope";
import { formattedDatabaseAddress } from "@/lib/staff/geocode-broker";
import { darDayBounds } from "@/lib/staff/geo";
import { locationFresh, usableCoordinatePair } from "@/lib/staff/location-quality";
import { requireStaffSession } from "@/lib/staff/require-staff";
import { loadBrokerServiceVisits } from "@/lib/staff/service-visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function serialise<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === "object" && typeof item.toNumber === "function") {
        return item.toNumber();
      }
      return item;
    }),
  ) as T;
}

async function loadTodayVisits(input: {
  companyId: string;
  staffId: string;
  start: Date;
  end: Date;
}) {
  return loadBrokerServiceVisits(input);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

  if (message === "UNAUTHENTICATED") {
    return NextResponse.json(
      { success: false, message: "Authentication is required." },
      { status: 401 },
    );
  }

  if (message === "FORBIDDEN" || message === "STAFF_COMPANY_REQUIRED") {
    return NextResponse.json(
      { success: false, message: "Staff access is required." },
      { status: 403 },
    );
  }

  const prismaCode = (error as { code?: string })?.code;
  console.error("[STAFF_LIVE_LOCATIONS]", error);

  return NextResponse.json(
    {
      success: false,
      message:
        prismaCode === "P2021" || prismaCode === "P2022"
          ? "The live-location database is not synchronized. Add the supplied Prisma models, then run npx prisma db push and npx prisma generate."
          : "Live locations could not be loaded.",
      code: prismaCode,
      details: process.env.NODE_ENV === "development" ? message : undefined,
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const session = await requireStaffSession();
    const database = db as any;
    const scope = await visibleBrokerCustomers(session.companyId, session.id);
    const today = darDayBounds(new Date());
    const visibleBrokerIds = scope.brokers.map((broker) => String(broker.id));

    const [staffDevices, customerAssignments, userBrokerAssignments, visits, agentDevices] =
      await Promise.all([
        database.companyGpsDevice.findMany({
          where: {
            companyId: session.companyId,
            ownerUserId: session.id,
          },
          include: {
            pings: {
              where: { capturedAt: { gte: today.start, lte: today.end } },
              orderBy: { capturedAt: "asc" },
              take: 2500,
            },
          },
          orderBy: { lastSeenAt: "desc" },
        }),
        database.staffCustomerAssignment.findMany({
          where: {
            companyId: session.companyId,
            staffId: session.id,
            status: "ACTIVE",
          },
          include: { customer: true },
        }),
        database.staffBrokerAssignment.findMany({
          where: {
            companyId: session.companyId,
            staffId: session.id,
            status: "ACTIVE",
          },
          select: { brokerId: true },
        }),
        loadTodayVisits({
          companyId: session.companyId,
          staffId: session.id,
          start: today.start,
          end: today.end,
        }),
        database.brokerAgentLocationDevice?.findMany && visibleBrokerIds.length
          ? database.brokerAgentLocationDevice.findMany({
              where: {
                companyId: session.companyId,
                brokerCustomerId: { in: visibleBrokerIds },
                status: "ACTIVE",
              },
              orderBy: { lastSeenAt: "desc" },
            })
          : Promise.resolve([]),
      ]);

    const assignedBrokerUserIds = (
      userBrokerAssignments as Array<{ brokerId: string }>
    ).map((row) => row.brokerId);

    const brokerUserDevices = assignedBrokerUserIds.length
      ? await database.companyGpsDevice.findMany({
          where: {
            companyId: session.companyId,
            ownerUserId: { in: assignedBrokerUserIds },
            owner: { role: "BROKER" },
          },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                profileImageUrl: true,
              },
            },
          },
          orderBy: { lastSeenAt: "desc" },
        })
      : [];

    const visitByBroker = new Map<string, any>();
    for (const visit of visits as any[]) {
      if (!visitByBroker.has(String(visit.brokerCustomerId))) {
        visitByBroker.set(String(visit.brokerCustomerId), visit);
      }
    }

    const agentDeviceByBroker = new Map<string, any>();
    for (const device of agentDevices as any[]) {
      if (!agentDeviceByBroker.has(String(device.brokerCustomerId))) {
        agentDeviceByBroker.set(String(device.brokerCustomerId), device);
      }
    }

    const registeredAgents = scope.brokers.map((broker) => {
      const visit = visitByBroker.get(String(broker.id)) ?? null;
      const liveDevice = agentDeviceByBroker.get(String(broker.id)) ?? null;
      const liveDeviceValid = Boolean(
        liveDevice &&
          usableCoordinatePair(liveDevice.lastLatitude, liveDevice.lastLongitude),
      );
      const liveNow = liveDeviceValid && locationFresh(liveDevice.lastSeenAt);
      const storedValid = usableCoordinatePair(broker.latitude, broker.longitude);
      const latitude = liveDeviceValid
        ? Number(liveDevice.lastLatitude)
        : storedValid
          ? Number(broker.latitude)
          : null;
      const longitude = liveDeviceValid
        ? Number(liveDevice.lastLongitude)
        : storedValid
          ? Number(broker.longitude)
          : null;
      const mapped = usableCoordinatePair(latitude, longitude);
      const servicedToday = Boolean(
        visit &&
          ["COMPLETED", "SERVICE_RECORDED", "PROOF_PENDING", "LATE_PROOF"].includes(
            String(visit.status),
          ),
      );
      const visitedToday = Boolean(visit?.arrivedAt || visit?.startedAt);
      const locationSource = liveDeviceValid
        ? liveNow
          ? "AGENT_LIVE_DEVICE"
          : "AGENT_DEVICE_LAST_KNOWN"
        : broker.attendedDate && storedValid
          ? "STAFF_GPS_VERIFIED"
          : storedValid && broker.isImported
            ? "DATABASE_ADDRESS_APPROXIMATE"
            : storedValid
              ? "DATABASE_COORDINATE"
              : "UNMAPPED";

      return {
        ...broker,
        latitude,
        longitude,
        mapped,
        liveNow,
        liveDeviceSeenAt: liveDevice?.lastSeenAt ?? null,
        liveAccuracy: liveDevice?.lastAccuracy ?? null,
        locationSource,
        locationVerifiedAt:
          liveDevice?.lastSeenAt ?? broker.attendedDate ?? broker.updatedAt ?? null,
        markerType: broker.isImported
          ? servicedToday
            ? "REGISTERED_AGENT_SERVICED"
            : visitedToday
              ? "REGISTERED_AGENT_VISITED"
              : "REGISTERED_AGENT"
          : servicedToday
            ? "BROKER_CUSTOMER_SERVICED"
            : "BROKER_CUSTOMER",
        fullAddress: formattedDatabaseAddress(broker),
        visitToday: visit,
        visitedToday,
        servicedToday,
      };
    });

    const customers = (
      customerAssignments as Array<{ customer: Record<string, any> }>
    )
      .map((assignment) => assignment.customer)
      .filter(Boolean)
      .map((customer: any) => ({
        ...customer,
        mapped: usableCoordinatePair(customer.latitude, customer.longitude),
        markerType: "CUSTOMER",
        locationSource: usableCoordinatePair(customer.latitude, customer.longitude)
          ? "DATABASE_COORDINATE"
          : "UNMAPPED",
        fullAddress: formattedDatabaseAddress({
          name: customer.name,
          address: customer.address,
          ward: customer.ward,
          district: customer.district,
          region: customer.region,
          location: customer.locationName,
        }),
      }));

    const primaryStaffDevice = staffDevices.find((device: any) =>
      usableCoordinatePair(device.lastLatitude, device.lastLongitude),
    );

    const staffPoints = primaryStaffDevice
      ? [
          {
            id: `staff-device-${primaryStaffDevice.id}`,
            entityId: session.id,
            markerType: "STAFF",
            label: session.name,
            subtitle: `Staff live device · ${primaryStaffDevice.name}`,
            latitude: Number(primaryStaffDevice.lastLatitude),
            longitude: Number(primaryStaffDevice.lastLongitude),
            capturedAt: primaryStaffDevice.lastSeenAt,
            speedKph: primaryStaffDevice.speedKph,
            accuracy: primaryStaffDevice.gpsAccuracy,
            source: "STAFF_LIVE_DEVICE",
          },
        ]
      : [];

    const brokerLivePoints = brokerUserDevices
      .filter((device: any) =>
        usableCoordinatePair(device.lastLatitude, device.lastLongitude),
      )
      .map((device: any) => ({
        id: `broker-device-${device.id}`,
        entityId: device.ownerUserId,
        markerType: "BROKER_LIVE",
        label: device.owner?.name || device.ownerName || device.name,
        subtitle: "Broker live device",
        latitude: Number(device.lastLatitude),
        longitude: Number(device.lastLongitude),
        capturedAt: device.lastSeenAt,
        speedKph: device.speedKph,
        accuracy: device.gpsAccuracy,
        source: "BROKER_LIVE_DEVICE",
      }));

    const agentPoints = registeredAgents
      .filter((broker) => broker.mapped)
      .map((broker) => ({
        id: `agent-${broker.id}`,
        entityId: broker.id,
        markerType: broker.markerType,
        label: broker.businessName || broker.name,
        subtitle: [
          broker.code,
          broker.liveNow
            ? "Sharing live GPS now"
            : broker.locationSource === "AGENT_DEVICE_LAST_KNOWN"
              ? "Agent GPS last known position"
              : broker.servicedToday
              ? "Serviced today"
              : broker.visitedToday
                ? "Visited today"
                : "Not visited today",
          broker.address,
          broker.ward,
          broker.district,
          broker.region,
          broker.location,
        ]
          .filter(Boolean)
          .join(" · "),
        latitude: Number(broker.latitude),
        longitude: Number(broker.longitude),
        capturedAt: broker.locationVerifiedAt,
        source: broker.locationSource,
        accuracy: broker.liveAccuracy,
        directlyAssigned: broker.directlyAssigned,
      }));

    const customerPoints = customers
      .filter((customer: any) => customer.mapped)
      .map((customer: any) => ({
        id: `customer-${customer.id}`,
        entityId: customer.id,
        markerType: "CUSTOMER",
        label: customer.name,
        subtitle: customer.fullAddress || "Customer location",
        latitude: Number(customer.latitude),
        longitude: Number(customer.longitude),
        capturedAt: customer.updatedAt || null,
        source: customer.locationSource,
      }));

    const history = primaryStaffDevice
      ? (primaryStaffDevice.pings || [])
          .filter((ping: any) => usableCoordinatePair(ping.latitude, ping.longitude))
          .map((ping: any) => ({
            id: `history-${ping.id}`,
            markerType: "HISTORY",
            latitude: Number(ping.latitude),
            longitude: Number(ping.longitude),
            capturedAt: ping.capturedAt,
            label: "Staff route",
          }))
      : [];

    return NextResponse.json(
      serialise({
        success: true,
        staff: session,
        points: [...staffPoints, ...brokerLivePoints, ...agentPoints, ...customerPoints],
        history,
        staffDevices,
        brokerUserDevices,
        registeredAgents,
        customers,
        visits,
        summary: {
          staffDevices: staffDevices.length,
          staffPointers: staffPoints.length,
          liveBrokerDevices: brokerUserDevices.length,
          liveAgents: registeredAgents.filter((broker) => broker.liveNow).length,
          registeredAgents: registeredAgents.length,
          mappedAgents: registeredAgents.filter((broker) => broker.mapped).length,
          unmappedAgents: registeredAgents.filter((broker) => !broker.mapped).length,
          visitedAgents: registeredAgents.filter((broker) => broker.visitedToday).length,
          servicedAgents: registeredAgents.filter((broker) => broker.servicedToday).length,
          customers: customers.length,
          mappedCustomers: customers.filter((customer: any) => customer.mapped).length,
          visitsToday: visits.length,
          rejectedZeroCoordinates:
            scope.brokers.filter(
              (broker) =>
                Number(broker.latitude) === 0 && Number(broker.longitude) === 0,
            ).length,
        },
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
