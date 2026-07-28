import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  assignedBrokerCustomers,
  localDateKey,
  periodBounds,
} from "@/lib/staff/operations-v4";
import { sendNotice, sendNoticeToRoles } from "@/lib/staff/notify";
import { requireStaff } from "@/lib/staff/permissions";
import { tzDateKey } from "@/lib/staff/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function numberValue(value: unknown, name?: string): number {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    if (name) throw new Error(`INVALID:${name}`);
    return 0;
  }

  return parsed;
}

function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) *
      Math.cos(rad(bLat)) *
      Math.sin(dLng / 2) ** 2;

  return earth * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

async function setting(
  companyId: string,
  key: string,
): Promise<string | null> {
  const row = await (db as any).companySetting.findUnique({
    where: {
      companyId_key: {
        companyId,
        key,
      },
    },
  });

  return row?.value || null;
}

async function createAlert(input: {
  companyId: string;
  userId: string;
  deviceId?: string | null;
  type: string;
  title: string;
  message: string;
  latitude?: number | null;
  longitude?: number | null;
  speedKph?: number | null;
  dedupeKey: string;
}) {
  const database = db as any;
  const existing = await database.gpsAlert.findUnique({
    where: {
      companyId_dedupeKey: {
        companyId: input.companyId,
        dedupeKey: input.dedupeKey,
      },
    },
  });

  const alert = await database.gpsAlert.upsert({
    where: {
      companyId_dedupeKey: {
        companyId: input.companyId,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      companyId: input.companyId,
      userId: input.userId,
      deviceId: input.deviceId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      speedKph: input.speedKph ?? null,
      dedupeKey: input.dedupeKey,
      status: "OPEN",
    },
    update: {
      deviceId: input.deviceId || existing?.deviceId,
      title: input.title,
      message: input.message,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      speedKph: input.speedKph ?? null,
      status: "OPEN",
      resolvedAt: null,
    },
  });

  if (!existing || existing.status === "RESOLVED") {
    await Promise.all([
      sendNotice({
        companyId: input.companyId,
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: "WARNING",
      }),
      sendNoticeToRoles({
        companyId: input.companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT", "GPS_MANAGER"],
        title: input.title,
        message: input.message,
        type: "WARNING",
        excludeUserId: input.userId,
      }),
    ]);
  }

  return alert;
}

async function resolveConnectivityAlerts(
  companyId: string,
  userId: string,
) {
  await (db as any).gpsAlert.updateMany({
    where: {
      companyId,
      userId,
      status: "OPEN",
      type: {
        in: ["GPS_DISABLED", "EMPLOYEE_OFFLINE"],
      },
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });
}

function inferredServiceType(
  floatAmount: number,
  cashAmount: number,
): string {
  if (floatAmount > 0 && cashAmount > 0) {
    return "FLOAT_AND_CASH_SERVICE";
  }

  if (floatAmount > 0) return "FLOAT_SERVICE";
  if (cashAmount > 0) return "CASH_SERVICE";
  return "GPS_ARRIVAL_PENDING_DETAILS";
}

async function inferBrokerAmounts(input: {
  companyId: string;
  staffId: string;
  brokerCustomerId: string;
  start: Date;
  end: Date;
}) {
  const database = db as any;

  const [floats, collections] = await Promise.all([
    database.floatTransaction.findMany({
      where: {
        companyId: input.companyId,
        fromUserId: input.staffId,
        brokerCustomerId: input.brokerCustomerId,
        transactionType: "STAFF_TO_BROKER",
        status: {
          not: "REJECTED",
        },
        createdAt: {
          gte: input.start,
          lte: input.end,
        },
      },
      select: {
        amount: true,
      },
    }),
    database.staffCollection.findMany({
      where: {
        companyId: input.companyId,
        staffId: input.staffId,
        brokerCustomerId: input.brokerCustomerId,
        status: {
          not: "REJECTED",
        },
        collectionDate: {
          gte: input.start,
          lte: input.end,
        },
      },
      select: {
        amount: true,
      },
    }),
  ]);

  return {
    floatAmount: floats.reduce(
      (sum: number, row: any) => sum + numberValue(row.amount),
      0,
    ),
    cashAmount: collections.reduce(
      (sum: number, row: any) => sum + numberValue(row.amount),
      0,
    ),
  };
}

async function autoDetectBrokerVisit(input: {
  companyId: string;
  staffId: string;
  staffName: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  capturedAt: Date;
}) {
  const database = db as any;
  const radiusMeters = Math.max(
    30,
    Number(
      (await setting(
        input.companyId,
        "BROKER_AUTO_VISIT_RADIUS_METERS",
      )) || 150,
    ),
  );

  const assigned = await assignedBrokerCustomers(
    input.companyId,
    input.staffId,
  );

  const nearby = assigned
    .filter(
      (broker: any) =>
        Number.isFinite(Number(broker.latitude)) &&
        Number.isFinite(Number(broker.longitude)),
    )
    .map((broker: any) => ({
      broker,
      distanceMeters:
        distanceKm(
          input.latitude,
          input.longitude,
          Number(broker.latitude),
          Number(broker.longitude),
        ) * 1000,
    }))
    .filter(
      (row: any) => row.distanceMeters <= radiusMeters,
    )
    .sort(
      (left: any, right: any) =>
        left.distanceMeters - right.distanceMeters,
    );

  const nearest = nearby[0];
  if (!nearest) return null;

  const day = periodBounds(
    "DAY",
    localDateKey(input.capturedAt),
  );

  const amounts = await inferBrokerAmounts({
    companyId: input.companyId,
    staffId: input.staffId,
    brokerCustomerId: String(nearest.broker.id),
    start: day.start,
    end: day.end,
  });

  const existingVisit = await database.brokerServiceVisit.findFirst({
    where: {
      companyId: input.companyId,
      staffId: input.staffId,
      brokerCustomerId: String(nearest.broker.id),
      startedAt: {
        gte: day.start,
        lte: day.end,
      },
      status: {
        not: "CANCELLED",
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  const floatAmount = Math.max(
    amounts.floatAmount,
    numberValue(existingVisit?.floatAmount),
  );
  const cashAmount = Math.max(
    amounts.cashAmount,
    numberValue(existingVisit?.cashAmount),
  );
  const hasFinancialService = floatAmount + cashAmount > 0;
  const serviceType = hasFinancialService
    ? inferredServiceType(floatAmount, cashAmount)
    : String(
        existingVisit?.serviceType ||
          "GPS_ARRIVAL_PENDING_DETAILS",
      );
  const protectedStatus = [
    "SERVICE_RECORDED",
    "PROOF_PENDING",
    "COMPLETED",
    "LATE_PROOF",
  ].includes(String(existingVisit?.status));
  const visitStatus = protectedStatus
    ? String(existingVisit.status)
    : hasFinancialService
      ? "SERVICE_RECORDED"
      : "ARRIVED";

  let activityId = existingVisit?.serviceActivityId ?? null;

  if (hasFinancialService && !activityId) {
    const activity = await database.serviceActivity.create({
      data: {
        companyId: input.companyId,
        staffId: input.staffId,
        brokerId: null,
        brokerCustomerId: String(nearest.broker.id),
        customerId: null,
        serviceType,
        amount: floatAmount + cashAmount,
        status: "AUTO_DETECTED",
        servedAt: input.capturedAt,
        latitude: input.latitude,
        longitude: input.longitude,
        locationName:
          nearest.broker.location ||
          nearest.broker.assignedArea ||
          null,
        notes:
          "Automatically linked from GPS proximity and the staff's same-day broker transactions.",
      },
    });

    activityId = activity.id;
  }

  const visitData = {
    deviceId: input.deviceId,
    serviceActivityId: activityId,
    status: visitStatus,
    serviceType,
    communicationNote: hasFinancialService
      ? "Auto-detected from GPS proximity and same-day broker transactions."
      : "GPS arrival detected. Staff must confirm service type and amounts.",
    floatAmount,
    cashAmount,
    staffLatitude: input.latitude,
    staffLongitude: input.longitude,
    brokerLatitude: Number(nearest.broker.latitude),
    brokerLongitude: Number(nearest.broker.longitude),
    distanceMeters: nearest.distanceMeters,
    locationMatched: true,
    arrivedAt: existingVisit?.arrivedAt ?? input.capturedAt,
    serviceProvidedAt: hasFinancialService
      ? input.capturedAt
      : existingVisit?.serviceProvidedAt ?? null,
  };

  const visit = existingVisit
    ? await database.brokerServiceVisit.update({
        where: {
          id: existingVisit.id,
        },
        data: visitData,
      })
    : await database.brokerServiceVisit.create({
        data: {
          companyId: input.companyId,
          staffId: input.staffId,
          brokerCustomerId: String(nearest.broker.id),
          startedAt: input.capturedAt,
          ...visitData,
        },
      });

  await database.brokerCustomer.update({
    where: {
      id: String(nearest.broker.id),
    },
    data: {
      attendedBy: input.staffName,
      attendedDate: input.capturedAt,
      attendedLocation:
        nearest.broker.location ||
        nearest.broker.assignedArea ||
        null,
    },
  });

  const isFirstDetection = !existingVisit;
  const wasPending =
    existingVisit &&
    ["STARTED", "ARRIVED"].includes(String(existingVisit.status));
  const newlyCompletedFromTransactions =
    Boolean(wasPending) && hasFinancialService;

  if (isFirstDetection || newlyCompletedFromTransactions) {
    const message = hasFinancialService
      ? `${input.staffName} serviced ${nearest.broker.name} (${serviceType.replaceAll("_", " ")}): float TZS ${floatAmount.toLocaleString()} and cash TZS ${cashAmount.toLocaleString()}.`
      : `${input.staffName} arrived at ${nearest.broker.name}. GPS marked the broker as visited; service type and amounts still need confirmation.`;

    await Promise.all([
      sendNotice({
        companyId: input.companyId,
        userId: input.staffId,
        title: hasFinancialService
          ? "Broker service auto-updated"
          : "Broker arrival auto-detected",
        message,
        type: hasFinancialService ? "SUCCESS" : "INFO",
      }),
      sendNoticeToRoles({
        companyId: input.companyId,
        roles: ["COMPANY_ADMIN", "ACCOUNTANT", "GPS_MANAGER"],
        title: hasFinancialService
          ? "Broker service auto-updated"
          : "Broker visit auto-detected",
        message,
        type: hasFinancialService ? "SUCCESS" : "INFO",
        excludeUserId: input.staffId,
      }),
    ]);
  }

  return {
    id: visit.id,
    brokerId: String(nearest.broker.id),
    brokerName: String(nearest.broker.name),
    distanceMeters: Number(nearest.distanceMeters.toFixed(1)),
    status: visit.status,
    serviceType,
    floatAmount,
    cashAmount,
    requiresManualDetails: !hasFinancialService,
  };
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await request.json();

    if (String(body.event || "").toUpperCase() === "DISABLED") {
      await createAlert({
        companyId: session.companyId,
        userId: session.id,
        type: "GPS_DISABLED",
        title: "GPS disabled",
        message: `${session.name}'s device denied or disabled location access.`,
        dedupeKey: `GPS_DISABLED:${session.id}:${tzDateKey()}`,
      });

      return NextResponse.json({
        success: true,
        message: "GPS-disabled alert recorded.",
      });
    }

    const latitude = numberValue(body.latitude, "latitude");
    const longitude = numberValue(body.longitude, "longitude");
    const accuracy =
      body.accuracy == null
        ? null
        : numberValue(body.accuracy, "accuracy");
    const speedMps =
      body.speed == null
        ? null
        : numberValue(body.speed, "speed");
    const heading =
      body.heading == null
        ? null
        : numberValue(body.heading, "heading");
    const batteryLevel =
      body.batteryLevel == null
        ? null
        : Math.round(numberValue(body.batteryLevel, "batteryLevel"));
    const deviceToken = String(body.deviceToken ?? "").trim();
    const deviceName = String(
      body.deviceName ?? "Staff mobile device",
    )
      .trim()
      .slice(0, 120);
    const capturedAt = body.capturedAt
      ? new Date(String(body.capturedAt))
      : new Date();

    if (!deviceToken) {
      return NextResponse.json(
        {
          success: false,
          message: "A device token is required.",
        },
        { status: 400 },
      );
    }

    if (
      Number.isNaN(capturedAt.getTime()) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The GPS coordinates or capture time are invalid.",
        },
        { status: 400 },
      );
    }

    const speedKph =
      speedMps == null
        ? null
        : Math.max(0, speedMps * 3.6);
    const database = db as any;
    const existing = await database.companyGpsDevice.findUnique({
      where: {
        deviceToken,
      },
    });

    if (
      existing &&
      (existing.companyId !== session.companyId ||
        existing.ownerUserId !== session.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This GPS device belongs to another account.",
        },
        { status: 403 },
      );
    }

    const device = existing
      ? await database.companyGpsDevice.update({
          where: {
            id: existing.id,
          },
          data: {
            name: deviceName,
            status: "ACTIVE",
            lastSeenAt: capturedAt,
            lastLatitude: latitude,
            lastLongitude: longitude,
            batteryLevel,
            gpsAccuracy: accuracy,
            speedKph,
          },
        })
      : await database.companyGpsDevice.create({
          data: {
            companyId: session.companyId,
            name: deviceName,
            deviceType: "WEB_GEOLOCATION",
            ownerUserId: session.id,
            ownerName: session.name,
            deviceToken,
            status: "ACTIVE",
            lastSeenAt: capturedAt,
            lastLatitude: latitude,
            lastLongitude: longitude,
            batteryLevel,
            gpsAccuracy: accuracy,
            speedKph,
          },
        });

    const recentPing = await database.companyGpsPing.findFirst({
      where: {
        deviceId: device.id,
      },
      orderBy: {
        capturedAt: "desc",
      },
    });

    await Promise.all([
      database.companyGpsPing.create({
        data: {
          deviceId: device.id,
          companyId: session.companyId,
          latitude,
          longitude,
          accuracy,
          batteryLevel,
          speedKph,
          capturedAt,
        },
      }),
      database.gpsTracking.create({
        data: {
          companyId: session.companyId,
          userId: session.id,
          assetType: "STAFF_DEVICE",
          assetName: deviceName,
          liveLocation: JSON.stringify({
            latitude,
            longitude,
            accuracy,
            heading,
          }),
          latitude,
          longitude,
          accuracy,
          heading,
          speed: speedKph,
          gpsSignal:
            accuracy == null
              ? "AVAILABLE"
              : accuracy <= 20
                ? "STRONG"
                : accuracy <= 50
                  ? "FAIR"
                  : "WEAK",
          recordedAt: capturedAt,
        },
      }),
    ]);

    await resolveConnectivityAlerts(
      session.companyId,
      session.id,
    );

    /*
     * Attendance is intentionally NOT created from GPS.
     * Staff attendance is counted only after an accountant saves an
     * ACCOUNTANT_VERIFIED attendance record.
     */

    const autoVisit = await autoDetectBrokerVisit({
      companyId: session.companyId,
      staffId: session.id,
      staffName: session.name,
      deviceId: device.id,
      latitude,
      longitude,
      capturedAt,
    }).catch((error) => {
      console.warn("STAFF_AUTO_BROKER_VISIT_WARNING:", error);
      return null;
    });

    const overspeed = Number(
      (await setting(session.companyId, "GPS_OVERSPEED_KPH")) || 80,
    );

    if ((speedKph || 0) > overspeed) {
      await createAlert({
        companyId: session.companyId,
        userId: session.id,
        deviceId: device.id,
        type: "OVERSPEED",
        title: "Overspeed alert",
        message: `${session.name} was travelling at ${Math.round(speedKph || 0)} km/h, above the ${overspeed} km/h limit.`,
        latitude,
        longitude,
        speedKph,
        dedupeKey: `OVERSPEED:${session.id}:${tzDateKey(capturedAt)}:${capturedAt.getUTCHours()}`,
      });
    }

    const geofenceRaw = await setting(
      session.companyId,
      `STAFF_GEOFENCE_${session.id}`,
    );

    if (geofenceRaw) {
      try {
        const fence = JSON.parse(geofenceRaw) as {
          latitude: number;
          longitude: number;
          radiusKm: number;
          name?: string;
        };
        const distance = distanceKm(
          fence.latitude,
          fence.longitude,
          latitude,
          longitude,
        );

        if (distance > Number(fence.radiusKm || 0)) {
          await createAlert({
            companyId: session.companyId,
            userId: session.id,
            deviceId: device.id,
            type: "LEFT_ASSIGNED_REGION",
            title: "Assigned region alert",
            message: `${session.name} moved ${distance.toFixed(1)} km from ${fence.name || "the assigned region"}.`,
            latitude,
            longitude,
            speedKph,
            dedupeKey: `LEFT_REGION:${session.id}:${tzDateKey(capturedAt)}`,
          });
        }
      } catch {
        // An invalid optional setting must not stop location tracking.
      }
    }

    const idleMinutes = Number(
      (await setting(
        session.companyId,
        "GPS_LONG_IDLE_MINUTES",
      )) || 30,
    );

    if (recentPing && (speedKph || 0) < 1) {
      const elapsedMinutes =
        (capturedAt.getTime() -
          new Date(recentPing.capturedAt).getTime()) /
        60_000;
      const movedKm = distanceKm(
        recentPing.latitude,
        recentPing.longitude,
        latitude,
        longitude,
      );

      if (elapsedMinutes >= idleMinutes && movedKm < 0.05) {
        await createAlert({
          companyId: session.companyId,
          userId: session.id,
          deviceId: device.id,
          type: "LONG_IDLE_TIME",
          title: "Long idle time",
          message: `${session.name}'s device remained in the same area for at least ${idleMinutes} minutes.`,
          latitude,
          longitude,
          speedKph,
          dedupeKey: `LONG_IDLE:${session.id}:${tzDateKey(capturedAt)}:${capturedAt.getUTCHours()}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: autoVisit?.requiresManualDetails
        ? "Live GPS saved. Broker arrival was auto-detected; confirm service type and amounts."
        : autoVisit
          ? "Live GPS and broker service were updated automatically."
          : "Live GPS location saved.",
      location: {
        latitude,
        longitude,
        accuracy,
        speedKph,
        heading,
        capturedAt,
      },
      device,
      autoVisit,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        {
          success: false,
          message: "Please sign in.",
        },
        { status: 401 },
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Staff access is required.",
        },
        { status: 403 },
      );
    }

    if (message.startsWith("INVALID:")) {
      return NextResponse.json(
        {
          success: false,
          message: `${message.split(":")[1]} is invalid.`,
        },
        { status: 400 },
      );
    }

    console.error("[STAFF_GPS]", error);

    return NextResponse.json(
      {
        success: false,
        message: "The GPS location could not be saved.",
        details:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      { status: 500 },
    );
  }
}
