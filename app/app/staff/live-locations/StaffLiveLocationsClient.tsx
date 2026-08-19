"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  Crosshair,
  MapPinned,
  Navigation,
  RefreshCw,
  Route,
  Search,
  Store,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import LiveMap, {
  type LiveMapPoint,
} from "./LiveMap";
import styles from "./live-locations.module.css";

type UserProps = {
  id: string;
  name: string;
  email: string;
  companyId: string;
};

type RegisteredAgent = {
  id: string;
  code: string;
  name: string;
  businessName: string | null;
  phone: string;
  sourceAliasCode: string | null;
  sourceMsisdn: string | null;
  location: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapped: boolean;
  directlyAssigned: boolean;
  canOperate: boolean;
  assignedArea: string | null;
  attendedBy: string | null;
  attendedDate: string | null;
  attendedLocation: string | null;
  locationSource?: string;
  isImported: boolean;
  fullAddress?: string;
  visitedToday?: boolean;
  servicedToday?: boolean;
  liveNow?: boolean;
  liveDeviceSeenAt?: string | null;
  liveAccuracy?: number | null;
  locationVerifiedAt?: string | null;
  markerType?: string;
  visitToday?: Visit | null;
};

type Visit = {
  id: string;
  brokerCustomerId?: string;
  status: string;
  serviceType: string;
  floatAmount: number | string;
  cashAmount: number | string;
  companyIncome: number | string;
  locationName: string | null;
  communicationNote?: string | null;
  distanceMeters: number | null;
  staffLatitude?: number | string | null;
  staffLongitude?: number | string | null;
  brokerLatitude?: number | string | null;
  brokerLongitude?: number | string | null;
  startedAt?: string | null;
  arrivedAt: string | null;
  serviceProvidedAt: string | null;
  completedAt?: string | null;
  proofDueAt?: string | null;
  proofUploadedAt?: string | null;
  updatedAt: string;
  brokerCustomer: RegisteredAgent;
};

type LiveLocationResponse = {
  success: true;
  points: LiveMapPoint[];
  history?: LiveMapPoint[];
  registeredAgents: RegisteredAgent[];
  customers: Array<Record<string, any>>;
  visits: Visit[];
  staffDevices: Array<Record<string, any>>;
  summary: {
    staffDevices: number;
    staffPointers?: number;
    liveBrokerDevices: number;
    liveAgents?: number;
    registeredAgents: number;
    mappedAgents: number;
    unmappedAgents: number;
    visitedAgents: number;
    servicedAgents: number;
    customers: number;
    mappedCustomers: number;
    visitsToday: number;
    rejectedZeroCoordinates?: number;
  };
};

type ServiceForm = {
  brokerCustomerId: string;
  serviceType: string;
  floatAmount: string;
  cashAmount: string;
  companyIncome: string;
  locationName: string;
  notes: string;
  updateRegisteredLocation: boolean;
};

const DEVICE_TOKEN_KEY =
  "simamia_staff_device_token_v5";

function deviceToken(): string {
  const current =
    window.localStorage.getItem(
      DEVICE_TOKEN_KEY,
    );

  if (current) return current;

  const next = crypto.randomUUID();
  window.localStorage.setItem(
    DEVICE_TOKEN_KEY,
    next,
  );
  return next;
}

function money(value: unknown): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    },
  ).format(Number(value || 0));
}

function dateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone:
        "Africa/Dar_es_Salaam",
    },
  ).format(date);
}

function label(value: unknown): string {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function sourceLabel(value: unknown): string {
  switch (String(value || "").toUpperCase()) {
    case "AGENT_LIVE_DEVICE": return "Agent live GPS";
    case "AGENT_DEVICE_LAST_KNOWN": return "Agent GPS last known";
    case "STAFF_GPS_VERIFIED": return "Verified during staff visit";
    case "DATABASE_ADDRESS_APPROXIMATE": return "Approximate address point";
    case "DATABASE_COORDINATE": return "Saved database coordinate";
    default: return "No valid GPS point";
  }
}

function coordinate(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });

  const raw = await response.text();
  let body: any = {};

  try {
    body = raw
      ? JSON.parse(raw)
      : {};
  } catch {
    throw new Error(
      `Server returned invalid JSON (${response.status}).`,
    );
  }

  if (
    !response.ok ||
    body.success === false
  ) {
    throw new Error(
      [
        body.message,
        body.details,
        body.code,
      ]
        .filter(Boolean)
        .join(" · ") ||
        `Request failed (${response.status}).`,
    );
  }

  return body as T;
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            "This device does not support browser geolocation.",
          ),
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          maximumAge: 5_000,
          timeout: 25_000,
        },
      );
    },
  );
}

