"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Crosshair,
  Filter,
  LocateFixed,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Store,
  UserCheck,
} from "lucide-react";

import LiveMap from "../live-locations/LiveMap";
import styles from "./StaffBrokerDirectory.module.css";

type BrokerItem = {
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
  locationSource?: string;
  locationVerifiedAt?: string | null;
  status: string;
  directlyAssigned: boolean;
  canOperate: boolean;
  assignedArea: string | null;
  isImported: boolean;
  sourceAliasCode: string | null;
  sourceMsisdn: string | null;
};

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
  };
};

async function readJson<T>(
  url: string,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });
  const raw = await response.text();
  let result: any = {};

  try {
    result = raw
      ? JSON.parse(raw)
      : {};
  } catch {
    throw new Error(
      "The broker API returned invalid JSON.",
    );
  }

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      [
        result.message,
        result.details,
        result.code,
      ]
        .filter(Boolean)
        .join(" · ") ||
        "Could not load brokers.",
    );
  }

  return result as T;
}

export default function StaffBrokerDirectoryClient({
  user,
}: Props) {
  const router = useRouter();
  const [brokers, setBrokers] =
    useState<BrokerItem[]>([]);
  const [locations, setLocations] =
    useState<string[]>([]);
  const [search, setSearch] =
    useState("");
  const [
    locationFilter,
    setLocationFilter,
  ] = useState("");
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await readJson<{
        success: true;
        brokers: BrokerItem[];
        locations: string[];
      }>("/api/staff/brokers");

      setBrokers(
        Array.isArray(result.brokers)
          ? result.brokers
          : [],
      );
      setLocations(
        Array.isArray(result.locations)
          ? result.locations
          : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Broker directory could not load.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(
      () => setMessage(""),
      3000,
    );
    return () =>
      window.clearTimeout(timer);
  }, [message]);

  const filtered = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return brokers.filter((broker) => {
      const searchMatches =
        !query ||
        [
          broker.code,
          broker.name,
          broker.businessName,
          broker.phone,
          broker.sourceMsisdn,
          broker.sourceAliasCode,
          broker.email,
          broker.location,
          broker.region,
          broker.district,
          broker.ward,
          broker.city,
          broker.address,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );

      const locationMatches =
        !locationFilter ||
        [
          broker.location,
          broker.region,
          broker.district,
          broker.ward,
        ].some(
          (value) =>
            String(value || "")
              .toLowerCase() ===
            locationFilter.toLowerCase(),
        );

      return (
        searchMatches &&
        locationMatches
      );
    });
  }, [
    brokers,
    search,
    locationFilter,
  ]);

  const mapPoints = filtered
    .filter(
      (broker) =>
        Number.isFinite(
          Number(broker.latitude),
        ) &&
        Number.isFinite(
          Number(broker.longitude),
        ),
    )
    .map((broker) => ({
      id: broker.id,
      latitude: Number(
        broker.latitude,
      ),
      longitude: Number(
        broker.longitude,
      ),
      label:
        broker.businessName ||
        broker.name,
      subtitle:
        `${broker.code} · ` +
        `${broker.location || broker.assignedArea || "Registered agent"}`,
      capturedAt:
        broker.locationVerifiedAt,
      markerType: broker.isImported
        ? ("REGISTERED_AGENT" as const)
        : ("BROKER_CUSTOMER" as const),
    }));

  async function copyContact(
    broker: BrokerItem,
  ) {
    await navigator.clipboard.writeText(
      [
        broker.name,
        broker.businessName,
        broker.phone,
        broker.sourceAliasCode,
        broker.location,
        broker.address,
      ]
        .filter(Boolean)
        .join(" | "),
    );
    setMessage(
      `${broker.name}'s details were copied.`,
    );
  }

  function updateBroker(
    broker: BrokerItem,
  ) {
    const query = new URLSearchParams({
      brokerCustomerId: broker.id,
    });
    router.push(
      `/staff/live-locations?${query.toString()}`,
    );
  }

  return (
    <main className={styles.page}>
      {message && (
        <div className={styles.toast}>
          {message}
        </div>
      )}

      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => router.back()}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className={styles.identity}>
          <span>
            <UserCheck size={25} />
          </span>
          <div>
            <small>
              STAFF BROKER DIRECTORY
            </small>
            <h1>
              Registered Agents &
              Broker Customers
            </h1>
            <p>
              {user.name} · {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={styles.refresh}
          onClick={() => void load()}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      <section className={styles.hero}>
        <div>
          <small>
            ASSIGNED COMPANY RECORDS
          </small>
          <h2>
            Find agents and open their
            verified map location
          </h2>
          <p>
            Imported agents are displayed
            from BrokerCustomer records.
            A pointer appears after
            latitude and longitude are
            stored in MySQL.
          </p>
        </div>

        <div className={styles.metrics}>
          <article>
            <Store size={20} />
            <span>
              <small>
                Visible agents
              </small>
              <strong>
                {brokers.length}
              </strong>
            </span>
          </article>
          <article>
            <MapPin size={20} />
            <span>
              <small>
                Mapped agents
              </small>
              <strong>
                {mapPoints.length}
              </strong>
            </span>
          </article>
        </div>
      </section>

      <section className={styles.filters}>
        <label>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search name, alias, MSISDN, phone, address or region..."
          />
        </label>

        <label>
          <LocateFixed size={18} />
          <select
            value={locationFilter}
            onChange={(event) =>
              setLocationFilter(
                event.target.value,
              )
            }
          >
            <option value="">
              All locations
            </option>
            {locations.map(
              (location) => (
                <option
                  value={location}
                  key={location}
                >
                  {location}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setLocationFilter("");
          }}
        >
          <Filter size={17} />
          Clear filters
        </button>
      </section>

      {loading ? (
        <section className={styles.state}>
          <span
            className={styles.loader}
          />
          <h3>
            Loading registered agents...
          </h3>
        </section>
      ) : error ? (
        <section className={styles.state}>
          <h3>
            Broker directory could not
            load
          </h3>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
          >
            Try again
          </button>
        </section>
      ) : (
        <>
          <section className={styles.mapCard}>
            <header>
              <div>
                <h3>
                  Registered agent
                  pointers
                </h3>
                <p>
                  Map uses coordinates
                  stored in the database.
                </p>
              </div>
              <CheckCircle2 size={22} />
            </header>
            <LiveMap
              points={mapPoints}
              height={470}
            />
          </section>

          <section className={styles.tableCard}>
            <header>
              <div>
                <h3>
                  Broker and agent
                  directory
                </h3>
                <p>
                  Showing {filtered.length}{" "}
                  of {brokers.length}
                </p>
              </div>
              <Store size={22} />
            </header>

            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Agent</th>
                    <th>Alias / MSISDN</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>GPS</th>
                    <th>Assignment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(
                    (broker, index) => (
                      <tr key={broker.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>
                            {broker.businessName ||
                              broker.name}
                          </strong>
                          <small>
                            {broker.code}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {broker.sourceAliasCode ||
                              "—"}
                          </strong>
                          <small>
                            {broker.sourceMsisdn ||
                              "—"}
                          </small>
                        </td>
                        <td>
                          {broker.phone}
                        </td>
                        <td>
                          {[
                            broker.location,
                            broker.region,
                            broker.district,
                            broker.ward,
                          ]
                            .filter(Boolean)
                            .join(" / ") ||
                            "Not registered"}
                        </td>
                        <td>
                          <span
                            className={
                              Number.isFinite(
                                Number(
                                  broker.latitude,
                                ),
                              ) &&
                              Number.isFinite(
                                Number(
                                  broker.longitude,
                                ),
                              )
                                ? styles.mapped
                                : styles.unmapped
                            }
                          >
                            {Number.isFinite(
                              Number(
                                broker.latitude,
                              ),
                            ) &&
                            Number.isFinite(
                              Number(
                                broker.longitude,
                              ),
                            )
                              ? "Mapped"
                              : "Missing"}
                          </span>
                        </td>
                        <td>
                          {broker.directlyAssigned
                            ? "Direct"
                            : "Area only"}
                        </td>
                        <td>
                          <div
                            className={
                              styles.actions
                            }
                          >
                            <button
                              type="button"
                              disabled={
                                !broker.canOperate
                              }
                              onClick={() =>
                                updateBroker(
                                  broker,
                                )
                              }
                            >
                              <Crosshair
                                size={15}
                              />
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void copyContact(
                                  broker,
                                )
                              }
                            >
                              <Copy
                                size={15}
                              />
                              Copy
                            </button>
                            <a
                              href={`tel:${broker.phone}`}
                            >
                              <Phone
                                size={15}
                              />
                              Call
                            </a>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
