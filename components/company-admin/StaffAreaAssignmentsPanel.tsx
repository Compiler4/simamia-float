"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Filter,
  Link2,
  MapPin,
  MapPinned,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import styles from "./StaffAreaAssignmentsPanel.module.css";

type StaffItem = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  phone?: string | null;
  profileImageUrl?: string | null;
  assignedRegion?: string | null;
  branch?: {
    id: string;
    name: string;
    code: string;
    region?: string | null;
  } | null;
};

type BrokerAssignmentSummary = {
  id: string;
  staffId: string;
  staffName: string;
  assignedArea?: string | null;
  startedAt: string;
};

type BrokerItem = {
  id: string;
  code: string;
  name: string;
  businessName?: string | null;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  location: string;
  region?: string | null;
  district?: string | null;
  ward?: string | null;
  city?: string | null;
  address?: string | null;
  attendedLocation?: string | null;
  isImported?: boolean;
  activeAssignment?: BrokerAssignmentSummary | null;
};

type CustomerItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  address?: string | null;
};

type BrokerAssignment = {
  id: string;
  staffId: string;
  brokerCustomerId: string;
  assignedArea?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
  staff: StaffItem;
  broker: BrokerItem;
  assignedBy?: { id: string; name: string; email: string } | null;
};

type CustomerAssignment = {
  id: string;
  staffId: string;
  customerId: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
  staff: StaffItem;
  customer: CustomerItem;
  assignedBy?: { id: string; name: string; email: string } | null;
};

type AssignmentData = {
  success: true;
  staff: StaffItem[];
  areas: string[];
  branches: Array<{
    id: string;
    name: string;
    code: string;
    region?: string | null;
    address?: string | null;
  }>;
  brokers: BrokerItem[];
  customers: CustomerItem[];
  brokerAssignments: BrokerAssignment[];
  customerAssignments: CustomerAssignment[];
  summary: {
    staff: number;
    areas: number;
    brokers: number;
    assignedBrokers: number;
    customers: number;
    assignedCustomers: number;
  };
};

type Props = {
  dashboardHref?: string;
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalize(value: unknown): string {
  return text(value)
    .toLocaleLowerCase("en")
    .replace(/[.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function brokerMatchesArea(broker: BrokerItem, area: string): boolean {
  const target = normalize(area);
  if (!target) return true;

  return [
    broker.region,
    broker.district,
    broker.ward,
    broker.city,
    broker.location,
    broker.address,
    broker.attendedLocation,
  ]
    .map(normalize)
    .filter(Boolean)
    .some((value) => value === target || value.includes(target) || target.includes(value));
}

function formatDate(value: unknown): string {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });
  const raw = await response.text();
  let result: any = {};

  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`The server returned invalid JSON (${response.status}).`);
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      [result.message, result.details].filter(Boolean).join(" ") ||
        `Request failed (${response.status}).`,
    );
  }

  return result as T;
}

