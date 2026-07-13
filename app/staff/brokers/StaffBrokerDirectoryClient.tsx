"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  LocateFixed,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
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
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const text = await response.text();
  let result: any = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The broker API returned invalid JSON.");
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || result.error || "Could not load brokers.",
    );
  }

  return result as T;
}

export default function StaffBrokerDirectoryClient({ user }: Props) {
  const router = useRouter();
  const [brokers, setBrokers] = useState<BrokerItem[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  async function loadBrokers() {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await readJson<{
        success: true;
        brokers: BrokerItem[];
        locations: string[];
      }>("/api/staff/brokers");

      setBrokers(Array.isArray(result.brokers) ? result.brokers : []);
      setLocations(
        Array.isArray(result.locations) ? result.locations : [],
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load broker directory.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBrokers();
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const filteredBrokers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return brokers.filter((broker) => {
      const searchMatches =
        !query ||
        [
          broker.code,
          broker.name,
          broker.businessName,
          broker.phone,
          broker.alternatePhone,
          broker.email,
          broker.location,
          broker.region,
          broker.district,
          broker.ward,
          broker.address,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );

      const locationMatches =
        !locationFilter ||
        broker.location.toLowerCase() ===
          locationFilter.toLowerCase();

      return searchMatches && locationMatches;
    });
  }, [brokers, search, locationFilter]);

  function useBroker(broker: BrokerItem) {
    sessionStorage.setItem(
      "simamia_selected_broker_customer",
      JSON.stringify(broker),
    );

    router.push(
      `/staff/service-visits?brokerCustomerId=${encodeURIComponent(
        broker.id,
      )}`,
    );
  }

  async function copyContact(broker: BrokerItem) {
    const contact = [
      broker.name,
      broker.businessName || "",
      broker.phone,
      broker.location,
      broker.address || "",
    ]
      .filter(Boolean)
      .join(" | ");

    await navigator.clipboard.writeText(contact);
    setMessage(`${broker.name}'s contact copied.`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
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
            <small>Company broker directory</small>
            <h1>Available Broker Customers</h1>
            <p>
              Signed in as {user.name} · {user.role.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void loadBrokers()}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {message && <div className={styles.toast}>{message}</div>}

      <section className={styles.hero}>
        <div>
          <p>Shared company records</p>
          <h2>Find brokers by their registered service location</h2>
          <span>
            These are customer/business records. They are not system users
            and do not have login credentials.
          </span>
        </div>

        <div className={styles.heroStats}>
          <article>
            <UserCheck size={20} />
            <span>
              <small>Active brokers</small>
              <strong>{brokers.length}</strong>
            </span>
          </article>

          <article>
            <MapPin size={20} />
            <span>
              <small>Locations</small>
              <strong>{locations.length}</strong>
            </span>
          </article>
        </div>
      </section>

      <section className={styles.filters}>
        <label>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search broker, shop, phone or address..."
          />
        </label>

        <label>
          <LocateFixed size={18} />
          <select
            value={locationFilter}
            onChange={(event) =>
              setLocationFilter(event.target.value)
            }
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option value={location} key={location}>
                {location}
              </option>
            ))}
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
        <section className={styles.stateCard}>
          <div className={styles.loader}></div>
          <h3>Loading broker directory...</h3>
        </section>
      ) : errorMessage ? (
        <section className={styles.stateCard}>
          <h3>Broker directory could not load</h3>
          <p>{errorMessage}</p>
          <button type="button" onClick={() => void loadBrokers()}>
            Try again
          </button>
        </section>
      ) : (
        <section className={styles.tableCard}>
          <div className={styles.tableHeading}>
            <div>
              <h2>Broker directory</h2>
              <p>
                Showing {filteredBrokers.length} of {brokers.length} active
                brokers
              </p>
            </div>
            <CheckCircle2 size={22} />
          </div>

          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Broker</th>
                  <th>Business</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Region / District</th>
                  <th>Address</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredBrokers.map((broker, index) => (
                  <tr key={broker.id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className={styles.entity}>
                        <span>
                          {broker.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{broker.name}</strong>
                          <small>{broker.code}</small>
                        </div>
                      </div>
                    </td>
                    <td>{broker.businessName || "N/A"}</td>
                    <td>
                      <div className={styles.phoneCell}>
                        <strong>{broker.phone}</strong>
                        <small>{broker.alternatePhone || ""}</small>
                      </div>
                    </td>
                    <td>
                      <span className={styles.locationBadge}>
                        <MapPin size={13} />
                        {broker.location}
                      </span>
                    </td>
                    <td>
                      {[broker.region, broker.district, broker.ward]
                        .filter(Boolean)
                        .join(" / ") || "N/A"}
                    </td>
                    <td>{broker.address || "N/A"}</td>
                    <td>{broker.notes || "No notes"}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          onClick={() => useBroker(broker)}
                        >
                          <ExternalLink size={15} />
                          Use for service
                        </button>

                        <button
                          type="button"
                          onClick={() => void copyContact(broker)}
                        >
                          <Copy size={15} />
                          Copy
                        </button>

                        <a href={`tel:${broker.phone}`}>
                          <Phone size={15} />
                          Call
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredBrokers.length && (
                  <tr>
                    <td colSpan={9}>
                      <div className={styles.empty}>
                        <Building2 size={31} />
                        <strong>No broker found</strong>
                        <p>
                          Change the location or search filter and try
                          again.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
