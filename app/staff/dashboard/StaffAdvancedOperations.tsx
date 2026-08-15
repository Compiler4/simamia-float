"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import LiveMap from "./LiveMap";
import styles from "./StaffAdvancedOperations.module.css";

type ViewName =
  | "funding"
  | "float"
  | "settlement"
  | "proofs"
  | "documents"
  | "expenses"
  | "services"
  | "transactions"
  | "performance"
  | "reports"
  | "attendance"
  | "gps"
  | "travel"
  | "alerts"
  | "notifications";

type Props = {
  initialView?: ViewName;
};

type Data = {
  success: true;
  period: {
    name: string;
    label: string;
    start: string;
    end: string;
  };
  staff: any;
  accountants: any[];
  funding: any[];
  fundingByDay: any[];
  brokers: any[];
  allAssignedBrokers: any[];
  unservedBrokers: any[];
  floats: any[];
  collections: any[];
  deposits: any[];
  expenses: any[];
  proofs: any[];
  services: any[];
  attendance: any[];
  devices: any[];
  pings: any[];
  alerts: any[];
  notifications: any[];
  performance: any[];
  transactions: any[];
  weeklyFolders: any[];
  stats: Record<string, number>;
};


function Icon({ name }: { name: string }) {
  return (
    <span className={`material-symbols-rounded ${styles.icon}`} aria-hidden="true">
      {name}
    </span>
  );
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date());
}

function money(value: unknown): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function date(value: unknown, withTime = false): string {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Africa/Dar_es_Salaam",
  }).format(parsed);
}

function label(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`The server returned invalid JSON (${response.status}).`);
  }
  if (!response.ok || body.success === false) {
    throw new Error(body.message || body.details || `Request failed (${response.status}).`);
  }
  return body as T;
}

