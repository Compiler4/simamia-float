import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { requireVisibleBrokerCustomer } from "@/lib/staff/broker-scope";
import { darDayBounds, distanceMetres } from "@/lib/staff/geo";
import {
  usableAccuracy,
  usableCoordinatePair,
} from "@/lib/staff/location-quality";
import {
  createNotice,
  createRoleNotices,
} from "@/lib/staff/notify-live";

export type ServiceVisitInput = {
  companyId: string;
  staffId: string;
  staffName: string;
  brokerCustomerId: string;
  deviceId?: string | null;
  serviceType?: string;
  floatAmount?: number;
  cashAmount?: number;
  companyIncome?: number;
  staffLatitude: number;
  staffLongitude: number;
  accuracy?: number | null;
  capturedAt?: Date;
  locationName?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  updateRegisteredLocation?: boolean;
  markServiced?: boolean;
};

export type EditServiceVisitInput = {
  companyId: string;
  staffId: string;
  staffName: string;
  visitId: string;
  serviceType: string;
  floatAmount?: number;
  cashAmount?: number;
  companyIncome?: number;
  status?: string;
  locationName?: string | null;
  notes?: string | null;
};

type RawRow = Record<string, any>;

const VISIT_TABLE = "broker_service_visits";
const BROKER_TABLE = "broker_customers";
const ACTIVITY_TABLE = "service_activities";

const tableColumnCache = new Map<string, Set<string>>();

function nonNegative(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("INVALID_AMOUNT");
  }
  return parsed;
}

function positiveSetting(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function safeIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error("UNSAFE_SQL_IDENTIFIER");
  }
  return `\`${value}\``;
}

function columnName(row: RawRow): string {
  return String(
    row.columnName ??
      row.COLUMN_NAME ??
      row.column_name ??
      "",
  );
}

async function tableColumns(
  tableName: string,
  refresh = false,
): Promise<Set<string>> {
  const cached = tableColumnCache.get(tableName);
  if (!refresh && cached) {
    return new Set(cached);
  }

  const database = db as any;
  const rows = await database.$queryRawUnsafe(
    `SELECT COLUMN_NAME AS columnName
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    tableName,
  );

  const result = new Set(
    (Array.isArray(rows) ? rows : [])
      .map(columnName)
      .filter(Boolean),
  );

  tableColumnCache.set(tableName, result);
  return new Set(result);
}

function requireColumns(
  tableName: string,
  columns: Set<string>,
  required: string[],
) {
  if (!columns.size) {
    throw new Error(
      tableName === VISIT_TABLE
        ? "SERVICE_VISIT_TABLE_MISSING"
        : `TABLE_MISSING:${tableName}`,
    );
  }

  const missing = required.filter(
    (column) => !columns.has(column),
  );

  if (missing.length) {
    throw new Error(
      `SERVICE_VISIT_REQUIRED_COLUMNS_MISSING:${missing.join(",")}`,
    );
  }
}

function onlyExistingColumns(
  columns: Set<string>,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) => columns.has(key) && value !== undefined,
    ),
  );
}

async function insertRaw(
  tableName: string,
  data: Record<string, unknown>,
) {
  const entries = Object.entries(data);
  if (!entries.length) {
    throw new Error(`NO_INSERTABLE_COLUMNS:${tableName}`);
  }

  const columns = entries.map(([key]) => safeIdentifier(key));
  const placeholders = entries.map(() => "?");
  const values = entries.map(([, value]) => value);

  await (db as any).$executeRawUnsafe(
    `INSERT INTO ${safeIdentifier(tableName)}
      (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})`,
    ...values,
  );
}

async function updateRaw(
  tableName: string,
  id: string,
  data: Record<string, unknown>,
) {
  const entries = Object.entries(data).filter(
    ([key]) => key !== "id",
  );
  if (!entries.length) return;

  const assignments = entries.map(
    ([key]) => `${safeIdentifier(key)} = ?`,
  );
  const values = entries.map(([, value]) => value);

  await (db as any).$executeRawUnsafe(
    `UPDATE ${safeIdentifier(tableName)}
        SET ${assignments.join(", ")}
      WHERE \`id\` = ?`,
    ...values,
    id,
  );
}

