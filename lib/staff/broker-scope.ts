import { db } from "@/lib/db";
import { usableCoordinatePair } from "@/lib/staff/location-quality";

export type BrokerDirectoryRow = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  businessName: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  location: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  attendedBy: string | null;
  attendedDate: Date | null;
  attendedLocation: string | null;
  isImported: boolean;
  sourceAliasCode: string | null;
  sourceMsisdn: string | null;
  status: string;
  updatedAt: Date;

  /**
   * Compatibility metadata. These values are derived from columns that already
   * exist in the user's BrokerCustomer model. They deliberately do not require
   * locationSource or locationVerifiedAt Prisma fields.
   */
  locationSource?: string;
  locationVerifiedAt?: Date | null;

  directlyAssigned?: boolean;
  assignedByArea?: boolean;
  canOperate?: boolean;
  assignmentId?: string | null;
  workAreaId?: string | null;
  assignedArea?: string | null;
};

type WorkAreaRow = {
  id: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  street: string | null;
};

type AssignmentRow = {
  id: string;
  brokerCustomerId: string;
  workAreaId: string | null;
  assignedArea: string | null;
};

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalised(value: unknown): string {
  return text(value)
    .toLocaleLowerCase("en")
    .replace(/[.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function values(items: unknown[]): string[] {
  return items.map(normalised).filter(Boolean);
}

function matches(items: string[], target: unknown): boolean {
  const needle = normalised(target);
  if (!needle) return true;

  return items.some(
    (item) =>
      item === needle ||
      item.includes(needle) ||
      needle.includes(item),
  );
}


function brokerMatchesArea(
  broker: BrokerDirectoryRow,
  area: WorkAreaRow,
): boolean {
  return (
    matches(
      values([broker.region, broker.city, broker.location]),
      area.region,
    ) &&
    matches(
      values([
        broker.district,
        broker.location,
        broker.address,
      ]),
      area.district,
    ) &&
    matches(
      values([
        broker.ward,
        broker.location,
        broker.address,
        broker.attendedLocation,
      ]),
      area.ward,
    ) &&
    matches(
      values([
        broker.ward,
        broker.location,
        broker.address,
        broker.attendedLocation,
      ]),
      area.street,
    )
  );
}

function withLocationMetadata(
  broker: BrokerDirectoryRow,
): BrokerDirectoryRow {
  const mapped = usableCoordinatePair(
    broker.latitude,
    broker.longitude,
  );

  return {
    ...broker,
    locationSource: !mapped
      ? "UNMAPPED"
      : broker.attendedDate
        ? "STAFF_GPS_VERIFIED"
        : broker.isImported
          ? "DATABASE_ADDRESS_APPROXIMATE"
          : "DATABASE_COORDINATE",
    locationVerifiedAt:
      broker.attendedDate ?? broker.updatedAt ?? null,
  };
}

export async function visibleBrokerCustomers(
  companyId: string,
  staffId: string,
): Promise<{
  areas: WorkAreaRow[];
  assignments: AssignmentRow[];
  brokers: BrokerDirectoryRow[];
}> {
  const database = db as any;

  const [areasRaw, assignmentsRaw, brokersRaw] =
    await Promise.all([
      database.staffWorkArea.findMany({
        where: {
          companyId,
          staffId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          region: true,
          district: true,
          ward: true,
          street: true,
        },
        orderBy: {
          startedAt: "asc",
        },
      }),
      database.staffBrokerCustomerAssignment.findMany({
        where: {
          companyId,
          staffId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          brokerCustomerId: true,
          workAreaId: true,
          assignedArea: true,
        },
      }),
      database.brokerCustomer.findMany({
        where: {
          companyId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          companyId: true,
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
          latitude: true,
          longitude: true,
          attendedBy: true,
          attendedDate: true,
          attendedLocation: true,
          isImported: true,
          sourceAliasCode: true,
          sourceMsisdn: true,
          status: true,
          updatedAt: true,
        },
        orderBy: [
          { region: "asc" },
          { district: "asc" },
          { name: "asc" },
        ],
      }),
    ]);

  const areas = areasRaw as WorkAreaRow[];
  const assignments = assignmentsRaw as AssignmentRow[];
  const brokers = (brokersRaw as BrokerDirectoryRow[]).map(
    withLocationMetadata,
  );

  const assignmentByBroker = new Map<
    string,
    AssignmentRow
  >(
    assignments.map(
      (assignment): [string, AssignmentRow] => [
        text(assignment.brokerCustomerId),
        assignment,
      ],
    ),
  );

  const visible = brokers
    .filter((broker) => {
      const directlyAssigned = assignmentByBroker.has(
        text(broker.id),
      );
      const inAssignedArea = areas.some((area) =>
        brokerMatchesArea(broker, area),
      );

      return directlyAssigned || inAssignedArea;
    })
    .map((broker): BrokerDirectoryRow => {
      const assignment = assignmentByBroker.get(
        text(broker.id),
      );
      const matchingArea = areas.find((area) =>
        brokerMatchesArea(broker, area),
      );

      const matchedAreaLabel = [
        matchingArea?.street,
        matchingArea?.ward,
        matchingArea?.district,
        matchingArea?.region,
      ]
        .filter((value): value is string => Boolean(value))
        .join(", ");

      return {
        ...broker,
        directlyAssigned: Boolean(assignment),
        assignedByArea: Boolean(matchingArea),
        // A broker is operationally assigned when it is linked directly or
        // belongs to one of the Staff Officer's active work areas.
        canOperate: Boolean(assignment || matchingArea),
        assignmentId: assignment?.id ?? null,
        workAreaId: assignment?.workAreaId ?? matchingArea?.id ?? null,
        assignedArea:
          assignment?.assignedArea ??
          (matchedAreaLabel || null),
      };
    });

  return {
    areas,
    assignments,
    brokers: visible,
  };
}

export async function requireVisibleBrokerCustomer(
  companyId: string,
  staffId: string,
  brokerCustomerId: string,
): Promise<BrokerDirectoryRow> {
  const scope = await visibleBrokerCustomers(
    companyId,
    staffId,
  );
  const broker = scope.brokers.find(
    (item) =>
      String(item.id) === String(brokerCustomerId),
  );

  if (!broker) {
    throw new Error("BROKER_NOT_ASSIGNED");
  }

  if (!broker.canOperate) {
    throw new Error("BROKER_NOT_ASSIGNED");
  }

  return broker;
}