async function upload(file: File, kind: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const response = await fetch("/api/staff/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const result = await readResponse<{ success: true; url: string }>(response);
  return result.url;
}

export default function StaffAdvancedOperations({
  initialView = "funding",
}: Props) {
  const [view, setView] = useState<ViewName>(initialView);
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState("DAY");
  const [anchor, setAnchor] = useState(today());
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [openWeek, setOpenWeek] = useState("");

  useEffect(() => {
    setView(initialView);

    if (initialView === "gps") {
      setPeriod("DAY");
      setAnchor(today());
    }
  }, [initialView]);

  useEffect(() => {
    void load(true);
  }, [period, anchor, from, to]);

  useEffect(() => {
    if (view !== "gps") return;

    let activeDay = today();

    const refreshLiveDay = () => {
      const currentDay = today();

      if (currentDay !== activeDay) {
        activeDay = currentDay;
        setPeriod("DAY");
        setAnchor(currentDay);
        return;
      }

      void load(false);
    };

    const timer = window.setInterval(refreshLiveDay, 20_000);
    return () => window.clearInterval(timer);
  }, [view, period, anchor]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        period,
        anchor,
        search,
      });

      if (period === "CUSTOM") {
        query.set("from", from);
        query.set("to", to);
      }
      const response = await fetch(`/api/staff/operations?${query}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const result = await readResponse<Data>(response);
      setData(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Staff operations could not load.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function operation(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/operations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await readResponse<{ success: true; message: string }>(response);
      setMessage(result.message);
      await load();
      return true;
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? requestError.message
          : "The operation failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function legacyAction(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/actions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await readResponse<{ success: true; message: string }>(response);
      setMessage(result.message);
      await load();
      return true;
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? requestError.message
          : "The operation failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  const searchBrokers = useMemo(() => {
    if (!data) return [];
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return data.brokers;
    return data.brokers.filter((broker) => {
      const source = [
        broker.code,
        broker.name,
        broker.businessName,
        broker.phone,
        broker.location,
        broker.region,
        broker.district,
        broker.ward,
        broker.assignedArea,
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => source.includes(term));
    });
  }, [data, search]);

  if (loading && !data) {
    return (
      <section className={styles.loading}>
        <span />
        <h2>Loading staff operations</h2>
        <p>Fetching your own float, cash, proof, GPS and attendance records.</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className={styles.error}>
        <Icon name="error" />
        <h2>Staff operations could not load</h2>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className={styles.workspace}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..700,0..1,-50..200"
      />


      {view === "gps" ? (
        <div className={styles.dailyLiveBar}>
          <span>
            <Icon name="today" />
            <strong>Today only</strong>
            <small>{date(anchor)}</small>
          </span>
          <p>Live Location resets automatically when a new calendar day begins.</p>
          <button type="button" onClick={() => void load(false)} disabled={loading}>
            <Icon name="refresh" />
            Refresh live location
          </button>
        </div>
      ) : (
      <div className={styles.controls}>
        <label>
          <Icon name="calendar_month" />
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
            <option value="YEAR">Year</option>
            <option value="CUSTOM">Custom range</option>
          </select>
        </label>
        {period === "CUSTOM" ? (
          <>
            <label>
              <Icon name="date_range" />
              <input
                aria-label="Custom start date"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              <Icon name="event_available" />
              <input
                aria-label="Custom end date"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            <Icon name="event" />
            <input
              type="date"
              value={anchor}
              onChange={(event) => setAnchor(event.target.value)}
            />
          </label>
        )}
        <label className={styles.search}>
          <Icon name="search" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Type the first 1-2 letters, a word, broker, phone or area..."
          />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh" />
          Refresh
        </button>
      </div>
      )}



      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.content} key={view}>
        {view === "funding" && (
          <FundingView data={data} busy={busy} confirm={operation} />
        )}
        {view === "float" && (
          <FloatView
            data={data}
            brokers={searchBrokers}
            busy={busy}
            action={legacyAction}
            notify={setMessage}
          />
        )}
        {view === "settlement" && (
          <SettlementView
            data={data}
            busy={busy}
            action={legacyAction}
            notify={setMessage}
            preview={setPreviewUrl}
          />
        )}
        {view === "proofs" && (
          <ProofView
            data={data}
            busy={busy}
            operation={operation}
            notify={setMessage}
            preview={setPreviewUrl}
          />
        )}
        {view === "documents" && (
          <DocumentsView
            folders={data.weeklyFolders}
            openWeek={openWeek}
            setOpenWeek={setOpenWeek}
            preview={setPreviewUrl}
          />
        )}
        {view === "expenses" && (
          <ExpenseView
            data={data}
            busy={busy}
            operation={operation}
            notify={setMessage}
            preview={setPreviewUrl}
          />
        )}
        {view === "services" && (
          <ServiceView
            data={data}
            brokers={searchBrokers}
            busy={busy}
            operation={operation}
            notify={setMessage}
          />
        )}
        {view === "transactions" && (
          <TransactionsView rows={data.transactions} preview={setPreviewUrl} />
        )}
        {view === "performance" && <PerformanceView data={data} />}
        {view === "reports" && (
          <ReportsView
            period={period}
            anchor={anchor}
            from={from}
            to={to}
            preview={setPreviewUrl}
          />
        )}
        {view === "attendance" && <AttendanceView rows={data.attendance} />}
        {view === "gps" && (
          <GpsView
            data={data}
            operation={operation}
            busy={busy}
            openService={(broker) => {
              window.sessionStorage.setItem(
                "simamia_selected_broker_customer_id_v4",
                String(broker.id),
              );
              setView("services");
            }}
          />
        )}
        {view === "travel" && <TravelHistoryView data={data} />}
        {view === "alerts" && <AlertsView data={data} />}
        {view === "notifications" && (
          <NotificationsView data={data} operation={operation} />
        )}
      </div>

      {previewUrl && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.modalBackdrop}
            aria-label="Close preview"
            onClick={() => setPreviewUrl("")}
          />
          <section>
            <header>
              <div>
                <strong>Secure preview</strong>
                <small>Review the document or report before printing or exporting. Editing and deleting are disabled.</small>
              </div>
              <button type="button" onClick={() => setPreviewUrl("")}>
                <Icon name="close" />
              </button>
            </header>
            <iframe src={previewUrl} title="Private staff document preview" />
          </section>
        </div>
      )}
    </section>
  );
}

function Metric({
  label: text,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: string;
}) {
  return (
    <article className={styles.metric}>
      <Icon name={icon} />
      <span>
        <small>{text}</small>
        <strong>{value}</strong>
      </span>
    </article>
  );
}

function FundingView({
  data,
  busy,
  confirm,
}: {
  data: Data;
  busy: boolean;
  confirm: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const allFunding = data.funding
    .slice()
    .sort(
      (left, right) =>
        new Date(String(right.issuedAt)).getTime() -
        new Date(String(left.issuedAt)).getTime(),
    );

  const pendingFunding = allFunding.filter(
    (row) => row.status === "PENDING",
  );

  const confirmedFunding = allFunding.filter(
    (row) => row.status === "CONFIRMED",
  );

  const totalIssuedFloat = allFunding.reduce(
    (sum, row) => sum + Number(row.floatAmount || 0),
    0,
  );

  const totalIssuedCash = allFunding.reduce(
    (sum, row) => sum + Number(row.cashAmount || 0),
    0,
  );

  return (
    <Section
      title="Receive and confirm accountant funding"
      subtitle="See every float and cash issue made to your account. Each issue can be confirmed separately, including several issues on the same day."
      icon="account_balance_wallet"
    >
      <div className={styles.fundingSummary}>
        <Metric label="All accountant issues" value={allFunding.length} icon="receipt_long" />
        <Metric label="Awaiting confirmation" value={pendingFunding.length} icon="pending_actions" />
        <Metric label="Issued float" value={money(totalIssuedFloat)} icon="account_balance_wallet" />
        <Metric label="Issued cash" value={money(totalIssuedCash)} icon="payments" />
      </div>

      <Card
        title="Float and cash awaiting confirmation"
        subtitle="Confirm only the issue you actually received from the accountant."
      >
        <div className={styles.list}>
          {pendingFunding.map((row) => (
            <article key={row.id} className={styles.listRow}>
              <span className={styles.roundIcon}><Icon name="payments" /></span>
              <div>
                <strong>{row.referenceNo}</strong>
                <small>{row.accountant?.name || "Accountant"} · {date(row.issuedAt, true)}</small>
                <em>Accountant to staff funding</em>
              </div>
              <span className={styles.amounts}>
                <b>Float {money(row.floatAmount)}</b>
                <b>Cash {money(row.cashAmount)}</b>
              </span>
              <Status value={row.status} />
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm("CONFIRM_FUNDING", { fundingId: row.id })}
              >
                <Icon name="check_circle" /> Confirm received
              </button>
            </article>
          ))}
          {!pendingFunding.length && <Empty text="No float or cash issue is awaiting confirmation." />}
        </div>
      </Card>

      <Card
        title="All float and cash issued by accountants"
        subtitle={`${allFunding.length} funding record(s) in ${data.period.label}. Confirmed and pending records are both shown.`}
      >
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Issue date</th>
                <th>Accountant</th>
                <th>Reference</th>
                <th>Float</th>
                <th>Cash</th>
                <th>Total</th>
                <th>Status</th>
                <th>Confirmed at</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {allFunding.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{date(row.issuedAt, true)}</td>
                  <td>{row.accountant?.name || "Accountant"}</td>
                  <td>{row.referenceNo}</td>
                  <td>{money(row.floatAmount)}</td>
                  <td>{money(row.cashAmount)}</td>
                  <td>{money(Number(row.floatAmount || 0) + Number(row.cashAmount || 0))}</td>
                  <td><Status value={row.status} /></td>
                  <td>{date(row.confirmedAt, true)}</td>
                  <td>
                    {row.status === "PENDING" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void confirm("CONFIRM_FUNDING", { fundingId: row.id })}
                      >
                        <Icon name="check_circle" /> Confirm
                      </button>
                    ) : (
                      <span>Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!allFunding.length && <Empty text="No accountant funding was found in this period." />}
        </div>
      </Card>

      <div className={styles.twoColumns}>
        <Card title="Daily confirmed funding report" subtitle="Automatic totals for every day in the selected period.">
          <div className={styles.dailyGrid}>
            {data.fundingByDay.map((row) => (
              <article key={row.date}>
                <span>{date(row.date)}</span>
                <b>{row.entries} confirmed receipt(s)</b>
                <small>Float {money(row.floatAmount)}</small>
                <small>Cash {money(row.cashAmount)}</small>
                <strong>{money(row.totalAmount)}</strong>
              </article>
            ))}
            {!data.fundingByDay.length && <Empty text="No confirmed funding in this period." />}
          </div>
        </Card>

        <Card title="Confirmation summary" subtitle="Funding is read-only after confirmation.">
          <div className={styles.dailyGrid}>
            <article>
              <span>Confirmed issues</span>
              <b>{confirmedFunding.length}</b>
              <small>Float {money(confirmedFunding.reduce((sum, row) => sum + Number(row.floatAmount || 0), 0))}</small>
              <small>Cash {money(confirmedFunding.reduce((sum, row) => sum + Number(row.cashAmount || 0), 0))}</small>
              <strong>{money(confirmedFunding.reduce((sum, row) => sum + Number(row.floatAmount || 0) + Number(row.cashAmount || 0), 0))}</strong>
            </article>
            <article>
              <span>Pending issues</span>
              <b>{pendingFunding.length}</b>
              <small>Confirm each issue separately</small>
              <small>Several confirmations are allowed per day</small>
              <strong>{money(pendingFunding.reduce((sum, row) => sum + Number(row.floatAmount || 0) + Number(row.cashAmount || 0), 0))}</strong>
            </article>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function FloatView({
  data,
  brokers,
  busy,
  action,
  notify,
}: {
  data: Data;
  brokers: any[];
  busy: boolean;
  action: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  notify: (message: string) => void;
}) {
  const [mode, setMode] = useState<"ISSUE" | "COLLECT">("ISSUE");
  const [form, setForm] = useState({
    brokerCustomerId: "",
    amount: "",
    referenceNo: "",
    purpose: "",
    date: today(),
    receiptUrl: "",
  });
  const [uploading, setUploading] = useState(false);

  async function proof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await upload(file, "PROOF");
      setForm((current) => ({ ...current, receiptUrl: url }));
      notify("Proof uploaded.");
    } catch (uploadError) {
      notify(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok =
      mode === "ISSUE"
        ? await action("ISSUE_FLOAT", {
            brokerCustomerId: form.brokerCustomerId,
            amount: form.amount,
            referenceNo: form.referenceNo,
            purpose: form.purpose || "Float service",
            receiptUrl: form.receiptUrl,
          })
        : await action("RECORD_COLLECTION", {
            brokerCustomerId: form.brokerCustomerId,
            amount: form.amount,
            referenceNo: form.referenceNo,
            collectionDate: form.date,
            description: form.purpose || "Broker cash collection",
            receiptUrl: form.receiptUrl,
          });
    if (ok) {
      setForm({
        brokerCustomerId: "",
        amount: "",
        referenceNo: "",
        purpose: "",
        date: today(),
        receiptUrl: "",
      });
    }
  }

  return (
    <Section
      title="Float operations for assigned brokers"
      subtitle="Search by the first letter, two related letters, word, phone or assigned area."
      icon="swap_horiz"
    >
      <div className={styles.modeButtons}>
        <button type="button" className={mode === "ISSUE" ? styles.modeActive : ""} onClick={() => setMode("ISSUE")}>
          <Icon name="north_east" /> Issue float
        </button>
        <button type="button" className={mode === "COLLECT" ? styles.modeActive : ""} onClick={() => setMode("COLLECT")}>
          <Icon name="south_west" /> Record cash collection
        </button>
      </div>

      <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={submit}>
          <h3>{mode === "ISSUE" ? "Issue float to broker" : "Receive cash from broker"}</h3>
          <Field label="Assigned broker">
            <select
              value={form.brokerCustomerId}
              onChange={(event) => setForm({ ...form, brokerCustomerId: event.target.value })}
              required
            >
              <option value="">Select broker</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.name} · {broker.location || broker.assignedArea}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles.formGrid}>
            <Field label="Amount">
              <input
                type="number"
                min="1"
                required
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </Field>
            <Field label="Reference / transaction ID">
              <input
                value={form.referenceNo}
                onChange={(event) => setForm({ ...form, referenceNo: event.target.value })}
                placeholder="Auto-generated when empty"
              />
            </Field>
          </div>
          {mode === "COLLECT" && (
            <Field label="Collection date">
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
          )}
          <Field label="Purpose or description">
            <textarea
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </Field>
          <UploadField
            url={form.receiptUrl}
            uploading={uploading}
            onChange={proof}
            text="Upload SMS screenshot or receipt"
          />
          <button type="submit" className={styles.primaryButton} disabled={busy || uploading}>
            <Icon name={mode === "ISSUE" ? "send_money" : "payments"} />
            {mode === "ISSUE" ? "Issue float" : "Save collection"}
          </button>
        </form>

        <Card title="Assigned broker directory" subtitle={`${brokers.length} result(s) in your area only.`}>
          <div className={styles.brokerGrid}>
            {brokers.map((broker) => (
              <article key={broker.id}>
                <span>{String(broker.name).slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{broker.businessName || broker.name}</strong>
                  <small>{broker.phone} · {broker.code}</small>
                  <em>{broker.assignedArea || broker.ward || broker.district || broker.location}</em>
                </div>
                <b>{broker.agentAccounts?.length || 0} line(s)</b>
                {broker.agentAccounts?.length > 0 && (
                  <div className={styles.brokerLines}>
                    {broker.agentAccounts.map((line: any) => (
                      <span key={line.id}>
                        <strong>{label(line.network)}</strong>
                        <small>{line.simCardNumber || line.agentNumber || "No line number"}</small>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, brokerCustomerId: broker.id })}
                >
                  Select
                </button>
              </article>
            ))}
            {!brokers.length && (
              <Empty text="No broker matches the search or your assigned area." />
            )}
          </div>
        </Card>
      </div>
    </Section>
  );
}

function SettlementView({
  data,
  busy,
  action,
  notify,
  preview,
}: {
  data: Data;
  busy: boolean;
  action: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  notify: (message: string) => void;
  preview: (url: string) => void;
}) {
  const [mode, setMode] = useState<"ACCOUNTANT" | "BANK">("BANK");
  const [form, setForm] = useState({
    accountantId: "",
    amount: "",
    referenceNo: "",
    bankAccount: "",
    date: today(),
    receiptUrl: "",
  });
  const [uploading, setUploading] = useState(false);

  async function proof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await upload(file, "BANK");
      setForm((current) => ({ ...current, receiptUrl: url }));
      notify("Settlement receipt uploaded.");
    } catch (uploadError) {
      notify(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok =
      mode === "BANK"
        ? await action("DEPOSIT_TO_BANK", {
            amount: form.amount,
            referenceNo: form.referenceNo,
            bankAccount: form.bankAccount,
            depositDate: form.date,
            receiptUrl: form.receiptUrl,
          })
        : await action("RETURN_MONEY", {
            accountantId: form.accountantId,
            amount: form.amount,
            referenceNo: form.referenceNo,
            returnDate: form.date,
            receiptUrl: form.receiptUrl,
          });
    if (ok) {
      setForm({
        accountantId: "",
        amount: "",
        referenceNo: "",
        bankAccount: "",
        date: today(),
        receiptUrl: "",
      });
    }
  }

  return (
    <Section
      title="Deposit to accountant and bank"
      subtitle="Submit settlements and preview only your own private receipts. Verified records remain locked."
      icon="account_balance"
    >
      <div className={styles.modeButtons}>
        <button type="button" className={mode === "ACCOUNTANT" ? styles.modeActive : ""} onClick={() => setMode("ACCOUNTANT")}>
          Return to accountant
        </button>
        <button type="button" className={mode === "BANK" ? styles.modeActive : ""} onClick={() => setMode("BANK")}>
          Deposit to bank
        </button>
      </div>
      <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={submit}>
          <h3>{mode === "BANK" ? "New bank deposit" : "Return money to accountant"}</h3>
          <div className={styles.formGrid}>
            <Field label="Amount">
              <input
                type="number"
                min="1"
                required
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                required
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
          </div>
          {mode === "BANK" ? (
            <Field label="Bank name and account number">
              <input
                required
                value={form.bankAccount}
                onChange={(event) => setForm({ ...form, bankAccount: event.target.value })}
              />
            </Field>
          ) : (
            <Field label="Accountant">
              <select
                required
                value={form.accountantId}
                onChange={(event) => setForm({ ...form, accountantId: event.target.value })}
              >
                <option value="">Select accountant</option>
                {data.accountants.map((accountant) => (
                  <option value={accountant.id} key={accountant.id}>
                    {accountant.name} · {accountant.email}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Reference number">
            <input
              required
              value={form.referenceNo}
              onChange={(event) => setForm({ ...form, referenceNo: event.target.value })}
            />
          </Field>
          <UploadField
            url={form.receiptUrl}
            uploading={uploading}
            onChange={proof}
            text="Upload deposit slip or receipt"
          />
          <button type="submit" className={styles.primaryButton} disabled={busy || uploading}>
            <Icon name="save" />
            Submit settlement
          </button>
        </form>

        <Card title="My submitted deposits" subtitle="Preview only. Staff cannot edit or delete these files.">
          <div className={styles.documentList}>
            {data.deposits.map((row) => (
              <article key={row.id}>
                <Icon name="description" />
                <div>
                  <strong>{row.referenceNo || row.id}</strong>
                  <small>{row.bankAccount} · {date(row.depositDate, true)}</small>
                </div>
                <b>{money(row.amount)}</b>
                <Status value={row.status} />
                {(row.bankReceiptUrl || row.depositSlipUrl) && (
                  <button type="button" onClick={() => preview(row.bankReceiptUrl || row.depositSlipUrl)}>
                    Preview
                  </button>
                )}
              </article>
            ))}
            {!data.deposits.length && <Empty text="No bank deposits in this period." />}
          </div>
        </Card>
      </div>
    </Section>
  );
}


type ParsedSmsTransaction = {
  referenceNo: string;
  transactionId: string;
  senderName: string;
  receiverName: string;
  amount: string;
  transactionAt: string;
  direction: string;
};

function normalisePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("255")) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function toLocalInputDate(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseSmsTransaction(rawText: string, staffName: string): ParsedSmsTransaction {
  const text = rawText.replace(/\s+/g, " ").trim();
  const upper = text.toUpperCase();

  const reference =
    text.match(/\b(?:REF(?:ERENCE)?|KUMBUKUMBU(?:\s+NAMBA)?|MUAMALA(?:\s+NAMBA)?|TRANSACTION(?:\s+ID)?|TXN(?:\s+ID)?|TRX(?:\s+ID)?|ID)\s*[:#-]?\s*([A-Z0-9/_-]{5,})\b/i)?.[1] ||
    text.match(/\b([A-Z0-9]{10,})\b/i)?.[1] ||
    "";

  const amountText =
    text.match(/\b(?:TZS|TSH|T\.SH|SHS?|\/=)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)?.[1] ||
    text.match(/\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:TZS|TSH|T\.SH|SHS?|\/=)\b/i)?.[1] ||
    "";

  const sentMatch = text.match(/\b(?:YOU\s+HAVE\s+)?(?:SENT|TRANSFERRED|PAID|UMETUMA|UMELIPA)\b[\s\S]*?\b(?:TO|KWA|KWENDA)\s+(.+?)(?=\s+(?:REF|REFERENCE|TXN|TRANSACTION|ID|KUMBUKUMBU|MUAMALA|SALIO|BALANCE|TAREHE|ON|AT)\b|$)/i);
  const receivedMatch = text.match(/\b(?:YOU\s+HAVE\s+)?(?:RECEIVED|UMEPOKEA|UMEPATA)\b[\s\S]*?\b(?:FROM|KUTOKA|TOKA)\s+(.+?)(?=\s+(?:REF|REFERENCE|TXN|TRANSACTION|ID|KUMBUKUMBU|MUAMALA|SALIO|BALANCE|TAREHE|ON|AT)\b|$)/i);
  const explicitFromTo = text.match(/\b(?:FROM|KUTOKA)\s+(.+?)\s+(?:TO|KWA|KWENDA)\s+(.+?)(?=\s+(?:REF|REFERENCE|TXN|TRANSACTION|ID|KUMBUKUMBU|MUAMALA|TZS|TSH|T\.SH|SHS?|ON|AT|TAREHE)\b|$)/i);

  let transactionAt = "";
  const dateTimeMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  const dayFirstMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(?:AT|SAA)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?\b/i);

  if (dateTimeMatch) {
    const parsed = new Date(Number(dateTimeMatch[1]), Number(dateTimeMatch[2]) - 1, Number(dateTimeMatch[3]), Number(dateTimeMatch[4]), Number(dateTimeMatch[5]), Number(dateTimeMatch[6] || 0));
    if (!Number.isNaN(parsed.getTime())) transactionAt = toLocalInputDate(parsed);
  } else if (dayFirstMatch) {
    let year = Number(dayFirstMatch[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, Number(dayFirstMatch[2]) - 1, Number(dayFirstMatch[1]), Number(dayFirstMatch[4] || 0), Number(dayFirstMatch[5] || 0), Number(dayFirstMatch[6] || 0));
    if (!Number.isNaN(parsed.getTime())) transactionAt = toLocalInputDate(parsed);
  }

  const isReceived = Boolean(receivedMatch) || /\b(?:RECEIVED|UMEPOKEA|UMEPATA|KUTOKA)\b/i.test(upper);
  const isSent = Boolean(sentMatch) || /\b(?:SENT|TRANSFERRED|PAID|UMETUMA|UMELIPA|KWENDA)\b/i.test(upper);

  return {
    referenceNo: reference.toUpperCase(),
    transactionId: reference.toUpperCase(),
    senderName: explicitFromTo?.[1]?.trim() || receivedMatch?.[1]?.trim() || (isSent ? staffName : ""),
    receiverName: explicitFromTo?.[2]?.trim() || sentMatch?.[1]?.trim() || (isReceived ? staffName : ""),
    amount: amountText.replaceAll(",", ""),
    transactionAt,
    direction: isReceived ? "BROKER_TO_STAFF" : isSent ? "STAFF_TO_BROKER" : "OTHER",
  };
}

function findBrokerForSms(brokers: any[], parsed: ParsedSmsTransaction, smsText: string): string {
  const haystack = [parsed.senderName, parsed.receiverName, smsText].join(" ").toLowerCase();
  const phoneDigits = normalisePhone(smsText);

  const broker = brokers.find((item) => {
    const names = [item.name, item.businessName, item.code]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    const phones = [
      item.phone,
      item.alternatePhone,
      ...(Array.isArray(item.agentAccounts)
        ? item.agentAccounts.flatMap((line: any) => [line.simCardNumber, line.agentNumber])
        : []),
    ]
      .filter(Boolean)
      .map(normalisePhone)
      .filter(Boolean);

    return names.some((name) => name.length >= 3 && haystack.includes(name)) ||
      phones.some((phone) => phone.length >= 7 && phoneDigits.includes(phone));
  });

  return broker ? String(broker.id) : "";
}

function ProofView({
  data,
  busy,
  operation,
  notify,
  preview,
}: {
  data: Data;
  busy: boolean;
  operation: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  notify: (message: string) => void;
  preview: (url: string) => void;
}) {
  const [form, setForm] = useState({
    brokerCustomerId: "",
    serviceVisitId: "",
    direction: "STAFF_TO_BROKER",
    kind: "SMS_SCREENSHOT",
    referenceNo: "",
    transactionId: "",
    senderName: "",
    receiverName: "",
    amount: "",
    transactionAt: new Date().toISOString().slice(0, 16),
    smsText: "",
    proofUrl: "",
  });
  const [uploading, setUploading] = useState(false);
  const [smsAutoFilled, setSmsAutoFilled] = useState(false);

  async function proof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await upload(file, "PROOF");
      setForm((current) => ({ ...current, proofUrl: url }));
      notify("Proof file uploaded. Complete or review the transaction fields.");
    } catch (uploadError) {
      notify(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function applySmsText(text: string, announce = false) {
    const parsed = parseSmsTransaction(text, data.staff?.name || "Staff");
    const brokerCustomerId = findBrokerForSms(data.allAssignedBrokers, parsed, text);
    const hasExtractedData = Boolean(parsed.referenceNo || parsed.senderName || parsed.receiverName || parsed.amount || parsed.transactionAt);

    setForm((current) => ({
      ...current,
      smsText: text,
      referenceNo: parsed.referenceNo || current.referenceNo,
      transactionId: parsed.transactionId || current.transactionId,
      senderName: parsed.senderName || current.senderName,
      receiverName: parsed.receiverName || current.receiverName,
      amount: parsed.amount || current.amount,
      transactionAt: parsed.transactionAt || current.transactionAt,
      direction: parsed.direction !== "OTHER" ? parsed.direction : current.direction,
      brokerCustomerId: brokerCustomerId || current.brokerCustomerId,
    }));

    setSmsAutoFilled(hasExtractedData);

    if (announce) {
      notify(
        hasExtractedData
          ? "SMS details were filled automatically. Review them before submitting."
          : "The SMS was pasted, but some fields could not be recognised. Complete them manually.",
      );
    }
  }

  function handleSmsPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text");
    const target = event.currentTarget;
    const start = target.selectionStart ?? form.smsText.length;
    const end = target.selectionEnd ?? start;
    const nextText = form.smsText.slice(0, start) + pastedText + form.smsText.slice(end);
    applySmsText(nextText, true);
  }

  function extractSmsProof() {
    if (!form.smsText.trim()) {
      notify("Paste the mobile-money SMS first.");
      return;
    }
    applySmsText(form.smsText, true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await operation("SUBMIT_PROOF", form);
    if (ok) {
      setForm({
        brokerCustomerId: "",
        serviceVisitId: "",
        direction: "STAFF_TO_BROKER",
        kind: "SMS_SCREENSHOT",
        referenceNo: "",
        transactionId: "",
        senderName: "",
        receiverName: "",
        amount: "",
        transactionAt: new Date().toISOString().slice(0, 16),
        smsText: "",
        proofUrl: "",
      });
      setSmsAutoFilled(false);
    }
  }

  const selectedBroker = data.allAssignedBrokers.find(
    (broker) => String(broker.id) === form.brokerCustomerId,
  );

  return (
    <Section
      title="SMS and receipt proof verification"
      subtitle="Paste an SMS to fill transaction details automatically. Review the reference, sender, receiver and amount before submitting."
      icon="verified"
    >
      <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={submit}>
          <h3>Submit proof</h3>
          <Field label="Copied SMS text">
            <textarea
              value={form.smsText}
              onPaste={handleSmsPaste}
              onChange={(event) => applySmsText(event.target.value)}
              placeholder="Paste a mobile-money SMS here. Reference, transaction ID, sender, receiver, amount, direction and date are filled automatically when recognised."
            />
          </Field>
          <div className={styles.smsAutoHint}>
            <Icon name={smsAutoFilled ? "auto_awesome" : "content_paste"} />
            <span>{smsAutoFilled ? "SMS fields filled automatically. Check every value before submission." : "Paste the SMS to start automatic extraction."}</span>
            <button type="button" className={styles.locationButton} onClick={extractSmsProof}>
              <Icon name="refresh" /> Re-read SMS
            </button>
          </div>

          <div className={styles.formGrid}>
            <Field label="Direction">
              <select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}>
                <option value="STAFF_TO_BROKER">Staff to broker</option>
                <option value="BROKER_TO_STAFF">Broker to staff</option>
                <option value="ACCOUNTANT_TO_STAFF">Accountant to staff</option>
                <option value="STAFF_TO_ACCOUNTANT">Staff to accountant</option>
                <option value="STAFF_TO_BANK">Staff to bank</option>
                <option value="EXPENSE_PAYMENT">Expense payment</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Proof type">
              <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="SMS_SCREENSHOT">SMS screenshot</option>
                <option value="BANK_SLIP">Bank slip</option>
                <option value="BANK_RECEIPT">Bank receipt</option>
                <option value="SERVICE_PROOF">Service proof</option>
                <option value="EXPENSE_RECEIPT">Expense receipt</option>
                <option value="PDF">PDF</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>
          <div className={styles.formGrid}>
            <Field label="Reference number">
              <input required value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} />
            </Field>
            <Field label="Transaction ID">
              <input value={form.transactionId} onChange={(event) => setForm({ ...form, transactionId: event.target.value })} />
            </Field>
          </div>
          <div className={styles.formGrid}>
            <Field label="Sender">
              <input required value={form.senderName} onChange={(event) => setForm({ ...form, senderName: event.target.value })} />
            </Field>
            <Field label="Receiver">
              <input required value={form.receiverName} onChange={(event) => setForm({ ...form, receiverName: event.target.value })} />
            </Field>
          </div>
          <div className={styles.formGrid}>
            <Field label="Amount">
              <input type="number" min="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Transaction date and time">
              <input type="datetime-local" required value={form.transactionAt} onChange={(event) => setForm({ ...form, transactionAt: event.target.value })} />
            </Field>
          </div>
          <Field label="Assigned broker (optional)">
            <select value={form.brokerCustomerId} onChange={(event) => setForm({ ...form, brokerCustomerId: event.target.value })}>
              <option value="">No broker selected</option>
              {data.allAssignedBrokers.map((broker) => (
                <option value={broker.id} key={broker.id}>{broker.name} · {broker.location}</option>
              ))}
            </select>
          </Field>
          {selectedBroker?.agentAccounts?.length > 0 && (
            <div className={styles.brokerProofLines}>
              <strong>Selected broker network lines</strong>
              <div>
                {selectedBroker.agentAccounts.map((line: any) => (
                  <span key={line.id}>{label(line.network)} · {line.simCardNumber || line.agentNumber || "No line number"}</span>
                ))}
              </div>
              <small>These lines belong to the broker and are shown only for verification. They are not staff SIM cards or filters.</small>
            </div>
          )}
          <Field label="Service visit (optional)">
            <select value={form.serviceVisitId} onChange={(event) => setForm({ ...form, serviceVisitId: event.target.value })}>
              <option value="">No service visit selected</option>
              {data.services.map((visit) => (
                <option value={visit.id} key={visit.id}>{visit.broker?.name || "Broker"} · {date(visit.serviceProvidedAt || visit.startedAt, true)}</option>
              ))}
            </select>
          </Field>
          <UploadField url={form.proofUrl} uploading={uploading} onChange={proof} text="Upload receipt, screenshot or PDF" />
          <button type="submit" className={styles.primaryButton} disabled={busy || uploading}>
            <Icon name="cloud_upload" /> Submit for verification
          </button>
        </form>

        <Card title="My proof submissions" subtitle="Pending, verified or rejected by Company Admin/Accountant.">
          <div className={styles.proofGrid}>
            {data.proofs.map((row) => (
              <article key={row.id}>
                <header>
                  <Icon name={row.kind === "SMS_SCREENSHOT" ? "sms" : "receipt_long"} />
                  <div>
                    <strong>{row.referenceNo}</strong>
                    <small>{date(row.transactionAt, true)}</small>
                  </div>
                  <Status value={row.status} />
                </header>
                <p>{row.senderName} → {row.receiverName}</p>
                {row.smsText && <small className={styles.smsExcerpt}>{row.smsText}</small>}
                <b>{money(row.amount)}</b>
                <footer>
                  <span>{label(row.direction)}</span>
                  {row.proofUrl && <button type="button" onClick={() => preview(row.proofUrl)}>Preview</button>}
                </footer>
                {row.verificationNote && <em>{row.verificationNote}</em>}
              </article>
            ))}
            {!data.proofs.length && <Empty text="No proof has been submitted in this period." />}
          </div>
        </Card>
      </div>
    </Section>
  );
}

function DocumentsView({
  folders,
  openWeek,
  setOpenWeek,
  preview,
}: {
  folders: any[];
  openWeek: string;
  setOpenWeek: (week: string) => void;
  preview: (url: string) => void;
}) {
  return (
    <Section
      title="Weekly receipt and document folders"
      subtitle="All private proofs, deposits and expense receipts are combined by week with automatic totals."
      icon="folder"
    >
      <div className={styles.folderGrid}>
        {folders.map((folder) => {
          const expanded = openWeek === folder.weekKey;
          return (
            <article key={folder.weekKey} className={expanded ? styles.folderOpen : ""}>
              <button
                type="button"
                className={styles.folderHead}
                onClick={() => setOpenWeek(expanded ? "" : folder.weekKey)}
              >
                <span><Icon name={expanded ? "folder_open" : "folder"} /></span>
                <div>
                  <strong>{folder.weekKey}</strong>
                  <small>{folder.documentCount} private document(s)</small>
                </div>
                <b>{money(folder.totalValue)}</b>
                <Icon name={expanded ? "expand_less" : "expand_more"} />
              </button>
              {expanded && (
                <div className={styles.folderBody}>
                  <div className={styles.folderTotals}>
                    <span>Proof value <b>{money(folder.proofValue)}</b></span>
                    <span>Deposit value <b>{money(folder.depositValue)}</b></span>
                    <span>Expense receipts <b>{money(folder.expenseValue)}</b></span>
                  </div>
                  {folder.items.map((item: any) => (
                    <div className={styles.folderItem} key={`${item.source}:${item.id}`}>
                      <Icon name="description" />
                      <span>
                        <strong>{item.reference}</strong>
                        <small>{item.label} · {date(item.date, true)}</small>
                      </span>
                      <b>{money(item.amount)}</b>
                      <Status value={item.status} />
                      {item.url && <button type="button" onClick={() => preview(item.url)}>Preview</button>}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {!folders.length && <Empty text="No weekly documents in the selected period." />}
      </div>
    </Section>
  );
}

function ExpenseView({
  data,
  busy,
  operation,
  notify,
  preview,
}: {
  data: Data;
  busy: boolean;
  operation: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  notify: (message: string) => void;
  preview: (url: string) => void;
}) {
  const [form, setForm] = useState({
    category: "FUEL",
    otherCategory: "",
    requestMode: "REIMBURSEMENT",
    requestedAction: "",
    amount: "",
    expenseDate: today(),
    description: "",
    receiptUrl: "",
  });
  const [uploading, setUploading] = useState(false);

  async function proof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await upload(file, "EXPENSE");
      setForm((current) => ({ ...current, receiptUrl: url }));
      notify("Expense receipt uploaded.");
    } catch (uploadError) {
      notify(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await operation("SUBMIT_EXPENSE_REQUEST", form);
    if (ok) {
      setForm({
        category: "FUEL",
        otherCategory: "",
        requestMode: "REIMBURSEMENT",
        requestedAction: "",
        amount: "",
        expenseDate: today(),
        description: "",
        receiptUrl: "",
      });
    }
  }

  return (
    <Section
      title="Expense requests and achievements"
      subtitle="Add listed or other expenses and request reimbursement, an advance or direct accountant payment."
      icon="receipt_long"
    >
      <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={submit}>
          <h3>New expense request</h3>
          <div className={styles.formGrid}>
            <Field label="Category">
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {["FUEL", "TRANSPORT", "AIRTIME", "ACCOMMODATION", "MEALS", "REPAIR", "OTHER"].map((item) => (
                  <option key={item} value={item}>{label(item)}</option>
                ))}
              </select>
            </Field>
            <Field label="Request mode">
              <select value={form.requestMode} onChange={(event) => setForm({ ...form, requestMode: event.target.value })}>
                <option value="REIMBURSEMENT">Reimbursement</option>
                <option value="ADVANCE_REQUEST">Advance request</option>
                <option value="DIRECT_PAYMENT_REQUEST">Accountant direct payment</option>
              </select>
            </Field>
          </div>
          {form.category === "OTHER" && (
            <Field label="Other expense name">
              <input required value={form.otherCategory} onChange={(event) => setForm({ ...form, otherCategory: event.target.value })} />
            </Field>
          )}
          <div className={styles.formGrid}>
            <Field label="Amount">
              <input type="number" min="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Expense date">
              <input type="date" required value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
            </Field>
          </div>
          <Field label="What should the accountant do?">
            <input value={form.requestedAction} onChange={(event) => setForm({ ...form, requestedAction: event.target.value })} placeholder="Reimburse me, send an advance, pay the supplier..." />
          </Field>
          <Field label="Description">
            <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <UploadField url={form.receiptUrl} uploading={uploading} onChange={proof} text="Upload expense receipt (optional)" />
          <button type="submit" className={styles.primaryButton} disabled={busy || uploading}>
            <Icon name="send" /> Send to accountant
          </button>
        </form>

        <Card title="My expense requests" subtitle="Every completed request requires accountant approval.">
          <div className={styles.documentList}>
            {data.expenses.map((row) => (
              <article key={row.id}>
                <Icon name="receipt_long" />
                <div>
                  <strong>{row.otherCategory || label(row.category)}</strong>
                  <small>{label(row.requestMode)} · {date(row.expenseDate)}</small>
                  <em>{row.description}</em>
                </div>
                <b>{money(row.amount)}</b>
                <Status value={row.status} />
                {row.receiptUrl && <button type="button" onClick={() => preview(row.receiptUrl)}>Preview</button>}
              </article>
            ))}
            {!data.expenses.length && <Empty text="No expense requests in this period." />}
          </div>
        </Card>
      </div>
    </Section>
  );
}

function ServiceView({
  data,
  brokers,
  busy,
  operation,
  notify,
}: {
  data: Data;
  brokers: any[];
  busy: boolean;
  operation: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  notify: (message: string) => void;
}) {
  const [form, setForm] = useState({
    brokerCustomerId: "",
    serviceType: "FLOAT_AND_CASH_SERVICE",
    floatAmount: "",
    cashAmount: "",
    companyIncome: "",
    staffLatitude: "",
    staffLongitude: "",
    brokerLatitude: "",
    brokerLongitude: "",
    locationName: "",
    notes: "",
  });
  const [locating, setLocating] = useState(false);
  const [visitRows, setVisitRows] = useState<any[]>([]);
  const [visitSyncing, setVisitSyncing] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    serviceType: "BROKER_VISIT_SERVICE",
    floatAmount: "",
    cashAmount: "",
    companyIncome: "",
    status: "SERVICE_RECORDED",
    locationName: "",
    notes: "",
  });

  async function loadSyncedVisits() {
    setVisitSyncing(true);
    try {
      const query = new URLSearchParams({
        date: today(),
      });
      const response = await fetch(`/api/staff/service-visits?${query}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const result = await readResponse<{ success: true; visits: any[] }>(response);
      setVisitRows(Array.isArray(result.visits) ? result.visits : []);
    } catch (visitError) {
      console.warn("SERVICE_VISIT_SYNC_FAILED:", visitError);
      setVisitRows(Array.isArray(data.services) ? data.services : []);
    } finally {
      setVisitSyncing(false);
    }
  }

  useEffect(() => {
    void loadSyncedVisits();
  }, []);

  useEffect(() => {
    const refresh = () => void loadSyncedVisits();
    const storageRefresh = (event: StorageEvent) => {
      if (event.key === "simamia_service_visit_updated_at") {
        void loadSyncedVisits();
      }
    };
    const visibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void loadSyncedVisits();
      }
    };

    window.addEventListener("simamia:service-visit-updated", refresh);
    window.addEventListener("storage", storageRefresh);
    document.addEventListener("visibilitychange", visibilityRefresh);

    return () => {
      window.removeEventListener("simamia:service-visit-updated", refresh);
      window.removeEventListener("storage", storageRefresh);
      document.removeEventListener("visibilitychange", visibilityRefresh);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void loadSyncedVisits(), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const selectedId = window.sessionStorage.getItem(
      "simamia_selected_broker_customer_id_v4",
    );
    if (!selectedId) return;
    const broker = brokers.find((item) => String(item.id) === selectedId);
    if (broker) {
      setForm((current) => ({
        ...current,
        brokerCustomerId: String(broker.id),
        brokerLatitude: broker.latitude == null ? current.brokerLatitude : String(broker.latitude),
        brokerLongitude: broker.longitude == null ? current.brokerLongitude : String(broker.longitude),
        locationName: broker.location || broker.assignedArea || current.locationName,
      }));
    }
    window.sessionStorage.removeItem("simamia_selected_broker_customer_id_v4");
  }, [brokers]);

  function startEditVisit(row: any) {
    setEditingVisit(row);
    setEditForm({
      serviceType: String(row.serviceType || "BROKER_VISIT_SERVICE"),
      floatAmount: String(row.floatAmount ?? ""),
      cashAmount: String(row.cashAmount ?? ""),
      companyIncome: String(row.companyIncome ?? ""),
      status: String(row.status || "SERVICE_RECORDED"),
      locationName: String(row.locationName || row.broker?.attendedLocation || row.broker?.location || ""),
      notes: "",
    });
  }

  async function saveEditedVisit(event: FormEvent) {
    event.preventDefault();
    if (!editingVisit) return;
    try {
      const response = await fetch("/api/staff/service-visits", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId: editingVisit.id,
          ...editForm,
        }),
      });
      const result = await readResponse<{ success: true; message: string }>(response);
      notify(result.message);
      setEditingVisit(null);
      window.dispatchEvent(new CustomEvent("simamia:service-visit-updated"));
      await loadSyncedVisits();
    } catch (editError) {
      notify(editError instanceof Error ? editError.message : "The service visit could not be edited.");
    }
  }

  function currentLocation() {
    if (!navigator.geolocation) {
      notify("Geolocation is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          staffLatitude: String(position.coords.latitude),
          staffLongitude: String(position.coords.longitude),
          brokerLatitude: current.brokerLatitude || String(position.coords.latitude),
          brokerLongitude: current.brokerLongitude || String(position.coords.longitude),
        }));
        notify("Current location captured.");
        setLocating(false);
      },
      (locationError) => {
        notify(locationError.message || "Location permission is required.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await operation("RECORD_SERVICE", form);
    if (ok) {
      window.dispatchEvent(new CustomEvent("simamia:service-visit-updated"));
      await loadSyncedVisits();
      setForm({
        brokerCustomerId: "",
        serviceType: "FLOAT_AND_CASH_SERVICE",
        floatAmount: "",
        cashAmount: "",
        companyIncome: "",
        staffLatitude: "",
        staffLongitude: "",
        brokerLatitude: "",
        brokerLongitude: "",
        locationName: "",
        notes: "",
      });
    }
  }

  return (
    <Section
      title="Today's Broker Service Visits"
      subtitle="Live Location updates appear here automatically. Edit service type, float, cash, income, status, location and notes from this section."
      icon="location_on"
    >
      <div className={styles.twoColumns}>
        <form className={styles.formCard} onSubmit={submit}>
          <h3>Update service and location</h3>
          <Field label="Assigned broker">
            <select
              required
              value={form.brokerCustomerId}
              onChange={(event) => {
                const broker = brokers.find((item) => String(item.id) === event.target.value);
                setForm({
                  ...form,
                  brokerCustomerId: event.target.value,
                  brokerLatitude: broker?.latitude == null ? "" : String(broker.latitude),
                  brokerLongitude: broker?.longitude == null ? "" : String(broker.longitude),
                  locationName: broker?.location || broker?.assignedArea || "",
                });
              }}
            >
              <option value="">Select broker</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>{broker.name} · {broker.location}</option>
              ))}
            </select>
          </Field>
          <Field label="Type of service">
            <select
              value={form.serviceType}
              onChange={(event) =>
                setForm({ ...form, serviceType: event.target.value })
              }
            >
              <option value="FLOAT_AND_CASH_SERVICE">Float and cash service</option>
              <option value="FLOAT_SERVICE">Float service</option>
              <option value="CASH_SERVICE">Cash collection or cash service</option>
              <option value="BROKER_SUPPORT">Broker support visit</option>
              <option value="DOCUMENT_COLLECTION">Document or receipt collection</option>
              <option value="OTHER_SERVICE">Other service</option>
            </select>
          </Field>
          <div className={styles.formGrid}>
            <Field label="Float provided">
              <input type="number" min="0" value={form.floatAmount} onChange={(event) => setForm({ ...form, floatAmount: event.target.value })} />
            </Field>
            <Field label="Cash provided/received">
              <input type="number" min="0" value={form.cashAmount} onChange={(event) => setForm({ ...form, cashAmount: event.target.value })} />
            </Field>
          </div>
          <Field label="Company income (optional)">
            <input type="number" min="0" value={form.companyIncome} onChange={(event) => setForm({ ...form, companyIncome: event.target.value })} />
          </Field>
          <button type="button" className={styles.locationButton} onClick={currentLocation} disabled={locating}>
            <Icon name="my_location" />
            {locating ? "Capturing location..." : "Capture current staff and broker location"}
          </button>
          <div className={styles.formGrid}>
            <Field label="Staff latitude">
              <input required value={form.staffLatitude} onChange={(event) => setForm({ ...form, staffLatitude: event.target.value })} />
            </Field>
            <Field label="Staff longitude">
              <input required value={form.staffLongitude} onChange={(event) => setForm({ ...form, staffLongitude: event.target.value })} />
            </Field>
          </div>
          <Field label="Location label">
            <input value={form.locationName} onChange={(event) => setForm({ ...form, locationName: event.target.value })} placeholder="Broker shop, ward or street" />
          </Field>
          <Field label="Communication and service notes">
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            <Icon name="update" /> Update broker location and service
          </button>
        </form>

        <Card title="Today's visited and serviced brokers" subtitle="Auto-filled from today's broker_service_visits records used by Live Locations.">
          <div className={styles.serviceSyncBar}>
            <span>{visitSyncing ? "Synchronising service visits..." : `${visitRows.length} synced visit(s)`}</span>
            <button type="button" onClick={() => void loadSyncedVisits()} disabled={visitSyncing}>
              <Icon name="refresh" /> Refresh visits
            </button>
          </div>
          <div className={styles.serviceList}>
            {visitRows.map((row) => (
              <article key={row.id}>
                <span><Icon name="storefront" /></span>
                <div>
                  <strong>{row.broker?.name || "Broker"}</strong>
                  <small>{date(row.serviceProvidedAt || row.startedAt, true)}</small>
                  <em>{row.communicationNote || row.serviceType}</em>
                </div>
                <b>Float {money(row.floatAmount)}</b>
                <b>Cash {money(row.cashAmount)}</b>
                <Status value={row.status} />
                <button type="button" onClick={() => startEditVisit(row)}>
                  <Icon name="edit" /> Edit
                </button>
              </article>
            ))}
            {!visitRows.length && <Empty text="No broker has been visited or serviced today." />}
          </div>

          {editingVisit && (
            <form className={styles.formCard} onSubmit={saveEditedVisit}>
              <h3>Edit service visit · {editingVisit.broker?.name || "Broker"}</h3>
              <Field label="Service type">
                <select value={editForm.serviceType} onChange={(event) => setEditForm({ ...editForm, serviceType: event.target.value })}>
                  <option value="BROKER_VISIT_SERVICE">Broker visit service</option>
                  <option value="FLOAT_AND_CASH_SERVICE">Float and cash service</option>
                  <option value="FLOAT_SERVICE">Float service</option>
                  <option value="CASH_SERVICE">Cash service</option>
                  <option value="BROKER_SUPPORT">Broker support</option>
                  <option value="DOCUMENT_COLLECTION">Document collection</option>
                  <option value="OTHER_SERVICE">Other service</option>
                </select>
              </Field>
              <div className={styles.formGrid}>
                <Field label="Float"><input type="number" min="0" value={editForm.floatAmount} onChange={(event) => setEditForm({ ...editForm, floatAmount: event.target.value })} /></Field>
                <Field label="Cash"><input type="number" min="0" value={editForm.cashAmount} onChange={(event) => setEditForm({ ...editForm, cashAmount: event.target.value })} /></Field>
              </div>
              <div className={styles.formGrid}>
                <Field label="Company income"><input type="number" min="0" value={editForm.companyIncome} onChange={(event) => setEditForm({ ...editForm, companyIncome: event.target.value })} /></Field>
                <Field label="Visit status">
                  <select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                    <option value="ARRIVED">Arrived</option>
                    <option value="SERVICE_RECORDED">Service recorded</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PROOF_PENDING">Proof pending</option>
                    <option value="LATE_PROOF">Late proof</option>
                  </select>
                </Field>
              </div>
              <Field label="Location label"><input value={editForm.locationName} onChange={(event) => setEditForm({ ...editForm, locationName: event.target.value })} /></Field>
              <Field label="Edit reason / notes"><textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} placeholder="Explain the correction" /></Field>
              <div className={styles.modeButtons}>
                <button type="submit" className={styles.modeActive}><Icon name="save" /> Save changes</button>
                <button type="button" onClick={() => setEditingVisit(null)}><Icon name="close" /> Cancel</button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Section>
  );
}