async function selectOneById(
  tableName: string,
  id: string,
): Promise<RawRow | null> {
  const rows = await (db as any).$queryRawUnsafe(
    `SELECT *
       FROM ${safeIdentifier(tableName)}
      WHERE \`id\` = ?
      LIMIT 1`,
    id,
  );

  return Array.isArray(rows) && rows.length
    ? rows[0]
    : null;
}

async function findTodayVisit(input: {
  companyId: string;
  staffId: string;
  brokerCustomerId: string;
  start: Date;
  end: Date;
  columns: Set<string>;
}): Promise<RawRow | null> {
  const statusClause = input.columns.has("status")
    ? " AND (`status` IS NULL OR `status` <> ?)"
    : "";

  const params: unknown[] = [
    input.companyId,
    input.staffId,
    input.brokerCustomerId,
    input.start,
    input.end,
  ];

  if (statusClause) params.push("CANCELLED");

  const rows = await (db as any).$queryRawUnsafe(
    `SELECT *
       FROM ${safeIdentifier(VISIT_TABLE)}
      WHERE \`companyId\` = ?
        AND \`staffId\` = ?
        AND \`brokerCustomerId\` = ?
        AND \`startedAt\` >= ?
        AND \`startedAt\` <= ?
        ${statusClause}
      ORDER BY \`startedAt\` DESC
      LIMIT 1`,
    ...params,
  );

  return Array.isArray(rows) && rows.length
    ? rows[0]
    : null;
}

function buildActivityNotes(input: {
  notes?: string | null;
  proofUrl?: string | null;
  fallback: string;
}) {
  return [
    input.notes?.trim(),
    input.proofUrl?.trim()
      ? `Proof: ${input.proofUrl.trim()}`
      : "",
    input.fallback,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 65000);
}

async function saveBrokerMaster(input: {
  brokerId: string;
  latitude: number;
  longitude: number;
  staffName: string;
  capturedAt: Date;
  locationName: string | null;
  shouldUpdateCoordinates: boolean;
}): Promise<{ broker: RawRow | null; warnings: string[] }> {
  const warnings: string[] = [];
  const columns = await tableColumns(BROKER_TABLE);

  if (!columns.size) {
    warnings.push(
      "The visit was saved, but the broker master table was not found.",
    );
    return { broker: null, warnings };
  }

  const update = onlyExistingColumns(columns, {
    ...(input.shouldUpdateCoordinates
      ? {
          latitude: input.latitude,
          longitude: input.longitude,
        }
      : {}),
    attendedBy: input.staffName,
    attendedDate: input.capturedAt,
    attendedLocation: input.locationName,
    updatedAt: input.capturedAt,
  });

  try {
    await updateRaw(BROKER_TABLE, input.brokerId, update);
  } catch (error) {
    console.error("[BROKER_MASTER_UPDATE_FAILED]", error);
    warnings.push(
      "The visit was saved, but the broker master location could not be updated.",
    );
  }

  return {
    broker: await selectOneById(BROKER_TABLE, input.brokerId),
    warnings,
  };
}