export default function StaffAreaAssignmentsPanel({
  dashboardHref = "/admin/dashboard",
}: Props) {
  const [data, setData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [staffId, setStaffId] = useState("");
  const [area, setArea] = useState("");
  const [brokerSearch, setBrokerSearch] = useState("");
  const [selectedBrokerIds, setSelectedBrokerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("ACTIVE");

  async function load(showLoader = true) {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const result = await requestJson<AssignmentData>(
        "/api/admin/staff-area-assignments",
      );
      setData(result);

      setStaffId((current) => {
        const stillExists = result.staff.some((item) => item.id === current);
        return stillExists ? current : result.staff[0]?.id || "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Staff-area assignments could not be loaded.",
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
    const timer = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const selectedStaff = useMemo(
    () => data?.staff.find((item) => item.id === staffId) ?? null,
    [data, staffId],
  );

  useEffect(() => {
    setArea(text(selectedStaff?.assignedRegion));
    setSelectedBrokerIds([]);
    setBrokerSearch("");
  }, [selectedStaff?.id, selectedStaff?.assignedRegion]);

  const areaBrokers = useMemo(() => {
    const query = normalize(brokerSearch);
    return (data?.brokers ?? []).filter((broker) => {
      if (area && !brokerMatchesArea(broker, area)) return false;
      if (!query) return true;

      return [
        broker.code,
        broker.name,
        broker.businessName,
        broker.phone,
        broker.email,
        broker.region,
        broker.district,
        broker.ward,
        broker.location,
      ]
        .map(normalize)
        .some((value) => value.includes(query));
    });
  }, [area, brokerSearch, data?.brokers]);

  const availableAreaBrokers = useMemo(
    () =>
      areaBrokers.filter(
        (broker) =>
          !broker.activeAssignment || broker.activeAssignment.staffId === staffId,
      ),
    [areaBrokers, staffId],
  );

  const activeBrokerAssignments = useMemo(
    () =>
      (data?.brokerAssignments ?? []).filter((row) =>
        assignmentFilter === "ALL"
          ? true
          : text(row.status).toUpperCase() === assignmentFilter,
      ),
    [assignmentFilter, data?.brokerAssignments],
  );

  const activeCustomerAssignments = useMemo(
    () =>
      (data?.customerAssignments ?? []).filter((row) =>
        assignmentFilter === "ALL"
          ? true
          : text(row.status).toUpperCase() === assignmentFilter,
      ),
    [assignmentFilter, data?.customerAssignments],
  );

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");

    try {
      const result = await requestJson<{ success: true; message: string }>(
        "/api/admin/staff-area-assignments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setMessage(result.message);
      await load(false);
      return true;
    } catch (actionError) {
      setMessage(
        actionError instanceof Error ? actionError.message : "Assignment action failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveArea(event: FormEvent) {
    event.preventDefault();
    if (!staffId || !area.trim()) {
      setMessage("Choose a staff user and enter an area.");
      return;
    }

    await action({ action: "ASSIGN_AREA", staffId, area });
  }

  async function assignSelectedBrokers() {
    if (!staffId || !area.trim()) {
      setMessage("Choose a staff user and area first.");
      return;
    }
    if (!selectedBrokerIds.length) {
      setMessage("Select at least one available broker.");
      return;
    }

    if (
      await action({
        action: "ASSIGN_AREA_BROKERS",
        staffId,
        area,
        brokerIds: selectedBrokerIds,
        notes,
      })
    ) {
      setSelectedBrokerIds([]);
      setNotes("");
    }
  }

  async function assignAllAvailable() {
    if (!staffId || !area.trim()) {
      setMessage("Choose a staff user and area first.");
      return;
    }

    if (
      !window.confirm(
        `Assign every available broker currently matching “${area}” to ${selectedStaff?.name || "this staff user"}?`,
      )
    ) {
      return;
    }

    await action({
      action: "AUTO_ASSIGN_AREA_BROKERS",
      staffId,
      area,
      notes,
    });
  }

  async function releaseArea() {
    if (!staffId || !selectedStaff) return;
    if (
      !window.confirm(
        `Release ${selectedStaff.name}'s area and deactivate all active broker assignments?`,
      )
    ) {
      return;
    }

    if (await action({ action: "RELEASE_STAFF_AREA", staffId })) {
      setArea("");
      setSelectedBrokerIds([]);
    }
  }

  async function assignCustomer(event: FormEvent) {
    event.preventDefault();
    if (!staffId || !customerId) {
      setMessage("Choose both a staff user and customer.");
      return;
    }

    if (
      await action({
        action: "ASSIGN_CUSTOMER",
        staffId,
        customerId,
        notes: customerNotes,
      })
    ) {
      setCustomerId("");
      setCustomerNotes("");
    }
  }

  function toggleBroker(id: string) {
    setSelectedBrokerIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectAllVisible() {
    const ids = availableAreaBrokers.map((item) => item.id);
    setSelectedBrokerIds((current) =>
      ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids])),
    );
  }

  if (loading && !data) {
    return (
      <section className={styles.stateCard}>
        <RefreshCw className={styles.spin} size={30} />
        <h2>Loading staff work areas</h2>
        <p>Reading staff, broker, customer and assignment records from Prisma.</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className={styles.stateCard}>
        <MapPinned size={34} />
        <h2>Staff work areas could not load</h2>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={17} /> Try again
        </button>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className={styles.workspace}>
      <header className={styles.hero}>
        <div className={styles.heroIcon}>
          <MapPinned size={30} />
        </div>
        <div>
          <small>COMPANY ADMIN · STAFF OPERATIONS</small>
          <h1>Staff Work Areas & Broker Assignments</h1>
          <p>
            Assign an operating area to active staff users, filter every broker
            found in that area, and control the brokers or customers each staff
            member can work with.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button type="button" onClick={() => void load(false)} disabled={busy}>
            <RefreshCw size={17} className={busy ? styles.spin : ""} /> Refresh
          </button>
          <Link href={dashboardHref}>Back to dashboard</Link>
        </div>
      </header>

      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.metrics}>
        <Metric icon={<Users />} label="Active staff" value={data.summary.staff} tone="blue" />
        <Metric icon={<MapPin />} label="Known areas" value={data.summary.areas} tone="purple" />
        <Metric icon={<UserCheck />} label="Active brokers" value={data.summary.brokers} tone="green" />
        <Metric icon={<Link2 />} label="Assigned brokers" value={data.summary.assignedBrokers} tone="orange" />
      </div>

      <div className={styles.assignmentGrid}>
        <form className={styles.card} onSubmit={saveArea}>
          <CardTitle
            icon={<MapPin />}
            title="1. Assign staff area"
            text="Only active users whose role is STAFF are listed."
          />

          <label className={styles.field}>
            <span>Staff user</span>
            <select
              required
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
            >
              <option value="">Choose staff</option>
              {data.staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.email}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.selectedStaffCard}>
            <Avatar person={selectedStaff} />
            <div>
              <strong>{selectedStaff?.name || "No staff selected"}</strong>
              <small>{selectedStaff?.email || "Choose an active staff user"}</small>
              <span>
                <Building2 size={13} />
                {selectedStaff?.branch?.name || "No branch"}
              </span>
            </div>
            <em>{selectedStaff?.assignedRegion || "No area"}</em>
          </div>

          <label className={styles.field}>
            <span>Assigned work area</span>
            <input
              required
              list="staff-area-options"
              value={area}
              onChange={(event) => {
                setArea(event.target.value);
                setSelectedBrokerIds([]);
              }}
              placeholder="Example: Kinondoni or Dodoma Urban"
            />
            <datalist id="staff-area-options">
              {data.areas.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <div className={styles.areaSuggestions}>
            {data.areas.slice(0, 10).map((item) => (
              <button
                key={item}
                type="button"
                className={normalize(item) === normalize(area) ? styles.areaActive : ""}
                onClick={() => {
                  setArea(item);
                  setSelectedBrokerIds([]);
                }}
              >
                <MapPin size={13} /> {item}
              </button>
            ))}
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={busy || !staffId || !area.trim()}>
              <CheckCircle2 size={17} /> Save area
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={busy || !staffId || !selectedStaff?.assignedRegion}
              onClick={() => void releaseArea()}
            >
              <Trash2 size={17} /> Release area
            </button>
          </div>
        </form>

        <section className={`${styles.card} ${styles.brokerCard}`}>
          <CardTitle
            icon={<Filter />}
            title="2. Filter and assign area brokers"
            text={`${areaBrokers.length} broker(s) match the selected area; ${availableAreaBrokers.length} are available for this staff user.`}
          />

          <div className={styles.filterBar}>
            <label>
              <Search size={17} />
              <input
                value={brokerSearch}
                onChange={(event) => setBrokerSearch(event.target.value)}
                placeholder="Search broker, code, phone, district or ward..."
              />
            </label>
            <button type="button" onClick={selectAllVisible}>
              {availableAreaBrokers.every((item) => selectedBrokerIds.includes(item.id)) &&
              availableAreaBrokers.length
                ? "Clear visible"
                : "Select visible"}
            </button>
          </div>

          {!area.trim() && (
            <div className={styles.inlineWarning}>
              <MapPin size={19} />
              Enter or select an area to filter the broker directory.
            </div>
          )}

          <div className={styles.brokerList}>
            {areaBrokers.map((broker) => {
              const ownedByAnother =
                broker.activeAssignment && broker.activeAssignment.staffId !== staffId;
              const checked = selectedBrokerIds.includes(broker.id);

              return (
                <label
                  key={broker.id}
                  className={`${styles.brokerRow} ${
                    ownedByAnother ? styles.brokerUnavailable : ""
                  } ${checked ? styles.brokerSelected : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={Boolean(ownedByAnother)}
                    onChange={() => toggleBroker(broker.id)}
                  />
                  <span className={styles.brokerAvatar}>
                    {broker.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{broker.name}</strong>
                    <small>
                      {broker.code} · {broker.phone}
                    </small>
                    <p>
                      <MapPin size={12} />
                      {[broker.region, broker.district, broker.ward, broker.location]
                        .filter(Boolean)
                        .join(" · ") || "No location"}
                    </p>
                  </div>
                  <em>
                    {ownedByAnother
                      ? `Assigned to ${broker.activeAssignment?.staffName}`
                      : broker.activeAssignment?.staffId === staffId
                        ? "Already assigned"
                        : "Available"}
                  </em>
                </label>
              );
            })}

            {!areaBrokers.length && (
              <div className={styles.emptyList}>
                <MapPinned size={27} />
                <strong>No brokers match this area</strong>
                <p>
                  Check the broker region, district, ward, city, location and
                  address fields in Manage Brokers.
                </p>
              </div>
            )}
          </div>

          <label className={styles.field}>
            <span>Assignment notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional route, schedule or responsibility notes"
            />
          </label>

          <div className={styles.formActions}>
            <button
              type="button"
              disabled={busy || !selectedBrokerIds.length}
              onClick={() => void assignSelectedBrokers()}
            >
              <UserCheck size={17} /> Assign selected ({selectedBrokerIds.length})
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy || !area.trim() || !availableAreaBrokers.length}
              onClick={() => void assignAllAvailable()}
            >
              <MapPinned size={17} /> Assign all available
            </button>
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <CardTitle
          icon={<Users />}
          title="3. Assign customer"
          text="Customer assignments remain available alongside area-based broker assignments."
        />
        <form className={styles.customerForm} onSubmit={assignCustomer}>
          <label className={styles.field}>
            <span>Staff user</span>
            <select
              required
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
            >
              <option value="">Choose staff</option>
              {data.staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.assignedRegion || "No area"}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Customer</span>
            <select
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Choose customer</option>
              {data.customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.region || item.address || "No location"}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Notes</span>
            <input
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
              placeholder="Optional customer responsibility note"
            />
          </label>
          <button type="submit" disabled={busy || !staffId || !customerId}>
            <Link2 size={17} /> Assign customer
          </button>
        </form>
      </section>

      <section className={styles.tablesSection}>
        <div className={styles.tableToolbar}>
          <div>
            <small>DATABASE ASSIGNMENT HISTORY</small>
            <h2>Current and previous assignments</h2>
          </div>
          <select
            value={assignmentFilter}
            onChange={(event) => setAssignmentFilter(event.target.value)}
          >
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
            <option value="ALL">All records</option>
          </select>
        </div>

        <AssignmentTable title="Broker assignments">
          <thead>
            <tr>
              <th>#</th>
              <th>Staff</th>
              <th>Assigned area</th>
              <th>Broker</th>
              <th>Broker location</th>
              <th>Started</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeBrokerAssignments.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>
                  <PersonCell person={row.staff} />
                </td>
                <td>
                  <span className={styles.areaBadge}>
                    <MapPin size={13} />
                    {row.assignedArea || row.staff.assignedRegion || "No area"}
                  </span>
                </td>
                <td>
                  <strong>{row.broker?.name || "Broker"}</strong>
                  <small>{row.broker?.phone || row.broker?.code}</small>
                </td>
                <td>
                  {[row.broker?.region, row.broker?.district, row.broker?.ward]
                    .filter(Boolean)
                    .join(" · ") || row.broker?.location || "N/A"}
                </td>
                <td>{formatDate(row.startedAt)}</td>
                <td>
                  <Status value={row.status} />
                </td>
                <td>
                  {text(row.status).toUpperCase() === "ACTIVE" ? (
                    <button
                      type="button"
                      className={styles.removeButton}
                      disabled={busy}
                      onClick={() =>
                        void action({
                          action: "UNASSIGN_BROKER",
                          assignmentId: row.id,
                        })
                      }
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}
            {!activeBrokerAssignments.length && (
              <EmptyRow columns={8} text="No broker assignment records match this filter." />
            )}
          </tbody>
        </AssignmentTable>

        <AssignmentTable title="Customer assignments">
          <thead>
            <tr>
              <th>#</th>
              <th>Staff</th>
              <th>Staff area</th>
              <th>Customer</th>
              <th>Location</th>
              <th>Started</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeCustomerAssignments.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>
                  <PersonCell person={row.staff} />
                </td>
                <td>{row.staff.assignedRegion || "No area"}</td>
                <td>
                  <strong>{row.customer?.name || "Customer"}</strong>
                  <small>{row.customer?.email || row.customer?.phone || ""}</small>
                </td>
                <td>{row.customer?.region || row.customer?.address || "N/A"}</td>
                <td>{formatDate(row.startedAt)}</td>
                <td>
                  <Status value={row.status} />
                </td>
                <td>
                  {text(row.status).toUpperCase() === "ACTIVE" ? (
                    <button
                      type="button"
                      className={styles.removeButton}
                      disabled={busy}
                      onClick={() =>
                        void action({
                          action: "UNASSIGN_CUSTOMER",
                          assignmentId: row.id,
                        })
                      }
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}
            {!activeCustomerAssignments.length && (
              <EmptyRow columns={8} text="No customer assignment records match this filter." />
            )}
          </tbody>
        </AssignmentTable>
      </section>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "blue" | "purple" | "green" | "orange";
}) {
  return (
    <article className={`${styles.metric} ${styles[`metric${tone}`]}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value.toLocaleString()}</strong>
      </div>
    </article>
  );
}

function CardTitle({
  icon,
  title,
  text: description,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.cardTitle}>
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Avatar({ person }: { person?: StaffItem | null }) {
  return (
    <span className={styles.avatar}>
      {person?.profileImageUrl ? (
        <img src={person.profileImageUrl} alt={person.name} />
      ) : (
        text(person?.name).slice(0, 1).toUpperCase() || <Users size={19} />
      )}
    </span>
  );
}

function PersonCell({ person }: { person?: StaffItem | null }) {
  return (
    <div className={styles.personCell}>
      <Avatar person={person} />
      <div>
        <strong>{person?.name || "Staff"}</strong>
        <small>{person?.email || ""}</small>
      </div>
    </div>
  );
}

function Status({ value }: { value: unknown }) {
  const status = text(value).toUpperCase() || "UNKNOWN";
  return (
    <span
      className={`${styles.status} ${
        status === "ACTIVE" ? styles.statusActive : styles.statusInactive
      }`}
    >
      <i /> {status}
    </span>
  );
}

function AssignmentTable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.tableCard}>
      <h3>{title}</h3>
      <div className={styles.tableScroll}>
        <table>{children}</table>
      </div>
    </article>
  );
}

function EmptyRow({ columns, text: label }: { columns: number; text: string }) {
  return (
    <tr>
      <td colSpan={columns}>
        <div className={styles.tableEmpty}>
          <MapPinned size={24} /> {label}
        </div>
      </td>
    </tr>
  );
}