function TransactionsView({
  rows,
  preview,
}: {
  rows: any[];
  preview: (url: string) => void;
}) {
  return (
    <Section
      title="My transactions"
      subtitle="Only transactions connected to the currently logged-in staff member are displayed."
      icon="list_alt"
    >
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Float</th>
              <th>Cash</th>
              <th>Total</th>
              <th>Proof</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{date(row.date, true)}</td>
                <td>{row.from}</td>
                <td>{row.to}</td>
                <td>{label(row.type)}</td>
                <td>{row.reference}</td>
                <td>{money(row.floatAmount)}</td>
                <td>{money(row.cashAmount)}</td>
                <td><strong>{money(row.amount)}</strong></td>
                <td>{row.proofUrl ? <button type="button" onClick={() => preview(row.proofUrl)}>Preview</button> : "—"}</td>
                <td><Status value={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="No own transactions in this period." />}
      </div>
    </Section>
  );
}

function PerformanceView({ data }: { data: Data }) {
  const latest = data.performance[0] ?? {};
  const proofRate = data.proofs.length
    ? (data.proofs.filter((row) => row.status === "VERIFIED").length / data.proofs.length) * 100
    : 0;
  const attendanceChecks = data.attendance.length * 2;
  const completedChecks = data.attendance.reduce(
    (sum, row) => sum + Number(Boolean(row.checkInAt)) + Number(Boolean(row.checkOutAt)),
    0,
  );
  const attendanceRate = attendanceChecks ? (completedChecks / attendanceChecks) * 100 : 0;

  return (
    <Section
      title="Own performance"
      subtitle="Calculated only from this staff member's service, proof, attendance and GPS records."
      icon="monitoring"
    >
      <div className={styles.performanceGrid}>
        <PerformanceCard title="Attendance journey" value={attendanceRate} note={`${completedChecks}/${attendanceChecks} morning/evening checks`} />
        <PerformanceCard title="Proof verification" value={proofRate} note={`${data.stats.verifiedProofs} verified proof(s)`} />
        <PerformanceCard title="GPS compliance" value={Number(latest.gpsComplianceRate || (data.pings.length ? 100 : 0))} note={`${data.stats.distanceKm} km recorded`} />
        <PerformanceCard title="Deposit accuracy" value={Number(latest.depositAccuracyRate || 0)} note={`${data.deposits.filter((row) => row.status === "VERIFIED").length} verified deposits`} />
      </div>
      <div className={styles.performanceSummary}>
        <Metric label="Brokers serviced" value={data.services.length} icon="storefront" />
        <Metric label="Service float" value={money(data.stats.totalServiceFloat)} icon="account_balance_wallet" />
        <Metric label="Service cash" value={money(data.stats.totalServiceCash)} icon="payments" />
        <Metric label="Pending reminders" value={data.stats.unservedBrokers} icon="notification_important" />
      </div>
    </Section>
  );
}

