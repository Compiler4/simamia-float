import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { visibleBrokerCustomers } from "@/lib/staff/broker-scope";
import {
  requireCompanyMember,
  routeError,
  text,
  toNumber,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Db = Record<string, any>;

type VisitSource = {
  name: string;
  delegate: any;
  dateFields: string[];
  staffFields: string[];
  brokerFields: string[];
  mapper: (row: any) => any;
};

function clean(value: unknown): string {
  return text(value).trim();
}

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDayRange(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(new Date());

  return {
    start: new Date(`${date}T00:00:00+03:00`),
    end: new Date(`${date}T23:59:59.999+03:00`),
  };
}

function availableSources(db: Db): VisitSource[] {
  const sources: VisitSource[] = [];

  if (db.brokerServiceVisit) {
    sources.push({
      name: "brokerServiceVisit",
      delegate: db.brokerServiceVisit,
      dateFields: ["serviceProvidedAt", "startedAt", "createdAt"],
      staffFields: ["staffId", "userId", "createdById"],
      brokerFields: ["brokerCustomerId", "brokerId"],
      mapper: (row) => ({
        ...row,
        floatAmount: number(row.floatAmount),
        cashAmount: number(row.cashAmount),
        companyIncome: number(row.companyIncome),
      }),
    });
  }

  if (db.serviceVisit) {
    sources.push({
      name: "serviceVisit",
      delegate: db.serviceVisit,
      dateFields: ["serviceProvidedAt", "startedAt", "servedAt", "createdAt"],
      staffFields: ["staffId", "userId", "createdById"],
      brokerFields: ["brokerCustomerId", "brokerId"],
      mapper: (row) => ({
        ...row,
        floatAmount: number(row.floatAmount ?? row.amount),
        cashAmount: number(row.cashAmount),
        companyIncome: number(row.companyIncome),
      }),
    });
  }

  /*
   * Compatibility fallback:
   * older SIMAMIA schemas stored the same operational information as
   * serviceActivity rows rather than a dedicated brokerServiceVisit table.
   */
  if (db.serviceActivity) {
    sources.push({
      name: "serviceActivity",
      delegate: db.serviceActivity,
      dateFields: ["servedAt", "serviceProvidedAt", "createdAt"],
      staffFields: ["staffId", "userId", "createdById"],
      brokerFields: ["brokerCustomerId", "brokerId"],
      mapper: (row) => ({
        ...row,
        serviceProvidedAt:
          row.serviceProvidedAt ?? row.servedAt ?? row.createdAt ?? null,
        startedAt: row.startedAt ?? row.servedAt ?? row.createdAt ?? null,
        floatAmount: number(row.floatAmount ?? row.amount),
        cashAmount: number(row.cashAmount),
        companyIncome: number(row.companyIncome),
        communicationNote:
          row.communicationNote ?? row.notes ?? row.description ?? null,
        locationName: row.locationName ?? row.location ?? null,
        status: row.status ?? "SERVICE_RECORDED",
      }),
    });
  }

  return sources;
}

async function findManyFromSource(
  source: VisitSource,
  companyId: string,
  staffId: string,
  start: Date,
  end: Date,
): Promise<any[]> {
  let lastError: unknown = null;

  for (const staffField of source.staffFields) {
    for (const dateField of source.dateFields) {
      const where = {
        companyId,
        [staffField]: staffId,
        [dateField]: {
          gte: start,
          lte: end,
        },
      };

      try {
        const rows = await source.delegate.findMany({
          where,
          orderBy: {
            [dateField]: "desc",
          },
        });

        return safeArray(rows).map(source.mapper);
      } catch (error) {
        lastError = error;
      }
    }
  }

  /*
   * Some legacy service tables do not carry companyId on each row.
   * The current user is still constrained by staffId, so this is a
   * compatibility fallback only after all company-scoped queries fail.
   */
  for (const staffField of source.staffFields) {
    for (const dateField of source.dateFields) {
      try {
        const rows = await source.delegate.findMany({
          where: {
            [staffField]: staffId,
            [dateField]: {
              gte: start,
              lte: end,
            },
          },
          orderBy: {
            [dateField]: "desc",
          },
        });

        return safeArray(rows).map(source.mapper);
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) throw lastError;
  return [];
}

async function hydrateBrokers(db: Db, companyId: string, visits: any[]) {
  const ids = Array.from(
    new Set(
      visits
        .map((row) =>
          clean(
            row.brokerCustomerId ??
              row.brokerId ??
              row.brokerCustomer?.id ??
              row.broker?.id,
          ),
        )
        .filter(Boolean),
    ),
  );

  if (!ids.length || !db.brokerCustomer) {
    return visits;
  }

  try {
    const brokers = await db.brokerCustomer.findMany({
      where: {
        companyId,
        id: {
          in: ids,
        },
      },
    });

    const byId = new Map(
      safeArray<any>(brokers).map((broker) => [String(broker.id), broker]),
    );

    return visits.map((row) => {
      const id = clean(
        row.brokerCustomerId ??
          row.brokerId ??
          row.brokerCustomer?.id ??
          row.broker?.id,
      );

      const broker = byId.get(id) ?? row.brokerCustomer ?? row.broker ?? null;

      return {
        ...row,
        broker,
        brokerCustomer: broker,
      };
    });
  } catch {
    return visits;
  }
}

async function loadVisits(
  db: Db,
  companyId: string,
  staffId: string,
  start: Date,
  end: Date,
) {
  const errors: string[] = [];
  let firstSuccessfulSource = "";

  for (const source of availableSources(db)) {
    try {
      const visits = await findManyFromSource(
        source,
        companyId,
        staffId,
        start,
        end,
      );

      if (!firstSuccessfulSource) firstSuccessfulSource = source.name;

      // Do not stop on an empty newer table. Older SIMAMIA databases can have
      // brokerServiceVisit available while the real historical rows still live
      // in serviceActivity. Continue until a source actually contains records.
      if (!visits.length) continue;

      return {
        visits: await hydrateBrokers(db, companyId, visits),
        source: source.name,
      };
    } catch (error) {
      errors.push(
        `${source.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (errors.length) {
    console.warn("[STAFF_SERVICE_VISITS_COMPATIBILITY]", errors.join(" | "));
  }

  return {
    visits: [],
    source: firstSuccessfulSource || "empty-fallback",
  };
}

async function findOwnedRow(
  source: VisitSource,
  id: string,
  companyId: string,
  staffId: string,
) {
  const variations = [
    { id, companyId, staffId },
    { id, companyId, userId: staffId },
    { id, companyId, createdById: staffId },
    { id, staffId },
    { id, userId: staffId },
    { id, createdById: staffId },
  ];

  for (const where of variations) {
    try {
      const row = await source.delegate.findFirst({ where });
      if (row) return row;
    } catch {
      // Try the next schema variant.
    }
  }

  return null;
}

function updateCandidates(body: Record<string, any>) {
  const serviceType = clean(body.serviceType);
  const status = clean(body.status).toUpperCase();
  const locationName = clean(body.locationName);
  const notes = clean(body.notes);

  const floatAmount =
    body.floatAmount === undefined ? undefined : toNumber(body.floatAmount);

  const cashAmount =
    body.cashAmount === undefined ? undefined : toNumber(body.cashAmount);

  const companyIncome =
    body.companyIncome === undefined ? undefined : toNumber(body.companyIncome);

  for (const [name, value] of [
    ["Float amount", floatAmount],
    ["Cash amount", cashAmount],
    ["Company income", companyIncome],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new HttpError(`${name} cannot be negative.`, 422);
    }
  }

  const visitData: Record<string, any> = {};
  if (body.serviceType !== undefined) visitData.serviceType = serviceType;
  if (body.floatAmount !== undefined) visitData.floatAmount = floatAmount;
  if (body.cashAmount !== undefined) visitData.cashAmount = cashAmount;
  if (body.companyIncome !== undefined) visitData.companyIncome = companyIncome;
  if (body.locationName !== undefined)
    visitData.locationName = locationName || null;
  if (body.notes !== undefined)
    visitData.communicationNote = notes || null;
  if (body.status !== undefined) visitData.status = status;

  if (status === "COMPLETED") {
    visitData.completedAt = new Date();
  }

  const activityData: Record<string, any> = {};
  if (body.serviceType !== undefined) activityData.serviceType = serviceType;
  if (body.floatAmount !== undefined) {
    activityData.amount = floatAmount;
    activityData.floatAmount = floatAmount;
  }
  if (body.cashAmount !== undefined) activityData.cashAmount = cashAmount;
  if (body.companyIncome !== undefined)
    activityData.companyIncome = companyIncome;
  if (body.locationName !== undefined)
    activityData.locationName = locationName || null;
  if (body.notes !== undefined) {
    activityData.notes = notes || null;
    activityData.communicationNote = notes || null;
  }
  if (body.status !== undefined) activityData.status = status;

  return [visitData, activityData];
}

async function updateCompatible(
  source: VisitSource,
  id: string,
  body: Record<string, any>,
) {
  let lastError: unknown = null;

  for (const data of updateCandidates(body)) {
    /*
     * Try the full payload first, then progressively smaller common subsets.
     * Prisma throws a validation error for columns that do not exist, which is
     * caught here and followed by the next compatibility shape.
     */
    const variants = [
      data,
      {
        ...(data.serviceType !== undefined
          ? { serviceType: data.serviceType }
          : {}),
        ...(data.floatAmount !== undefined
          ? { floatAmount: data.floatAmount }
          : {}),
        ...(data.cashAmount !== undefined
          ? { cashAmount: data.cashAmount }
          : {}),
        ...(data.companyIncome !== undefined
          ? { companyIncome: data.companyIncome }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      {
        ...(data.serviceType !== undefined
          ? { serviceType: data.serviceType }
          : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    ];

    for (const variant of variants) {
      if (!Object.keys(variant).length) continue;

      try {
        return await source.delegate.update({
          where: { id },
          data: variant,
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) throw lastError;
  throw new HttpError("No service visit changes were supplied.", 422);
}


function coordinate(value: unknown, axis: "LAT" | "LNG"): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (axis === "LAT" && Math.abs(parsed) > 90) return null;
  if (axis === "LNG" && Math.abs(parsed) > 180) return null;
  return parsed;
}

function capturedDate(value: unknown): Date {
  const parsed = value ? new Date(String(value)) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function saveBrokerLocation(
  db: Db,
  input: {
    companyId: string;
    staffId: string;
    brokerCustomerId: string;
    latitude: number;
    longitude: number;
    capturedAt: Date;
    locationName: string;
  },
) {
  const existing = await db.brokerCustomer.findFirst({
    where: {
      id: input.brokerCustomerId,
      companyId: input.companyId,
      status: "ACTIVE",
    },
  });

  if (!existing) {
    throw new HttpError("The assigned broker was not found.", 404);
  }

  const variants = [
    {
      latitude: input.latitude,
      longitude: input.longitude,
      attendedBy: input.staffId,
      attendedDate: input.capturedAt,
      attendedLocation: input.locationName || existing.location || null,
    },
    {
      latitude: input.latitude,
      longitude: input.longitude,
      attendedDate: input.capturedAt,
      attendedLocation: input.locationName || existing.location || null,
    },
    {
      latitude: input.latitude,
      longitude: input.longitude,
    },
  ];

  let lastError: unknown = null;
  for (const data of variants) {
    try {
      return await db.brokerCustomer.update({
        where: { id: existing.id },
        data,
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return existing;
}

async function findTodayVisitForBroker(
  db: Db,
  companyId: string,
  staffId: string,
  brokerCustomerId: string,
  start: Date,
  end: Date,
) {
  for (const source of availableSources(db)) {
    try {
      const rows = await findManyFromSource(
        source,
        companyId,
        staffId,
        start,
        end,
      );
      const row = rows.find((item: any) =>
        String(
          item.brokerCustomerId ??
            item.brokerId ??
            item.brokerCustomer?.id ??
            item.broker?.id ??
            "",
        ) === brokerCustomerId,
      );
      if (row) return { source, row };
    } catch {
      // Try the next compatibility source.
    }
  }

  return null;
}

async function createBrokerServiceVisit(
  db: Db,
  input: {
    companyId: string;
    staffId: string;
    brokerCustomerId: string;
    serviceType: string;
    floatAmount: number;
    cashAmount: number;
    companyIncome: number;
    staffLatitude: number;
    staffLongitude: number;
    brokerLatitude: number;
    brokerLongitude: number;
    locationName: string;
    notes: string;
    capturedAt: Date;
  },
) {
  if (!db.brokerServiceVisit?.create) return null;

  const proofDueAt = new Date(input.capturedAt.getTime() + 30 * 60 * 1000);
  const variants: Record<string, any>[] = [
    {
      companyId: input.companyId,
      staffId: input.staffId,
      brokerCustomerId: input.brokerCustomerId,
      serviceType: input.serviceType,
      floatAmount: input.floatAmount,
      cashAmount: input.cashAmount,
      companyIncome: input.companyIncome,
      staffLatitude: input.staffLatitude,
      staffLongitude: input.staffLongitude,
      brokerLatitude: input.brokerLatitude,
      brokerLongitude: input.brokerLongitude,
      locationName: input.locationName || null,
      communicationNote: input.notes || null,
      status: "SERVICE_RECORDED",
      startedAt: input.capturedAt,
      arrivedAt: input.capturedAt,
      serviceProvidedAt: input.capturedAt,
      proofDueAt,
    },
    {
      companyId: input.companyId,
      staffId: input.staffId,
      brokerCustomerId: input.brokerCustomerId,
      serviceType: input.serviceType,
      floatAmount: input.floatAmount,
      cashAmount: input.cashAmount,
      staffLatitude: input.staffLatitude,
      staffLongitude: input.staffLongitude,
      locationName: input.locationName || null,
      status: "SERVICE_RECORDED",
      startedAt: input.capturedAt,
      serviceProvidedAt: input.capturedAt,
    },
    {
      companyId: input.companyId,
      staffId: input.staffId,
      brokerCustomerId: input.brokerCustomerId,
      serviceType: input.serviceType,
      floatAmount: input.floatAmount,
      cashAmount: input.cashAmount,
      status: "SERVICE_RECORDED",
      serviceProvidedAt: input.capturedAt,
    },
  ];

  let lastError: unknown = null;
  for (const data of variants) {
    try {
      return await db.brokerServiceVisit.create({
        data,
        include: { brokerCustomer: true },
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.warn("[STAFF_SERVICE_VISIT_CREATE_FALLBACK]", lastError);
  }
  return null;
}

async function createLegacyServiceActivity(
  db: Db,
  input: {
    companyId: string;
    staffId: string;
    brokerCustomerId: string;
    serviceType: string;
    floatAmount: number;
    staffLatitude: number;
    staffLongitude: number;
    locationName: string;
    notes: string;
    capturedAt: Date;
  },
) {
  if (!db.serviceActivity?.create) return null;

  return db.serviceActivity.create({
    data: {
      companyId: input.companyId,
      staffId: input.staffId,
      brokerId: null,
      brokerCustomerId: input.brokerCustomerId,
      customerId: null,
      serviceType: input.serviceType,
      amount: input.floatAmount,
      status: "COMPLETED",
      servedAt: input.capturedAt,
      latitude: input.staffLatitude,
      longitude: input.staffLongitude,
      locationName: input.locationName || null,
      notes: input.notes || null,
    },
    include: { brokerCustomer: true },
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyMember(["STAFF"]);
    const companyId = clean(user.companyId);
    const staffId = String(user.id);

    if (!companyId) {
      throw new HttpError(
        "Your Staff account is not connected to a company.",
        403,
      );
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      throw new HttpError("Service visit updates must use application/json.", 415);
    }

    const body = (await request.json()) as Record<string, any>;
    const action = clean(body.action).toUpperCase() || "UPDATE_VISIT";
    if (!["QUICK_VISIT_AND_SERVICE", "UPDATE_VISIT"].includes(action)) {
      throw new HttpError("Unsupported service visit action.", 422);
    }

    const brokerCustomerId = clean(body.brokerCustomerId ?? body.brokerId);
    if (!brokerCustomerId) {
      throw new HttpError("Choose an assigned broker.", 422);
    }

    const scope = await visibleBrokerCustomers(companyId, staffId);
    const assignedBroker = scope.brokers.find(
      (broker: any) => String(broker.id) === brokerCustomerId,
    );
    if (!assignedBroker) {
      throw new HttpError(
        "This broker is not assigned to the currently logged-in Staff Officer.",
        403,
      );
    }

    const staffLatitude = coordinate(body.staffLatitude ?? body.latitude, "LAT");
    const staffLongitude = coordinate(body.staffLongitude ?? body.longitude, "LNG");
    if (
      staffLatitude === null ||
      staffLongitude === null ||
      (staffLatitude === 0 && staffLongitude === 0)
    ) {
      throw new HttpError("Capture a real Staff GPS location before marking the broker serviced.", 422);
    }

    const brokerLatitude =
      coordinate(body.brokerLatitude, "LAT") ?? staffLatitude;
    const brokerLongitude =
      coordinate(body.brokerLongitude, "LNG") ?? staffLongitude;
    const capturedAt = capturedDate(body.capturedAt);
    const locationName =
      clean(body.locationName) ||
      clean((assignedBroker as any).location) ||
      clean((assignedBroker as any).assignedArea) ||
      "Broker location";
    const serviceType =
      action === "QUICK_VISIT_AND_SERVICE"
        ? "BROKER_VISIT_SERVICE"
        : clean(body.serviceType) || "FLOAT_AND_CASH_SERVICE";
    const notes = clean(body.notes);
    const floatAmount = Math.max(0, toNumber(body.floatAmount ?? 0));
    const cashAmount = Math.max(0, toNumber(body.cashAmount ?? 0));
    const companyIncome = Math.max(0, toNumber(body.companyIncome ?? 0));
    const db = prisma as any;
    const day = localDayRange(
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(capturedAt),
    );

    const broker = await saveBrokerLocation(db, {
      companyId,
      staffId,
      brokerCustomerId,
      latitude: brokerLatitude,
      longitude: brokerLongitude,
      capturedAt,
      locationName,
    });

    const existing = await findTodayVisitForBroker(
      db,
      companyId,
      staffId,
      brokerCustomerId,
      day.start,
      day.end,
    );

    let visit: any = null;
    let source = "";
    const warnings: string[] = [];

    if (existing) {
      const updateBody = {
        serviceType,
        floatAmount,
        cashAmount,
        companyIncome,
        status: "SERVICE_RECORDED",
        locationName,
        notes,
      };
      try {
        const updated = await updateCompatible(
          existing.source,
          String(existing.row.id),
          updateBody,
        );
        visit = existing.source.mapper(updated);
        source = existing.source.name;
      } catch (error) {
        warnings.push(
          `The existing ${existing.source.name} row could not accept every service field; a compatible service record was created instead.`,
        );
      }
    }

    if (!visit) {
      visit = await createBrokerServiceVisit(db, {
        companyId,
        staffId,
        brokerCustomerId,
        serviceType,
        floatAmount,
        cashAmount,
        companyIncome,
        staffLatitude,
        staffLongitude,
        brokerLatitude,
        brokerLongitude,
        locationName,
        notes,
        capturedAt,
      });
      if (visit) source = "brokerServiceVisit";
    }

    if (!visit) {
      const activity = await createLegacyServiceActivity(db, {
        companyId,
        staffId,
        brokerCustomerId,
        serviceType,
        floatAmount,
        staffLatitude,
        staffLongitude,
        locationName,
        notes,
        capturedAt,
      });

      if (!activity) {
        throw new HttpError(
          "No compatible service-visit table is available. Synchronize the service visit schema.",
          500,
        );
      }

      visit = {
        ...activity,
        brokerCustomerId,
        serviceProvidedAt: activity.servedAt ?? capturedAt,
        startedAt: activity.servedAt ?? capturedAt,
        arrivedAt: activity.servedAt ?? capturedAt,
        floatAmount: activity.floatAmount ?? activity.amount ?? floatAmount,
        cashAmount: activity.cashAmount ?? cashAmount,
        companyIncome: activity.companyIncome ?? companyIncome,
        communicationNote: activity.communicationNote ?? activity.notes ?? notes,
        locationName: activity.locationName ?? locationName,
        status: activity.status ?? "SERVICE_RECORDED",
        brokerCustomer: activity.brokerCustomer ?? broker,
        broker: activity.brokerCustomer ?? broker,
      };
      source = "serviceActivity";
      warnings.push(
        "Service visit saved using the compatible serviceActivity dataset.",
      );
    }

    return NextResponse.json({
      success: true,
      message:
        action === "QUICK_VISIT_AND_SERVICE"
          ? `${clean((broker as any).name) || "Broker"} is now marked visited and serviced at the captured GPS position.`
          : "Broker location and service details updated successfully.",
      visit: {
        ...visit,
        brokerCustomerId,
        brokerCustomer: visit.brokerCustomer ?? broker,
        broker: visit.broker ?? visit.brokerCustomer ?? broker,
      },
      broker,
      source,
      warnings,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCompanyMember(["STAFF"]);
    const companyId = clean(user.companyId);

    if (!companyId) {
      throw new HttpError(
        "Your Staff account is not connected to a company.",
        403,
      );
    }

    const requestedDate = clean(request.nextUrl.searchParams.get("date"));
    const range = localDayRange(requestedDate);
    const db = prisma as any;

    const result = await loadVisits(
      db,
      companyId,
      String(user.id),
      range.start,
      range.end,
    );

    return NextResponse.json(
      {
        success: true,
        visits: result.visits,
        source: result.source,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCompanyMember(["STAFF"]);
    const companyId = clean(user.companyId);

    if (!companyId) {
      throw new HttpError(
        "Your Staff account is not connected to a company.",
        403,
      );
    }

    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.includes("application/json")) {
      throw new HttpError(
        "Service visit updates must use application/json.",
        415,
      );
    }

    const body = (await request.json()) as Record<string, any>;
    const visitId = clean(body.visitId);

    if (!visitId) {
      throw new HttpError("Service visit ID is required.", 422);
    }

    const db = prisma as any;
    let lastError: unknown = null;

    for (const source of availableSources(db)) {
      try {
        const existing = await findOwnedRow(
          source,
          visitId,
          companyId,
          String(user.id),
        );

        if (!existing) continue;

        const updated = await updateCompatible(source, visitId, body);

        return NextResponse.json({
          success: true,
          message: "Service visit updated successfully.",
          visit: source.mapper(updated),
          source: source.name,
        });
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      console.error("[STAFF_SERVICE_VISIT_PATCH_COMPATIBILITY]", lastError);
    }

    throw new HttpError(
      "Service visit was not found in the current Staff account.",
      404,
    );
  } catch (error) {
    return routeError(error);
  }
}