async function syncServiceActivity(input: {
  visit: RawRow;
  companyId: string;
  staffId: string;
  brokerCustomerId: string;
  serviceType: string;
  amount: number;
  status: string;
  servedAt: Date;
  latitude: number;
  longitude: number;
  locationName: string;
  notes: string;
}): Promise<{
  visit: RawRow;
  activity: RawRow | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const activityColumns = await tableColumns(ACTIVITY_TABLE);

  if (!activityColumns.size) {
    warnings.push(
      "The broker visit was saved, but the service_activities table is unavailable.",
    );
    return { visit: input.visit, activity: null, warnings };
  }

  const now = new Date();
  let activityId = input.visit.serviceActivityId
    ? String(input.visit.serviceActivityId)
    : "";
  let activity = activityId
    ? await selectOneById(ACTIVITY_TABLE, activityId)
    : null;

  const baseData = onlyExistingColumns(activityColumns, {
    companyId: input.companyId,
    staffId: input.staffId,
    brokerId: null,
    brokerCustomerId: input.brokerCustomerId,
    customerId: null,
    serviceType: input.serviceType,
    amount: input.amount,
    status: input.status,
    servedAt: input.servedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    locationName: input.locationName,
    notes: input.notes,
    updatedAt: now,
  });

  try {
    if (activity) {
      await updateRaw(ACTIVITY_TABLE, activityId, baseData);
    } else {
      activityId = randomUUID();
      const createData = onlyExistingColumns(activityColumns, {
        id: activityId,
        ...baseData,
        createdAt: now,
        updatedAt: now,
      });

      const required = [
        "id",
        "companyId",
        "staffId",
        "serviceType",
        "servedAt",
      ];
      const missing = required.filter(
        (column) =>
          activityColumns.has(column) &&
          createData[column] === undefined,
      );

      if (missing.length) {
        throw new Error(
          `SERVICE_ACTIVITY_REQUIRED_VALUES_MISSING:${missing.join(",")}`,
        );
      }

      await insertRaw(ACTIVITY_TABLE, createData);
    }

    activity = await selectOneById(ACTIVITY_TABLE, activityId);

    const visitColumns = await tableColumns(VISIT_TABLE);
    if (visitColumns.has("serviceActivityId")) {
      await updateRaw(VISIT_TABLE, String(input.visit.id), {
        serviceActivityId: activityId,
        ...(visitColumns.has("updatedAt")
          ? { updatedAt: now }
          : {}),
      });
    }

    return {
      visit:
        (await selectOneById(VISIT_TABLE, String(input.visit.id))) ??
        input.visit,
      activity,
      warnings,
    };
  } catch (error) {
    console.error("[SERVICE_ACTIVITY_COMPAT_SYNC_FAILED]", error);
    warnings.push(
      "The broker visit was saved, but the linked service activity could not be synchronized.",
    );
    return { visit: input.visit, activity: null, warnings };
  }
}

export async function getServiceVisitDiagnostics() {
  const [visitColumns, brokerColumns, activityColumns] =
    await Promise.all([
      tableColumns(VISIT_TABLE, true),
      tableColumns(BROKER_TABLE, true),
      tableColumns(ACTIVITY_TABLE, true),
    ]);

  const requiredVisitColumns = [
    "id",
    "companyId",
    "staffId",
    "brokerCustomerId",
    "startedAt",
  ];

  return {
    visitTable: visitColumns.size > 0,
    brokerTable: brokerColumns.size > 0,
    activityTable: activityColumns.size > 0,
    visitColumns: Array.from(visitColumns).sort(),
    brokerColumns: Array.from(brokerColumns).sort(),
    activityColumns: Array.from(activityColumns).sort(),
    missingRequiredVisitColumns: requiredVisitColumns.filter(
      (column) => !visitColumns.has(column),
    ),
    prismaDelegateAvailable:
      Boolean((db as any).brokerServiceVisit) &&
      typeof (db as any).brokerServiceVisit.findFirst === "function",
  };
}