function PerformanceCard({
  title,
  value,
  note,
}: {
  title: string;
  value: number;
  note: string;
}) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <article>
      <div className={styles.gauge} style={{ background: `conic-gradient(#0a8f69 ${safe}%, #e2ece8 ${safe}% 100%)` }}>
        <span>{Math.round(safe)}%</span>
      </div>
      <strong>{title}</strong>
      <small>{note}</small>
    </article>
  );
}

function ReportsView({
  period,
  anchor,
  from,
  to,
  preview,
}: {
  period: string;
  anchor: string;
  from: string;
  to: string;
  preview: (url: string) => void;
}) {
  const query = new URLSearchParams({ period, anchor });
  if (period === "CUSTOM") {
    query.set("from", from);
    query.set("to", to);
  }
  const pdf = `/api/staff/operations/report?${query}&format=pdf`;
  const grand = `/api/staff/operations/report?${query}&format=pdf&appendProofs=1`;
  const csv = `/api/staff/operations/report?${query}&format=csv`;

  return (
    <Section
      title="Staff-only grand reports"
      subtitle="Preview the selected period before exporting PDF, grand PDF, CSV or printing."
      icon="picture_as_pdf"
    >
      <div className={styles.reportPreviewPanel}>
        <div>
          <Icon name="preview" />
          <span>
            <strong>Review before export</strong>
            <small>
              Open the report preview first, confirm the period and records, then export.
            </small>
          </span>
        </div>
        <button type="button" onClick={() => preview(pdf)}>
          <Icon name="visibility" />
          Preview report
        </button>
      </div>

      <div className={styles.reportGrid}>
        <ReportCard
          icon="picture_as_pdf"
          title="PDF report"
          note="Summary and staff transaction statement"
          href={pdf}
          onPreview={() => preview(pdf)}
        />
        <ReportCard
          icon="folder_zip"
          title="Grand PDF + proofs"
          note="Statement followed by uploaded PDF/image proofs"
          href={grand}
          onPreview={() => preview(grand)}
        />
        <ReportCard
          icon="table_view"
          title="CSV export"
          note="Open in Excel or another spreadsheet tool"
          href={csv}
        />
        <article className={styles.reportCard}>
          <Icon name="print" />
          <strong>Print report</strong>
          <small>Preview the PDF, then use the browser print control.</small>
          <div className={styles.reportCardActions}>
            <button type="button" onClick={() => preview(pdf)}>
              <Icon name="visibility" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => window.open(pdf, "_blank", "noopener,noreferrer")}
            >
              <Icon name="print" />
              Print
            </button>
          </div>
        </article>
      </div>
    </Section>
  );
}