export default function StaffLiveLocationsClient({
  user,
  embedded = false,
  onOpenServiceVisits,
}: {
  user: UserProps;
  embedded?: boolean;
  onOpenServiceVisits?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] =
    useState<LiveLocationResponse | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState(false);
  const [resolvingMissing, setResolvingMissing] =
    useState(false);
  const [resolveProgress, setResolveProgress] =
    useState("");
  const [gpsStatus, setGpsStatus] = useState<{
    state: string;
    tracking: boolean;
    message: string;
    schedule: {
      startTime: string;
      stopTime: string;
      isSharingWindow: boolean;
      timeZone: string;
    } | null;
  }>({
    state: "CHECKING",
    tracking: false,
    message: "Checking automatic GPS schedule...",
    schedule: null,
  });
  const tracking = gpsStatus.tracking;
  const [query, setQuery] =
    useState("");
  const [selected, setSelected] =
    useState<RegisteredAgent | null>(
      null,
    );
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");
  const [form, setForm] =
    useState<ServiceForm>({
      brokerCustomerId: "",
      serviceType:
        "FLOAT_AND_CASH_SERVICE",
      floatAmount: "",
      cashAmount: "",
      companyIncome: "",
      locationName: "",
      notes: "",
      updateRegisteredLocation: false,
    });

  async function load(
    showLoading = false,
  ) {
    if (showLoading) {
      setLoading(true);
    }

    setError("");

    try {
      const result =
        await requestJson<LiveLocationResponse>(
          "/api/staff/live-locations",
        );
      setData(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Live locations could not load.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);

    const timer = window.setInterval(
      () => void load(false),
      15_000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function handleGpsStatus(event: Event) {
      const detail = (event as CustomEvent).detail as {
        state?: string;
        tracking?: boolean;
        message?: string;
        schedule?: {
          startTime: string;
          stopTime: string;
          isSharingWindow: boolean;
          timeZone: string;
        } | null;
      } | undefined;

      if (!detail) return;

      setGpsStatus({
        state: String(detail.state || "CHECKING"),
        tracking: Boolean(detail.tracking),
        message: String(detail.message || "Automatic GPS schedule is active."),
        schedule: detail.schedule || null,
      });
    }

    window.addEventListener("simamia:gps-status", handleGpsStatus);
    window.dispatchEvent(new CustomEvent("simamia:gps-status-request"));

    return () => {
      window.removeEventListener("simamia:gps-status", handleGpsStatus);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(
      () => setMessage(""),
      4200,
    );
    return () =>
      window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const requestedId = searchParams.get("brokerCustomerId");

    if (!requestedId || !data || selected) return;

    const broker = data.registeredAgents.find(
      (item) => String(item.id) === requestedId,
    );

    if (broker) {
      selectAgent(broker);
    }
  }, [data, searchParams, selected]);

  const filteredAgents = useMemo(() => {
    const search = query
      .trim()
      .toLowerCase();

    if (!data) return [];

    const ranked = data.registeredAgents
      .slice()
      .sort((first, second) => {
        const priority = (agent: RegisteredAgent) => {
          if (agent.liveNow) return 0;
          if (agent.servicedToday) return 1;
          if (agent.visitedToday) return 2;
          if (agent.canOperate && agent.mapped) return 3;
          if (agent.canOperate) return 4;
          if (agent.mapped) return 5;
          return 6;
        };
        const priorityDiff = priority(first) - priority(second);
        if (priorityDiff) return priorityDiff;
        if (first.directlyAssigned !== second.directlyAssigned) {
          return first.directlyAssigned ? -1 : 1;
        }
        return String(first.businessName || first.name || "").localeCompare(
          String(second.businessName || second.name || ""),
        );
      });

    if (!search) {
      return ranked;
    }

    return ranked.filter(
      (agent) =>
        [
          agent.name,
          agent.businessName,
          agent.code,
          agent.phone,
          agent.sourceAliasCode,
          agent.sourceMsisdn,
          agent.location,
          agent.region,
          agent.district,
          agent.ward,
          agent.assignedArea,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(search),
        ),
    );
  }, [
    data,
    query,
  ]);

  function requestAutomaticGps() {
    window.dispatchEvent(new CustomEvent("simamia:gps-request-start"));
    setMessage("Checking location permission and automatic GPS schedule...");
  }

  function selectAgent(
    agent: RegisteredAgent,
  ) {
    setSelected(agent);
    setForm({
      brokerCustomerId: agent.id,
      serviceType:
        "FLOAT_AND_CASH_SERVICE",
      floatAmount: "",
      cashAmount: "",
      companyIncome: "",
      locationName:
        agent.location ||
        agent.assignedArea ||
        "",
      notes: "",
      updateRegisteredLocation:
        !agent.mapped,
    });
  }

  function mergeSavedVisit(input: {
    agent: RegisteredAgent;
    visit?: Visit | null;
    broker?: RegisteredAgent | null;
    latitude: number;
    longitude: number;
    capturedAt: string;
  }) {
    setData((current) => {
      if (!current) return current;

      const brokerId = String(
        input.broker?.id ||
          input.visit?.brokerCustomerId ||
          input.agent.id,
      );
      const savedBroker = {
        ...input.agent,
        ...(input.broker || {}),
        id: brokerId,
        latitude: coordinate(input.broker?.latitude) ?? input.latitude,
        longitude: coordinate(input.broker?.longitude) ?? input.longitude,
        mapped: true,
        visitedToday: true,
        servicedToday: true,
        attendedBy: user.name,
        attendedDate: input.capturedAt,
        attendedLocation:
          input.visit?.locationName ||
          input.broker?.attendedLocation ||
          input.agent.location ||
          input.agent.assignedArea,
        locationSource: "STAFF_GPS_VERIFIED",
        locationVerifiedAt: input.capturedAt,
        markerType: input.agent.isImported
          ? "REGISTERED_AGENT_SERVICED"
          : "BROKER_CUSTOMER_SERVICED",
      } satisfies RegisteredAgent;

      const savedVisit = input.visit
        ? {
            ...input.visit,
            brokerCustomerId:
              input.visit.brokerCustomerId || brokerId,
            brokerCustomer: savedBroker,
            staffLatitude:
              input.visit.staffLatitude ?? input.latitude,
            staffLongitude:
              input.visit.staffLongitude ?? input.longitude,
            brokerLatitude:
              input.visit.brokerLatitude ?? input.latitude,
            brokerLongitude:
              input.visit.brokerLongitude ?? input.longitude,
            locationName:
              input.visit.locationName ||
              savedBroker.attendedLocation ||
              savedBroker.location ||
              "Broker location",
            updatedAt:
              input.visit.updatedAt || input.capturedAt,
          }
        : null;

      const registeredAgents = current.registeredAgents.map((agent) =>
        String(agent.id) === brokerId
          ? {
              ...agent,
              ...savedBroker,
              visitToday: savedVisit ?? agent.visitToday,
            }
          : agent,
      );
      const visits = savedVisit
        ? [
            savedVisit,
            ...current.visits.filter(
              (visit) => String(visit.id) !== String(savedVisit.id),
            ),
          ]
        : current.visits;

      const marker: LiveMapPoint = {
        id: `agent-${brokerId}`,
        entityId: brokerId,
        markerType: savedBroker.markerType as LiveMapPoint["markerType"],
        label: savedBroker.businessName || savedBroker.name,
        subtitle: [
          "Serviced today",
          savedBroker.code,
          savedBroker.ward,
          savedBroker.district,
          savedBroker.region,
        ]
          .filter(Boolean)
          .join(" - "),
        latitude: input.latitude,
        longitude: input.longitude,
        capturedAt: input.capturedAt,
        source: "STAFF_GPS_VERIFIED",
        accuracy: input.agent.liveAccuracy ?? null,
      };
      let markerUpdated = false;
      const points = current.points.map((point) => {
        if (
          String(point.entityId || "") === brokerId ||
          String(point.id || "") === `agent-${brokerId}`
        ) {
          markerUpdated = true;
          return { ...point, ...marker };
        }
        return point;
      });

      if (!markerUpdated) {
        points.push(marker);
      }

      return {
        ...current,
        points,
        registeredAgents,
        visits,
        summary: {
          ...current.summary,
          mappedAgents: registeredAgents.filter((agent) => agent.mapped).length,
          visitedAgents: registeredAgents.filter((agent) => agent.visitedToday).length,
          servicedAgents: registeredAgents.filter((agent) => agent.servicedToday).length,
          visitsToday: visits.length,
        },
      };
    });
  }

  async function quickUpdate(
    agent: RegisteredAgent,
  ) {
    setBusy(true);

    try {
      const position =
        await currentPosition();

      const result = await requestJson<{
        success: true;
        message: string;
        visit?: Visit;
        broker?: RegisteredAgent;
        warnings?: string[];
      }>("/api/staff/service-visits", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action:
            "QUICK_VISIT_AND_SERVICE",
          brokerCustomerId: agent.id,
          staffLatitude:
            position.coords.latitude,
          staffLongitude:
            position.coords.longitude,
          capturedAt: new Date(
            position.timestamp,
          ).toISOString(),
          accuracy: position.coords.accuracy,
          locationName:
            agent.location ||
            agent.assignedArea ||
            "Broker location",
          updateRegisteredLocation: true,
        }),
      });

      setMessage(
        [result.message, ...(result.warnings || [])]
          .filter(Boolean)
          .join(" "),
      );
      mergeSavedVisit({
        agent,
        visit: result.visit ?? null,
        broker: result.broker ?? null,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date(position.timestamp).toISOString(),
      });
      window.localStorage.setItem(
        "simamia_service_visit_updated_at",
        String(Date.now()),
      );
      window.dispatchEvent(
        new CustomEvent("simamia:service-visit-updated", {
          detail: {
            visit: result.visit ?? null,
            broker: result.broker ?? null,
            source: "live-location",
          },
        }),
      );
      await load(false);
    } catch (updateError) {
      setMessage(
        updateError instanceof Error
          ? updateError.message
          : "Broker visit could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }


  async function createAgentLiveLink(agent: RegisteredAgent) {
    setBusy(true);
    try {
      const result = await requestJson<{
        success: true;
        message: string;
        shareUrl: string;
      }>("/api/staff/agent-location-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerCustomerId: agent.id }),
      });

      try {
        await navigator.clipboard.writeText(result.shareUrl);
        setMessage(`${result.message} The link was copied to the clipboard.`);
      } catch {
        window.prompt("Copy this secure agent live-location link:", result.shareUrl);
        setMessage(result.message);
      }
    } catch (linkError) {
      setMessage(
        linkError instanceof Error
          ? linkError.message
          : "The live-location link could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }


  async function resolveMissingPointers() {
    if (!data) return;

    const candidates = data.registeredAgents
      .filter(
        (agent) =>
          !agent.mapped &&
          agent.canOperate &&
          Boolean(
            agent.address ||
              agent.ward ||
              agent.district ||
              agent.region ||
              agent.location ||
              agent.assignedArea,
          ),
      )
      .slice(0, 20);

    if (!candidates.length) {
      setMessage("No addressable unmapped agent remains in this batch.");
      return;
    }

    setResolvingMissing(true);
    let resolved = 0;
    let failed = 0;

    try {
      for (let index = 0; index < candidates.length; index += 1) {
        const agent = candidates[index];
        setResolveProgress(
          `Resolving ${index + 1}/${candidates.length}: ${agent.businessName || agent.name}`,
        );

        try {
          await requestJson("/api/staff/broker-geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brokerCustomerId: agent.id }),
          });
          resolved += 1;
        } catch {
          failed += 1;
        }

        if (index < candidates.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1100));
        }
      }

      setMessage(
        `${resolved} agent pointer(s) resolved${failed ? `; ${failed} address(es) could not be matched` : ""}.`,
      );
      await load(false);
    } finally {
      setResolvingMissing(false);
      setResolveProgress("");
    }
  }

  async function resolveAddress(agent: RegisteredAgent) {
    setBusy(true);

    try {
      const result = await requestJson<{
        success: true;
        message: string;
      }>("/api/staff/broker-geocode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brokerCustomerId: agent.id,
        }),
      });

      setMessage(result.message);
      await load(false);
    } catch (addressError) {
      setMessage(
        addressError instanceof Error
          ? addressError.message
          : "The broker address could not be located.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveService(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!selected) {
      setMessage(
        "Select a broker first.",
      );
      return;
    }

    setBusy(true);

    try {
      const position =
        await currentPosition();

      const result = await requestJson<{
        success: true;
        message: string;
        visit?: Visit;
        broker?: RegisteredAgent;
        warnings?: string[];
      }>("/api/staff/service-visits", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_VISIT",
          ...form,
          staffLatitude:
            position.coords.latitude,
          staffLongitude:
            position.coords.longitude,
          capturedAt: new Date(
            position.timestamp,
          ).toISOString(),
          accuracy: position.coords.accuracy,
        }),
      });

      setMessage(
        [result.message, ...(result.warnings || [])]
          .filter(Boolean)
          .join(" "),
      );
      mergeSavedVisit({
        agent: selected,
        visit: result.visit ?? null,
        broker: result.broker ?? null,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date(position.timestamp).toISOString(),
      });
      window.localStorage.setItem(
        "simamia_service_visit_updated_at",
        String(Date.now()),
      );
      window.dispatchEvent(
        new CustomEvent("simamia:service-visit-updated", {
          detail: {
            visit: result.visit ?? null,
            broker: result.broker ?? null,
            source: "live-location",
          },
        }),
      );
      setSelected(null);
      setForm({
        brokerCustomerId: "",
        serviceType:
          "FLOAT_AND_CASH_SERVICE",
        floatAmount: "",
        cashAmount: "",
        companyIncome: "",
        locationName: "",
        notes: "",
        updateRegisteredLocation:
          false,
      });
      await load(false);
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "Service update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <section className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
        <section
          className={styles.state}
        >
          <span
            className={styles.loader}
          />
          <h1>
            Loading live locations
          </h1>
          <p>
            Fetching GPS, registered
            agents, customers and service
            visits.
          </p>
        </section>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
        <section
          className={styles.state}
        >
          <WifiOff size={34} />
          <h1>
            Live locations could not load
          </h1>
          <p>{error}</p>
          <button
            type="button"
            onClick={() =>
              void load(true)
            }
          >
            Try again
          </button>
        </section>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
      {message && (
        <div className={styles.toast}>
          {message}
        </div>
      )}

      <header className={styles.header}>
        {!embedded && (
          <button
            type="button"
            className={styles.back}
            onClick={() => router.back()}
          >
            <ArrowLeft size={18} />
            Back
          </button>
        )}

        <div className={styles.identity}>
          <span>
            <MapPinned size={25} />
          </span>
          <div>
            <small>
              STAFF OPERATIONS
            </small>
            <h1>
              Live Agent & Customer
              Locations
            </h1>
            <p>
              {user.name} · {user.email}
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={tracking ? styles.stop : styles.start}
            disabled={gpsStatus.state === "NIGHT_STOPPED"}
            onClick={requestAutomaticGps}
            title={gpsStatus.message}
          >
            {tracking ? (
              <>
                <Wifi size={17} />
                GPS automatic
              </>
            ) : gpsStatus.state === "NIGHT_STOPPED" ? (
              <>
                <WifiOff size={17} />
                Night stop
              </>
            ) : (
              <>
                <Navigation size={17} />
                Enable GPS
              </>
            )}
          </button>

          {onOpenServiceVisits && (
            <button
              type="button"
              className={styles.refresh}
              onClick={onOpenServiceVisits}
            >
              <Route size={17} />
              Service Visits
            </button>
          )}

          <button
            type="button"
            className={styles.refresh}
            disabled={resolvingMissing || busy}
            onClick={() => void resolveMissingPointers()}
          >
            <MapPinned size={17} />
            {resolvingMissing ? "Resolving..." : "Resolve missing pointers"}
          </button>

          <button
            type="button"
            className={styles.refresh}
            onClick={() =>
              void load(false)
            }
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.livePill}>
            {tracking ? (
              <Wifi size={15} />
            ) : (
              <WifiOff size={15} />
            )}
            {tracking
              ? "GPS LIVE · AUTOMATIC"
              : gpsStatus.state === "NIGHT_STOPPED"
                ? "GPS NIGHT STOP"
                : "GPS READY"}
          </span>
          <h2>
            Track real work locations and
            update broker service visits
          </h2>
          <p>
            Staff coordinates come from this device. Imported agents are shown only when they have a valid coordinate. For true live agent movement, create a secure GPS link and let that agent share from their own phone. Coordinates 0,0 are rejected.
          </p>
        </div>

        <div className={styles.heroStats}>
          <Metric
            icon={<Store size={20} />}
            label="Registered agents"
            value={
              data.summary
                .registeredAgents
            }
          />
          <Metric
            icon={
              <MapPinned size={20} />
            }
            label="Mapped agents"
            value={
              data.summary.mappedAgents
            }
          />
          <Metric
            icon={<Users size={20} />}
            label="Agents live now"
            value={
              data.summary
                .liveAgents || 0
            }
          />
          <Metric
            icon={
              <Activity size={20} />
            }
            label="Serviced today"
            value={
              data.summary.servicedAgents
            }
          />
        </div>
      </section>

      <section className={styles.toolbar}>
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Search agent, alias, MSISDN, phone, region or location..."
          />
        </label>

        <span
          className={
            tracking
              ? styles.online
              : styles.offline
          }
        >
          {tracking
            ? `Your location is sharing automatically until ${gpsStatus.schedule?.stopTime || "night"}`
            : gpsStatus.message}
        </span>
      </section>

      {resolveProgress && (
        <section className={styles.locationNotice}>
          <RefreshCw size={21} />
          <div>
            <strong>Resolving registered agent locations</strong>
            <span>{resolveProgress}</span>
          </div>
        </section>
      )}

      {Boolean(data.summary.rejectedZeroCoordinates) && (
        <section className={styles.locationNotice}>
          <MapPinned size={21} />
          <div>
            <strong>{data.summary.rejectedZeroCoordinates} invalid 0,0 location(s) rejected</strong>
            <span>Those records are not drawn on the map. Run the supplied zero-coordinate repair script, then capture or share a real GPS position.</span>
          </div>
        </section>
      )}

      {data.summary.unmappedAgents > 0 && (
        <section className={styles.locationNotice}>
          <MapPinned size={21} />
          <div>
            <strong>{data.summary.unmappedAgents} assigned broker(s) need coordinates</strong>
            <span>Use Locate address for a region/district/ward/street estimate, then capture the exact position with Mark visited & serviced when you reach the broker.</span>
          </div>
        </section>
      )}

      <section className={styles.mapCard}>
        <div className={styles.mapHeading}>
          <div>
            <h3>
              Operational live map
            </h3>
            <p>
              Green S: this logged-in Staff Officer only · LIVE agent pointers come from the agent phone · green ✓: serviced · gold V: visited · purple A: valid assigned agent coordinate · blue B: broker customer · orange C: customer
            </p>
          </div>
          <strong>
            {data.points.length} pointer
            {data.points.length === 1
              ? ""
              : "s"}
          </strong>
        </div>

        <LiveMap
          points={data.points}
          history={data.history || []}
          height={embedded ? 510 : 560}
        />
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <header>
            <div>
              <h3>
                Assigned registered agents
              </h3>
              <p>
                Brokers are sorted by ready-to-work status: live, serviced, visited, mapped, then unmapped. Update GPS captures the Staff phone point and writes broker_service_visits plus service_activities.
              </p>
            </div>
            <Store size={22} />
          </header>

          <div className={styles.agentList}>
            {filteredAgents.map(
              (agent) => (
                <article
                  key={agent.id}
                  className={styles.agent}
                >
                  <span
                    className={
                      agent.mapped
                        ? styles.mappedIcon
                        : styles.unmappedIcon
                    }
                  >
                    {agent.name
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>

                  <div>
                    <strong>
                      {agent.businessName ||
                        agent.name}
                    </strong>
                    <small>
                      {agent.code} ·{" "}
                      {agent.phone}
                    </small>
                    <em>
                      {agent.fullAddress ||
                        agent.location ||
                        agent.assignedArea ||
                        "No registered location"}
                    </em>
                    <em>
                      {sourceLabel(agent.locationSource)}
                      {agent.liveAccuracy != null
                        ? ` · ±${Math.round(Number(agent.liveAccuracy))}m`
                        : ""}
                    </em>
                  </div>

                  <span
                    className={
                      agent.servicedToday
                        ? styles.serviced
                        : agent.visitedToday
                          ? styles.visited
                          : agent.mapped
                            ? styles.mapped
                            : styles.unmapped
                    }
                  >
                    {agent.liveNow
                      ? "Live now"
                      : agent.servicedToday
                        ? "Serviced"
                        : agent.visitedToday
                          ? "Visited"
                          : agent.mapped
                            ? agent.locationSource === "DATABASE_ADDRESS_APPROXIMATE"
                              ? "Approximate"
                              : "Mapped"
                            : "Needs location"}
                  </span>

                  <div
                    className={
                      styles.agentActions
                    }
                  >
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !agent.canOperate
                      }
                      onClick={() =>
                        void quickUpdate(
                          agent,
                        )
                      }
                    >
                      <Crosshair
                        size={15}
                      />
                      Update GPS + mark serviced
                    </button>

                    <button
                      type="button"
                      disabled={busy || !agent.canOperate}
                      onClick={() => void createAgentLiveLink(agent)}
                    >
                      <ClipboardCopy size={15} />
                      Copy agent live GPS link
                    </button>

                    <button
                      type="button"
                      disabled={busy || !agent.canOperate}
                      onClick={() => void resolveAddress(agent)}
                    >
                      <MapPinned size={15} />
                      {agent.mapped ? "Resolve address again" : "Locate address"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        !agent.canOperate
                      }
                      onClick={() =>
                        selectAgent(
                          agent,
                        )
                      }
                    >
                      <Banknote
                        size={15}
                      />
                      Service details
                    </button>
                  </div>
                </article>
              ),
            )}

            {!filteredAgents.length && (
              <div className={styles.empty}>
                No registered agent matched
                the current search.
              </div>
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <header>
            <div>
              <h3>
                Today’s broker service
                visits
              </h3>
              <p>
                Every successful Live Location update appears here immediately and is also synchronised with the Service Visits sidebar.
              </p>
            </div>
            <Route size={22} />
          </header>

          <div className={styles.visitList}>
            {data.visits.map(
              (visit) => (
                <article key={visit.id}>
                  <span>
                    <CheckCircle2
                      size={18}
                    />
                  </span>
                  <div>
                    <strong>
                      {visit
                        .brokerCustomer
                        ?.businessName ||
                        visit
                          .brokerCustomer
                          ?.name ||
                        "Broker"}
                    </strong>
                    <small>
                      {label(
                        visit.serviceType,
                      )}{" "}
                      ·{" "}
                      {dateTime(
                        visit.serviceProvidedAt ||
                          visit.arrivedAt ||
                          visit.updatedAt,
                      )}
                    </small>
                    <em>
                      {visit.locationName ||
                        "Location recorded"}
                    </em>
                  </div>
                  <div
                    className={
                      styles.amounts
                    }
                  >
                    <b>
                      Float{" "}
                      {money(
                        visit.floatAmount,
                      )}
                    </b>
                    <b>
                      Cash{" "}
                      {money(
                        visit.cashAmount,
                      )}
                    </b>
                  </div>
                  <span
                    className={styles.status}
                  >
                    {label(
                      visit.status,
                    )}
                  </span>
                </article>
              ),
            )}

            {!data.visits.length && (
              <div className={styles.empty}>
                No broker service visit has
                been updated today.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className={styles.visitedTableCard}>
        <header className={styles.visitedTableHeading}>
          <div>
            <small>VISITED DATABASE TABLE</small>
            <h3>Visited and serviced brokers today</h3>
            <p>
              When a Staff Officer clicks Update GPS + mark serviced, the broker point is saved, the broker is marked visited, and the broker_service_visits record below is updated for reports.
            </p>
          </div>
          <strong>
            {data.visits.length} saved visit
            {data.visits.length === 1 ? "" : "s"}
          </strong>
        </header>

        <div className={styles.visitedTableScroll}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Broker</th>
                <th>Visit time</th>
                <th>GPS point</th>
                <th>Service</th>
                <th>Float</th>
                <th>Cash</th>
                <th>Income</th>
                <th>Distance</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {data.visits.map((visit, index) => {
                const broker = visit.brokerCustomer;
                const latitude =
                  coordinate(visit.brokerLatitude) ??
                  coordinate(visit.staffLatitude) ??
                  coordinate(broker?.latitude);
                const longitude =
                  coordinate(visit.brokerLongitude) ??
                  coordinate(visit.staffLongitude) ??
                  coordinate(broker?.longitude);
                const location =
                  visit.locationName ||
                  broker?.attendedLocation ||
                  broker?.location ||
                  broker?.assignedArea ||
                  "Location recorded";

                return (
                  <tr key={visit.id}>
                    <td data-label="#"> {index + 1}</td>
                    <td data-label="Broker">
                      <strong>
                        {broker?.businessName || broker?.name || "Broker"}
                      </strong>
                      <small>{broker?.code || broker?.phone || "Registered broker"}</small>
                    </td>
                    <td data-label="Visit time">
                      <strong>
                        {dateTime(
                          visit.completedAt ||
                            visit.serviceProvidedAt ||
                            visit.arrivedAt ||
                            visit.startedAt ||
                            visit.updatedAt,
                        )}
                      </strong>
                      <small>{location}</small>
                    </td>
                    <td data-label="GPS point">
                      <strong>
                        {latitude == null || longitude == null
                          ? "No coordinate"
                          : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
                      </strong>
                      <small>Saved from staff phone GPS</small>
                    </td>
                    <td data-label="Service">{label(visit.serviceType)}</td>
                    <td data-label="Float">{money(visit.floatAmount)}</td>
                    <td data-label="Cash">{money(visit.cashAmount)}</td>
                    <td data-label="Income">{money(visit.companyIncome)}</td>
                    <td data-label="Distance">
                      {visit.distanceMeters == null
                        ? "N/A"
                        : `${Math.round(Number(visit.distanceMeters))} m`}
                    </td>
                    <td data-label="Status">
                      <span className={styles.tableStatus}>
                        {label(visit.status)}
                      </span>
                    </td>
                    <td data-label="Open">
                      {onOpenServiceVisits ? (
                        <button type="button" onClick={onOpenServiceVisits}>
                          <Route size={14} />
                          Service visits
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push("/staff/dashboard?section=Service+Visits")}
                        >
                          <Route size={14} />
                          Service visits
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.visits.length && (
            <div className={styles.empty}>
              No broker has been marked visited and serviced today.
            </div>
          )}
        </div>
      </section>

      {selected && (
        <div className={styles.modal}>
          <button
            type="button"
            className={
              styles.modalBackdrop
            }
            aria-label="Close service form"
            onClick={() =>
              setSelected(null)
            }
          />

          <form
            className={styles.form}
            onSubmit={saveService}
          >
            <header>
              <div>
                <small>
                  DATABASE SERVICE UPDATE
                </small>
                <h3>
                  {selected.businessName ||
                    selected.name}
                </h3>
                <p>
                  GPS is captured
                  automatically when you
                  save.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
              >
                <X size={20} />
              </button>
            </header>

            <label>
              <span>
                Type of service
              </span>
              <select
                value={form.serviceType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    serviceType:
                      event.target.value,
                  })
                }
              >
                <option value="FLOAT_AND_CASH_SERVICE">
                  Float and cash service
                </option>
                <option value="FLOAT_SERVICE">
                  Float service
                </option>
                <option value="CASH_SERVICE">
                  Cash collection
                </option>
                <option value="BROKER_SUPPORT">
                  Broker support
                </option>
                <option value="DOCUMENT_COLLECTION">
                  Document collection
                </option>
                <option value="OTHER_SERVICE">
                  Other service
                </option>
              </select>
            </label>

            <div
              className={styles.formRow}
            >
              <label>
                <span>
                  Float provided
                </span>
                <input
                  type="number"
                  min="0"
                  value={
                    form.floatAmount
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      floatAmount:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Cash received/provided
                </span>
                <input
                  type="number"
                  min="0"
                  value={
                    form.cashAmount
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      cashAmount:
                        event.target
                          .value,
                    })
                  }
                />
              </label>
            </div>

            <label>
              <span>
                Company income
              </span>
              <input
                type="number"
                min="0"
                value={
                  form.companyIncome
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    companyIncome:
                      event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>
                Location label
              </span>
              <input
                value={
                  form.locationName
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    locationName:
                      event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>
                Service notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    notes:
                      event.target.value,
                  })
                }
              />
            </label>

            <label
              className={
                styles.checkbox
              }
            >
              <input
                type="checkbox"
                checked={
                  form.updateRegisteredLocation
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    updateRegisteredLocation:
                      event.target
                        .checked,
                  })
                }
              />
              <span>
                Save my current GPS as this
                agent’s registered location
              </span>
            </label>

            <button
              type="submit"
              className={
                styles.submit
              }
              disabled={busy}
            >
              <Crosshair size={17} />
              {busy
                ? "Saving update..."
                : "Update visit and service"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