export async function recordBrokerServiceVisit(
  input: ServiceVisitInput,
) {
  if (
    !usableCoordinatePair(
      input.staffLatitude,
      input.staffLongitude,
    )
  ) {
    throw new Error("INVALID_GPS_COORDINATE");
  }

  const quickService = Boolean(input.markServiced);
  const accuracy = usableAccuracy(input.accuracy);
  const maximumAccuracy = positiveSetting(
    process.env.BROKER_GPS_MAX_ACCURACY_METERS,
    250,
  );

  if (
    !quickService &&
    accuracy != null &&
    accuracy > maximumAccuracy
  ) {
    throw new Error("GPS_ACCURACY_TOO_LOW");
  }

  const broker = await requireVisibleBrokerCustomer(
    input.companyId,
    input.staffId,
    input.brokerCustomerId,
  );

  const capturedAt = input.capturedAt ?? new Date();
  const bounds = darDayBounds(capturedAt);
  const floatAmount = nonNegative(input.floatAmount);
  const cashAmount = nonNegative(input.cashAmount);
  const companyIncome = nonNegative(input.companyIncome);
  const serviceType =
    String(
      input.serviceType ||
        (quickService
          ? "BROKER_VISIT_SERVICE"
          : "GPS_VISIT_UPDATE"),
    )
      .trim()
      .slice(0, 120) || "BROKER_VISIT_SERVICE";

  const hasRegisteredCoordinates = usableCoordinatePair(
    broker.latitude,
    broker.longitude,
  );

  const existingDistance = hasRegisteredCoordinates
    ? distanceMetres(
        input.staffLatitude,
        input.staffLongitude,
        Number(broker.latitude),
        Number(broker.longitude),
      )
    : null;

  const allowedDistance = broker.attendedDate
    ? positiveSetting(
        process.env.BROKER_SERVICE_RADIUS_METERS,
        750,
      )
    : positiveSetting(
        process.env.BROKER_ADDRESS_RADIUS_METERS,
        15_000,
      );

  if (
    !quickService &&
    hasRegisteredCoordinates &&
    existingDistance != null &&
    existingDistance > allowedDistance
  ) {
    throw new Error("BROKER_TOO_FAR");
  }

  const shouldUpdateRegisteredLocation =
    Boolean(input.updateRegisteredLocation) ||
    quickService ||
    !hasRegisteredCoordinates;

  const brokerLatitude = shouldUpdateRegisteredLocation
    ? input.staffLatitude
    : Number(broker.latitude);
  const brokerLongitude = shouldUpdateRegisteredLocation
    ? input.staffLongitude
    : Number(broker.longitude);
  const distance = distanceMetres(
    input.staffLatitude,
    input.staffLongitude,
    brokerLatitude,
    brokerLongitude,
  );

  const hasFinancialDetails =
    floatAmount > 0 ||
    cashAmount > 0 ||
    companyIncome > 0;
  const hasServiceDetails =
    quickService ||
    hasFinancialDetails ||
    serviceType !== "GPS_VISIT_UPDATE";
  const status = quickService
    ? "COMPLETED"
    : hasServiceDetails
      ? "SERVICE_RECORDED"
      : "ARRIVED";

  const visitColumns = await tableColumns(VISIT_TABLE, true);
  requireColumns(VISIT_TABLE, visitColumns, [
    "id",
    "companyId",
    "staffId",
    "brokerCustomerId",
    "startedAt",
  ]);

  const existing = await findTodayVisit({
    companyId: input.companyId,
    staffId: input.staffId,
    brokerCustomerId: input.brokerCustomerId,
    start: bounds.start,
    end: bounds.end,
    columns: visitColumns,
  });

  const communicationNote = [
    quickService
      ? "Staff reached the broker and clicked Update now. Broker marked visited and serviced."
      : hasServiceDetails
        ? "Service and location updated by the Staff Officer."
        : "Staff GPS arrival recorded; financial details are pending.",
    accuracy == null
      ? ""
      : `GPS accuracy: ${Math.round(accuracy)} metres`,
    input.locationName
      ? `Location: ${input.locationName}`
      : "",
    input.proofUrl ? `Proof: ${input.proofUrl}` : "",
    input.notes ? `Notes: ${input.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 65000);

  const visitId = existing?.id
    ? String(existing.id)
    : randomUUID();
  const now = new Date();
  const proofDueAt =
    existing?.proofDueAt ??
    new Date(capturedAt.getTime() + 60 * 60 * 1000);
  const proofUploadedAt =
    input.proofUrl
      ? capturedAt
      : existing?.proofUploadedAt ?? null;

  const visitData = onlyExistingColumns(visitColumns, {
    id: visitId,
    companyId: input.companyId,
    staffId: input.staffId,
    brokerCustomerId: input.brokerCustomerId,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    serviceDay: bounds.start,
    status,
    serviceType,
    communicationNote,
    floatAmount,
    cashAmount,
    companyIncome,
    staffLatitude: input.staffLatitude,
    staffLongitude: input.staffLongitude,
    brokerLatitude,
    brokerLongitude,
    distanceMeters: distance,
    locationMatched: true,
    startedAt: existing?.startedAt ?? capturedAt,
    arrivedAt: existing?.arrivedAt ?? capturedAt,
    serviceProvidedAt: hasServiceDetails
      ? capturedAt
      : existing?.serviceProvidedAt ?? null,
    proofDueAt,
    proofUploadedAt,
    proofUrl: input.proofUrl || existing?.proofUrl || null,
    notes: input.notes || existing?.notes || null,
    completedAt:
      quickService || status === "COMPLETED"
        ? capturedAt
        : existing?.completedAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  try {
    if (existing) {
      await updateRaw(VISIT_TABLE, visitId, visitData);
    } else {
      await insertRaw(VISIT_TABLE, visitData);
    }
  } catch (firstError) {
    /*
     * Some old databases have a narrower visit status enum. Preserve the
     * visit instead of returning a generic error, then expose a warning.
     */
    if (status === "COMPLETED" && visitColumns.has("status")) {
      const fallbackData = {
        ...visitData,
        status: "SERVICE_RECORDED",
      };

      try {
        if (existing) {
          await updateRaw(VISIT_TABLE, visitId, fallbackData);
        } else {
          await insertRaw(VISIT_TABLE, fallbackData);
        }
      } catch {
        throw firstError;
      }
    } else {
      throw firstError;
    }
  }

  let savedVisit = await selectOneById(VISIT_TABLE, visitId);
  if (!savedVisit) {
    throw new Error("SERVICE_VISIT_SAVE_NOT_CONFIRMED");
  }

  const locationName =
    input.locationName ||
    broker.address ||
    broker.ward ||
    broker.district ||
    broker.region ||
    broker.location ||
    broker.assignedArea ||
    "Broker location";

  const brokerResult = await saveBrokerMaster({
    brokerId: input.brokerCustomerId,
    latitude: input.staffLatitude,
    longitude: input.staffLongitude,
    staffName: input.staffName,
    capturedAt,
    locationName,
    shouldUpdateCoordinates: shouldUpdateRegisteredLocation,
  });

  const activityResult = await syncServiceActivity({
    visit: savedVisit,
    companyId: input.companyId,
    staffId: input.staffId,
    brokerCustomerId: input.brokerCustomerId,
    serviceType,
    amount: floatAmount + cashAmount + companyIncome,
    status: hasServiceDetails ? "COMPLETED" : "ARRIVED",
    servedAt: capturedAt,
    latitude: input.staffLatitude,
    longitude: input.staffLongitude,
    locationName,
    notes: buildActivityNotes({
      notes: input.notes,
      proofUrl: input.proofUrl,
      fallback: quickService
        ? `Visited and marked serviced from Live Locations. GPS accuracy: ${accuracy == null ? "unknown" : `${Math.round(accuracy)}m`}.`
        : "Recorded from Staff service visits.",
    }),
  });

  savedVisit = activityResult.visit;
  const warnings = [
    ...brokerResult.warnings,
    ...activityResult.warnings,
  ];

  const message = quickService
    ? `${input.staffName} reached ${broker.name}; the broker was marked visited and serviced at the captured GPS position.`
    : `${input.staffName} updated ${broker.name}: ${serviceType.replaceAll("_", " ")}, float TZS ${floatAmount.toLocaleString("en-GB")}, cash TZS ${cashAmount.toLocaleString("en-GB")}.`;

  await Promise.allSettled([
    createNotice({
      companyId: input.companyId,
      userId: input.staffId,
      title: quickService
        ? "Broker visited and serviced"
        : "Broker service updated",
      message,
      type: "SUCCESS",
    }),
    createRoleNotices({
      companyId: input.companyId,
      roles: [
        "COMPANY_ADMIN",
        "ACCOUNTANT",
        "GPS_MANAGER",
      ],
      title: quickService
        ? "Broker visit completed"
        : "Broker service visit updated",
      message,
      type: "INFO",
      excludeUserId: input.staffId,
    }),
  ]);

  return {
    visit: {
      ...savedVisit,
      brokerCustomer: brokerResult.broker ?? broker,
      broker: brokerResult.broker ?? broker,
      serviceActivity: activityResult.activity,
      locationName,
    },
    broker: brokerResult.broker ?? broker,
    warnings,
  };
}


export async function loadBrokerServiceVisits(input: {
  companyId: string;
  staffId: string;
  start: Date;
  end: Date;
}) {
  const visitColumns = await tableColumns(VISIT_TABLE, true);
  requireColumns(VISIT_TABLE, visitColumns, [
    "id",
    "companyId",
    "staffId",
    "brokerCustomerId",
    "startedAt",
  ]);

  const rows = await (db as any).$queryRawUnsafe(
    `SELECT *
       FROM ${safeIdentifier(VISIT_TABLE)}
      WHERE \`companyId\` = ?
        AND \`staffId\` = ?
        AND \`startedAt\` >= ?
        AND \`startedAt\` <= ?
      ORDER BY ${visitColumns.has("updatedAt") ? "\`updatedAt\`" : "\`startedAt\`"} DESC`,
    input.companyId,
    input.staffId,
    input.start,
    input.end,
  );

  const visits = Array.isArray(rows) ? rows : [];
  const brokerIds = Array.from(
    new Set(
      visits
        .map((row) => String(row.brokerCustomerId || ""))
        .filter(Boolean),
    ),
  );
  const activityIds = Array.from(
    new Set(
      visits
        .map((row) => String(row.serviceActivityId || ""))
        .filter(Boolean),
    ),
  );

  const brokerById = new Map<string, RawRow>();
  const brokerColumns = await tableColumns(BROKER_TABLE);
  if (brokerIds.length && brokerColumns.size) {
    const placeholders = brokerIds.map(() => "?").join(", ");
    const brokers = await (db as any).$queryRawUnsafe(
      `SELECT *
         FROM ${safeIdentifier(BROKER_TABLE)}
        WHERE \`id\` IN (${placeholders})`,
      ...brokerIds,
    );
    for (const broker of Array.isArray(brokers) ? brokers : []) {
      brokerById.set(String(broker.id), broker);
    }
  }

  const activityById = new Map<string, RawRow>();
  const activityColumns = await tableColumns(ACTIVITY_TABLE);
  if (activityIds.length && activityColumns.size) {
    const placeholders = activityIds.map(() => "?").join(", ");
    const activities = await (db as any).$queryRawUnsafe(
      `SELECT *
         FROM ${safeIdentifier(ACTIVITY_TABLE)}
        WHERE \`id\` IN (${placeholders})`,
      ...activityIds,
    );
    for (const activity of Array.isArray(activities) ? activities : []) {
      activityById.set(String(activity.id), activity);
    }
  }

  return visits.map((visit) => {
    const broker = brokerById.get(String(visit.brokerCustomerId)) ?? null;
    const activity = visit.serviceActivityId
      ? activityById.get(String(visit.serviceActivityId)) ?? null
      : null;

    return {
      ...visit,
      broker,
      brokerCustomer: broker,
      serviceActivity: activity,
      locationName:
        activity?.locationName ||
        broker?.attendedLocation ||
        broker?.address ||
        broker?.location ||
        null,
    };
  });
}