function ReportCard({
  icon,
  title,
  note,
  href,
  onPreview,
}: {
  icon: string;
  title: string;
  note: string;
  href: string;
  onPreview?: () => void;
}) {
  return (
    <article className={styles.reportCard}>
      <Icon name={icon} />
      <strong>{title}</strong>
      <small>{note}</small>
      <div className={styles.reportCardActions}>
        {onPreview && (
          <button type="button" onClick={onPreview}>
            <Icon name="visibility" />
            Preview
          </button>
        )}
        <a href={href} target="_blank" rel="noreferrer">
          <Icon name="download" />
          Export
        </a>
      </div>
    </article>
  );
}

function AttendanceView({ rows }: { rows: any[] }) {
  return (
    <Section
      title="My attendance journey"
      subtitle="Read-only accountant-verified attendance. ✓ and ✕ are shown only after the accountant conducts and verifies the register."
      icon="event_available"
    >
      <div className={styles.attendanceGrid}>
        {rows.map((row) => (
          <article key={row.id}>
            <header>
              <strong>{date(row.date)}</strong>
              <Status value={row.status} />
            </header>
            <div>
              <AttendanceBox title="Morning arrival" present={Boolean(row.checkInAt)} time={row.checkInAt} />
              <AttendanceBox title="Evening departure" present={Boolean(row.checkOutAt)} time={row.checkOutAt} />
            </div>
            <small>{row.notes || "Verified by the accountant."}</small>
          </article>
        ))}
        {!rows.length && <Empty text="No attendance records in this period." />}
      </div>
    </Section>
  );
}

function AttendanceBox({
  title,
  present,
  time,
}: {
  title: string;
  present: boolean;
  time: unknown;
}) {
  return (
    <span className={present ? styles.presentBox : styles.absentBox}>
      <b>{present ? "✓" : "✕"}</b>
      <em>{title}</em>
      <small>{present ? date(time, true) : "Not recorded"}</small>
    </span>
  );
}

function GpsView({
  data,
  operation,
  busy,
  openService,
}: {
  data: Data;
  operation: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  openService: (broker: any) => void;
}) {
  const staffPoint = data.devices
    .filter((device) => Number.isFinite(Number(device.lastLatitude)) && Number.isFinite(Number(device.lastLongitude)))
    .slice(0, 1)
    .map((device) => ({
      latitude: Number(device.lastLatitude),
      longitude: Number(device.lastLongitude),
      label: data.staff?.name || "Staff",
      subtitle: `Staff live location · ${device.name}`,
      capturedAt: device.lastSeenAt,
      type: "staff" as const,
    }));

  const brokerPoints = data.allAssignedBrokers
    .filter((broker) => Number.isFinite(Number(broker.latitude)) && Number.isFinite(Number(broker.longitude)))
    .map((broker) => ({
      latitude: Number(broker.latitude),
      longitude: Number(broker.longitude),
      label: broker.name,
      subtitle: `Broker · ${broker.location || broker.assignedArea}`,
      capturedAt: broker.attendedDate,
      type: "broker" as const,
    }));

  return (
    <Section
      title="Live staff and broker locations"
      subtitle="Today only. Green pointer: staff. Purple pointer: assigned broker. Travel lines are shown only in Travel History."
      icon="my_location"
    >
      <div className={styles.gpsHeader}>
        <Metric label="Travel distance" value={`${data.stats.distanceKm} km`} icon="route" />
        <Metric label="GPS points" value={data.pings.length} icon="radar" />
        <Metric label="Unserved brokers" value={data.unservedBrokers.length} icon="storefront" />
        <button type="button" disabled={busy} onClick={() => void operation("CHECK_MISSED_BROKERS", {})}>
          <Icon name="notification_important" /> Check missed brokers
        </button>
      </div>
      <div className={styles.mapCard}>
        <LiveMap points={[...staffPoint, ...brokerPoints]} height={520} />
      </div>
      <div className={styles.unservedGrid}>
        {data.allAssignedBrokers.map((broker) => {
          const latestVisit = data.services.find(
            (visit) => String(visit.brokerCustomerId) === String(broker.id),
          );
          const serviced = Boolean(
            latestVisit &&
              !["STARTED", "ARRIVED", "CANCELLED"].includes(
                String(latestVisit.status),
              ),
          );

          return (
            <article key={broker.id}>
              <Icon name="storefront" />
              <div>
                <strong>{broker.name}</strong>
                <small>{broker.location || broker.assignedArea}</small>
                {latestVisit && (
                  <em>
                    {latestVisit.serviceType
                      ? label(latestVisit.serviceType)
                      : "Arrival detected"}
                    {" · "}
                    Float {money(latestVisit.floatAmount)}
                    {" · "}
                    Cash {money(latestVisit.cashAmount)}
                  </em>
                )}
              </div>
              <Status value={serviced ? "SERVICED" : latestVisit ? latestVisit.status : "NOT_SERVICED"} />
              <button type="button" onClick={() => openService(broker)}>
                <Icon name="edit_location_alt" />
                {serviced ? "Update again" : "Update service"}
              </button>
            </article>
          );
        })}
        {!data.allAssignedBrokers.length && (
          <Empty text="No assigned brokers are available for this staff account." />
        )}
      </div>
    </Section>
  );
}