export async function editBrokerServiceVisit(
  input: EditServiceVisitInput,
) {
  const visitColumns = await tableColumns(VISIT_TABLE, true);
  requireColumns(VISIT_TABLE, visitColumns, [
    "id",
    "companyId",
    "staffId",
    "brokerCustomerId",
    "startedAt",
  ]);

  const existing = await selectOneById(
    VISIT_TABLE,
    input.visitId,
  );

  if (
    !existing ||
    String(existing.companyId) !== input.companyId ||
    String(existing.staffId) !== input.staffId ||
    String(existing.status || "") === "CANCELLED"
  ) {
    throw new Error("VISIT_NOT_FOUND");
  }

  const floatAmount = nonNegative(input.floatAmount);
  const cashAmount = nonNegative(input.cashAmount);
  const companyIncome = nonNegative(input.companyIncome);
  const serviceType = String(
    input.serviceType || "BROKER_VISIT_SERVICE",
  )
    .trim()
    .slice(0, 120);
  const allowedStatuses = new Set([
    "ARRIVED",
    "SERVICE_RECORDED",
    "COMPLETED",
    "PROOF_PENDING",
    "LATE_PROOF",
  ]);
  const requestedStatus = String(
    input.status || "SERVICE_RECORDED",
  ).toUpperCase();
  const status = allowedStatuses.has(requestedStatus)
    ? requestedStatus
    : "SERVICE_RECORDED";
  const now = new Date();

  const communicationNote = [
    existing.communicationNote,
    input.notes
      ? `Edited by ${input.staffName}: ${input.notes}`
      : `Edited by ${input.staffName}.`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 65000);

  const update = onlyExistingColumns(visitColumns, {
    serviceType,
    floatAmount,
    cashAmount,
    companyIncome,
    status,
    communicationNote,
    serviceProvidedAt:
      status === "ARRIVED"
        ? existing.serviceProvidedAt ?? null
        : existing.serviceProvidedAt ?? now,
    completedAt:
      status === "COMPLETED"
        ? existing.completedAt ?? now
        : existing.completedAt ?? null,
    updatedAt: now,
  });

  await updateRaw(VISIT_TABLE, input.visitId, update);
  let savedVisit =
    (await selectOneById(VISIT_TABLE, input.visitId)) ??
    existing;

  const activityResult = await syncServiceActivity({
    visit: savedVisit,
    companyId: input.companyId,
    staffId: input.staffId,
    brokerCustomerId: String(existing.brokerCustomerId),
    serviceType,
    amount: floatAmount + cashAmount + companyIncome,
    status: status === "ARRIVED" ? "ARRIVED" : "COMPLETED",
    servedAt:
      status === "ARRIVED"
        ? new Date(existing.arrivedAt || existing.startedAt)
        : new Date(existing.serviceProvidedAt || now),
    latitude: Number(existing.staffLatitude ?? 0),
    longitude: Number(existing.staffLongitude ?? 0),
    locationName:
      input.locationName || "Broker location",
    notes: buildActivityNotes({
      notes: input.notes,
      fallback: `Service visit edited by ${input.staffName} on ${now.toISOString()}.`,
    }),
  });

  savedVisit = activityResult.visit;
  const broker = await selectOneById(
    BROKER_TABLE,
    String(existing.brokerCustomerId),
  );

  return {
    ...savedVisit,
    broker,
    brokerCustomer: broker,
    serviceActivity: activityResult.activity,
    locationName:
      input.locationName ||
      activityResult.activity?.locationName ||
      broker?.attendedLocation ||
      broker?.location ||
      null,
    warnings: activityResult.warnings,
  };
}