function TravelHistoryView({ data }: { data: Data }) {
  function routeDistance(
    first: { latitude: number; longitude: number },
    second: { latitude: number; longitude: number },
  ) {
    const radius = 6_371_000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const lat1 = toRadians(first.latitude);
    const lat2 = toRadians(second.latitude);
    const deltaLat = toRadians(second.latitude - first.latitude);
    const deltaLng = toRadians(second.longitude - first.longitude);
    const value =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function routeDistanceLabel(metres: number) {
    if (!Number.isFinite(metres) || metres <= 0) return "0 m";
    if (metres < 1000) return `${Math.round(metres)} m`;
    return `${(metres / 1000).toFixed(metres >= 10_000 ? 1 : 2)} km`;
  }

  const history = data.pings
    .filter(
      (ping) =>
        Number.isFinite(Number(ping.latitude)) &&
        Number.isFinite(Number(ping.longitude)),
    )
    .map((ping, sourceIndex) => ({
      id: String(
        ping.id ??
          `${ping.capturedAt || "time"}:${ping.latitude}:${ping.longitude}:${sourceIndex}`,
      ),
      latitude: Number(ping.latitude),
      longitude: Number(ping.longitude),
      label: data.staff?.name || "Staff route",
      subtitle: `${Math.round(Number(ping.speedKph || 0))} km/h`,
      capturedAt: ping.capturedAt,
      type: "history" as const,
    }));

  let runningDistance = 0;
  const enrichedHistory = history.map((point, index) => {
    const previous = index > 0 ? history[index - 1] : null;
    const segmentMetres = previous
      ? routeDistance(previous, point)
      : 0;
    runningDistance += segmentMetres;
    const totalMetres = runningDistance;

    return {
      ...point,
      label: `Stop ${index + 1}`,
      subtitle: `${date(point.capturedAt, true)} - segment ${routeDistanceLabel(segmentMetres)} - total ${routeDistanceLabel(totalMetres)}`,
      segmentMetres,
      totalMetres,
    };
  });

  const latest = enrichedHistory.length ? [enrichedHistory[enrichedHistory.length - 1]] : [];
  const totalMetres = enrichedHistory.at(-1)?.totalMetres ?? 0;
  const averageSpeed =
    history.length > 1
      ? history.reduce((sum, point) => {
          const match = data.pings.find((ping) => String(ping.capturedAt) === String(point.capturedAt));
          return sum + Number(match?.speedKph || 0);
        }, 0) / history.length
      : 0;

  return (
    <Section
      title="Travel history"
      subtitle="The dotted route appears only here and follows the selected day, week, month or year."
      icon="route"
    >
      <div className={styles.travelSummary}>
        <Metric label="Distance covered" value={routeDistanceLabel(totalMetres || Number(data.stats.distanceKm || 0) * 1000)} icon="route" />
        <Metric label="GPS points" value={history.length} icon="radar" />
        <Metric label="Average speed" value={`${Math.round(averageSpeed)} km/h`} icon="speed" />
        <Metric label="Period" value={data.period.label} icon="calendar_month" />
      </div>
      <div className={styles.mapCard}>
        <LiveMap points={latest} history={enrichedHistory} height={560} />
      </div>
      <div className={styles.travelRouteStrip}>
        <span>
          <Icon name="timeline" />
          Dotted GPS route with numbered stops
        </span>
        <strong>{routeDistanceLabel(totalMetres || Number(data.stats.distanceKm || 0) * 1000)} covered</strong>
      </div>
      <div className={styles.travelRecords}>
        {enrichedHistory
          .slice()
          .reverse()
          .slice(0, 80)
          .map((point, index) => (
            <article key={`${point.id}:${index}`}>
              <Icon name="location_on" />
              <span>
                <strong>
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </strong>
                <small>{date(point.capturedAt, true)}</small>
              </span>
              <b>{routeDistanceLabel(point.segmentMetres)}</b>
              <em>{routeDistanceLabel(point.totalMetres)} total</em>
            </article>
          ))}
        {!history.length && <Empty text="No GPS travel points were recorded for this period." />}
      </div>
    </Section>
  );
}

function AlertsView({ data }: { data: Data }) {
  return (
    <Section
      title="GPS and broker service alerts"
      subtitle="Reminders for offline GPS, disabled location, assigned-area issues and forgotten brokers."
      icon="warning"
    >
      <div className={styles.alertGrid}>
        {data.alerts.map((row) => (
          <article key={row.id}>
            <Icon name="warning" />
            <div>
              <strong>{row.title}</strong>
              <p>{row.message}</p>
              <small>{date(row.createdAt, true)}</small>
            </div>
            <Status value={row.status} />
          </article>
        ))}
        {data.unservedBrokers.map((broker) => (
          <article key={`missed:${broker.id}`}>
            <Icon name="notification_important" />
            <div>
              <strong>Broker still requires service</strong>
              <p>{broker.name} · {broker.location || broker.assignedArea}</p>
              <small>Selected period</small>
            </div>
            <Status value="OPEN" />
          </article>
        ))}
        {!data.alerts.length && !data.unservedBrokers.length && <Empty text="No GPS or service alerts." />}
      </div>
    </Section>
  );
}

function NotificationsView({
  data,
  operation,
}: {
  data: Data;
  operation: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <Section
      title="My notifications"
      subtitle="Only activities relevant to the STAFF role or this specific user are shown."
      icon="notifications"
    >
      <div className={styles.notificationList}>
        {data.notifications.map((row) => (
          <button
            type="button"
            key={row.id}
            className={row.isRead ? styles.readNotification : ""}
            onClick={() => !row.isRead && void operation("MARK_NOTIFICATION_READ", { notificationId: row.id })}
          >
            <Icon name={row.type === "WARNING" ? "warning" : row.type === "ERROR" ? "error" : "notifications"} />
            <span>
              <strong>{row.title}</strong>
              <small>{row.message}</small>
              <em>{date(row.createdAt, true)}</em>
            </span>
            {!row.isRead && <b>NEW</b>}
          </button>
        ))}
        {!data.notifications.length && <Empty text="No notifications are available." />}
      </div>
    </Section>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span><Icon name={icon} /></span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.card}>
      <header>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>
      {children}
    </article>
  );
}

function Field({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{text}</span>
      {children}
    </label>
  );
}

function UploadField({
  url,
  uploading,
  onChange,
  text,
}: {
  url: string;
  uploading: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  text: string;
}) {
  return (
    <label className={styles.upload}>
      <Icon name={url ? "check_circle" : "cloud_upload"} />
      <span>
        <strong>{uploading ? "Uploading..." : url ? "File ready" : text}</strong>
        <small>JPG, PNG, WEBP or PDF · private compressed storage</small>
      </span>
      <input type="file" accept="image/*,application/pdf" onChange={onChange} disabled={uploading} />
    </label>
  );
}

function Status({ value }: { value: unknown }) {
  const text = String(value || "UNKNOWN").toUpperCase();
  return (
    <span className={`${styles.status} ${styles[`status${text}`] || ""}`}>
      {label(text)}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className={styles.empty}>
      <Icon name="inbox" />
      <span>{text}</span>
    </div>
  );
}
