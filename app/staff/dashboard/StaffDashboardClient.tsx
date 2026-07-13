"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import LiveMap from "./LiveMap";
import styles from "./StaffDashboard.module.css";

type Props = {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    roleLabel: string;
    companyId: string | null;
  };
};

type PageKey =
  | "Dashboard"
  | "Receive & Confirm Float"
  | "Issue Float to Brokers"
  | "Receive Collections"
  | "Return Money"
  | "Deposit to Accountant"
  | "Deposit to Bank"
  | "Upload Proof of Payment"
  | "Bank Verification"
  | "Expense Management"
  | "Service Visits"
  | "Assigned Transactions"
  | "Transaction History"
  | "Own Performance"
  | "Reports"
  | "Attendance"
  | "Live Locations"
  | "Travel History"
  | "GPS Alerts"
  | "Notifications"
  | "Profile";

type DashboardData = {
  success: boolean;
  staff: any;
  company: any;
  brokers: any[];
  accountants: any[];
  customers: any[];
  assignments?: { brokerCount: number; customerCount: number };
  floats: any[];
  collections: any[];
  deposits: any[];
  expenses: any[];
  attendance: any[];
  notifications: any[];
  services: any[];
  devices: any[];
  liveLocations: any[];
  gpsAlerts: any[];
  currentFinancialDay: any;
  latestPerformanceRecords: any[];
  currentPerformance: Record<string, any>;
  ranking: any[];
  brokerStats: any[];
  customerStats: any[];
  assignedTransactions: any[];
  dailyTransactions: any[];
  dailyDeposits: any[];
  dailyFlowSeries: any[];
  reportSummary: Record<string, any>;
  reportRows: any[];
  flowSeries: any[];
  financialHold: any | null;
  stats: Record<string, number>;
};

type UploadClientKind = "receipt" | "profile" | "proof" | "expense" | "bank" | "other";

type IconName =
  | "grid" | "wallet" | "receive" | "confirm" | "send" | "collection" | "return"
  | "accountant" | "bank" | "upload" | "verify" | "expense" | "visit" | "transactions"
  | "history" | "performance" | "report" | "attendance" | "location" | "route" | "alert"
  | "bell" | "user" | "menu" | "refresh" | "logout" | "search" | "check" | "x"
  | "calendar" | "download" | "document" | "arrow" | "plus" | "filter";

const nav: Array<{ page: PageKey; group: string; icon: IconName }> = [
  { page: "Dashboard", group: "Overview", icon: "grid" },
  { page: "Receive & Confirm Float", group: "Morning Float", icon: "confirm" },
  { page: "Issue Float to Brokers", group: "Float Operations", icon: "send" },
  { page: "Receive Collections", group: "Float Operations", icon: "collection" },
  { page: "Return Money", group: "Float Operations", icon: "return" },
  { page: "Deposit to Accountant", group: "Settlement", icon: "accountant" },
  { page: "Deposit to Bank", group: "Settlement", icon: "bank" },
  { page: "Upload Proof of Payment", group: "Settlement", icon: "upload" },
  { page: "Bank Verification", group: "Settlement", icon: "verify" },
  { page: "Expense Management", group: "Operations", icon: "expense" },
  { page: "Service Visits", group: "Operations", icon: "visit" },
  { page: "Assigned Transactions", group: "Records", icon: "transactions" },
  { page: "Transaction History", group: "Records", icon: "history" },
  { page: "Own Performance", group: "Analytics", icon: "performance" },
  { page: "Reports", group: "Analytics", icon: "report" },
  { page: "Attendance", group: "Analytics", icon: "attendance" },
  { page: "Live Locations", group: "GPS Tracking", icon: "location" },
  { page: "Travel History", group: "GPS Tracking", icon: "route" },
  { page: "GPS Alerts", group: "GPS Tracking", icon: "alert" },
  { page: "Notifications", group: "Account", icon: "bell" },
  { page: "Profile", group: "Account", icon: "user" },
];

const topTabs: Array<{ label: string; page: PageKey }> = [
  { label: "Dashboard", page: "Dashboard" },
  { label: "Operations", page: "Issue Float to Brokers" },
  { label: "Analytics", page: "Own Performance" },
  { label: "Finance", page: "Bank Verification" },
  { label: "Documents", page: "Reports" },
];

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></>,
    receive: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    confirm: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    collection: <><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></>,
    return: <><path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 5 5v2"/></>,
    accountant: <><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="M18 8h4M20 6v4"/></>,
    bank: <><path d="m3 10 9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/></>,
    verify: <><path d="M4 7h16v12H4z"/><path d="M8 11h8M8 15h5"/><path d="m15 4 2 2 4-4"/></>,
    expense: <><path d="M6 2h12v20H6z"/><path d="M9 7h6M9 11h6M9 15h3"/></>,
    visit: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
    transactions: <><path d="M7 7h14l-3-3M17 17H3l3 3"/></>,
    history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M3 4v5h5"/></>,
    performance: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    report: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>,
    attendance: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 14l2 2 5-5"/></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
    route: <><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19c7 0 1-14 8-14"/></>,
    alert: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    refresh: <><path d="M20 6v6h-6"/><path d="M4 18v-6h6"/><path d="M6.5 8A7 7 0 0 1 20 12M17.5 16A7 7 0 0 1 4 12"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h6v18h-6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></>,
    document: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function arr<T>(value: unknown): T[] { return Array.isArray(value) ? value : []; }
function money(value: unknown) { return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function date(value: unknown, time = false) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-TZ", { day: "2-digit", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Africa/Dar_es_Salaam" }).format(d);
}
function today() { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Dar_es_Salaam" }).format(new Date()); }
function label(value: unknown) { return String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

async function compressImageInBrowser(
  file: File,
  kind: UploadClientKind,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = kind === "profile" ? 720 : 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", kind === "profile" ? 0.78 : 0.82),
  );

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

async function requestJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...options });
  const text = await response.text();
  let result: any = {};
  try { result = text ? JSON.parse(text) : {}; } catch { throw new Error(`Server returned invalid JSON (${response.status}).`); }
  if (!response.ok || result.success === false) throw new Error(result.message || "The request failed.");
  return result as T;
}

export default function StaffDashboardClient({ user }: Props) {
  const router = useRouter();
  const [page, setPage] = useState<PageKey>("Dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("DAY");
  const [anchor, setAnchor] = useState(today());

  const unread = arr<any>(data?.notifications).filter((item) => !item.isRead).length;

  useEffect(() => { void load(true); }, []);
  useEffect(() => {
    if (page === "Reports" || page === "Own Performance" || page === "Transaction History") void load(false);
  }, [period, anchor]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function load(show = false) {
    if (show) setLoading(true);
    setError("");
    try {
      setData(await requestJson<DashboardData>(`/api/staff/dashboard?period=${period}&date=${anchor}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Staff dashboard could not load.");
    } finally { setLoading(false); }
  }

  async function action(name: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const result = await requestJson<{ success: true; message: string }>("/api/staff/actions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...payload }),
      });
      setToast(result.message);
      await load(false);
      return true;
    } catch (e) { setToast(e instanceof Error ? e.message : "Action failed."); return false; }
    finally { setBusy(false); }
  }

  async function upload(
    file: File,
    kind: UploadClientKind = "receipt",
  ) {
    const prepared = await compressImageInBrowser(file, kind);
    const form = new FormData();
    form.append("file", prepared);
    form.append("kind", kind);

    const result = await requestJson<{
      success: true;
      url: string;
      message?: string;
    }>("/api/staff/upload", {
      method: "POST",
      body: form,
    });

    if (result.message) setToast(result.message);
    return result.url;
  }

  function open(next: PageKey) { setPage(next); setMobileOpen(false); setNoticeOpen(false); }
  function runSearch() {
    const q = search.trim().toLowerCase();
    const found = nav.find((item) => item.page.toLowerCase().includes(q));
    if (!found) return setToast(`No staff section matched “${search}”.`);
    open(found.page); setSearch("");
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }

  return (
    <main className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      <button className={`${styles.backdrop} ${mobileOpen ? styles.backdropVisible : ""}`} onClick={() => setMobileOpen(false)} aria-label="Close menu" />
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.logo}><span><Icon name="wallet" size={24}/></span><div><strong>Simamia Float</strong><small>Staff Officer Portal</small></div><em>LIVE</em></div>
        <button className={styles.collapse} onClick={() => setCollapsed((v) => !v)}><Icon name="menu"/><span>{collapsed ? "Expand" : "Collapse menu"}</span></button>
        <nav>
          {Array.from(new Set(nav.map((item) => item.group))).map((group) => <section key={group}>
            <small>{group}</small>
            {nav.filter((item) => item.group === group).map((item) => <button key={item.page} className={page === item.page ? styles.activeNav : ""} onClick={() => open(item.page)} title={item.page}>
              <i><Icon name={item.icon}/></i><span>{item.page}</span>{item.page === "Notifications" && unread > 0 && <b>{unread}</b>}
            </button>)}
          </section>)}
        </nav>
        <button className={styles.logout} onClick={logout}><Icon name="logout"/><span>Logout</span></button>
      </aside>

      <section className={styles.workspace}>
        <div className={styles.topTabs}>{topTabs.map((item) => <button key={item.label} className={page === item.page ? styles.activeTopTab : ""} onClick={() => open(item.page)}>{item.label}</button>)}</div>
        <header className={styles.topbar}>
          <button className={styles.mobileMenu} onClick={() => setMobileOpen(true)}><Icon name="menu"/></button>
          <div className={styles.heading}><small>{data?.company?.name || "Float operations"}</small><h1>{page}</h1></div>
          <div className={styles.search}><Icon name="search" size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Search transactions, brokers, sections..." /></div>
          <button className={styles.roundButton} onClick={() => void load(false)} title="Refresh"><Icon name="refresh"/></button>
          <button className={styles.roundButton} onClick={() => setNoticeOpen((v) => !v)} title="Notifications"><Icon name="bell"/>{unread > 0 && <b>{unread}</b>}</button>
          <button className={styles.profileChip} onClick={() => open("Profile")}><Avatar person={data?.staff || user}/><span><strong>{user.name}</strong><small>{user.email}</small></span><Icon name="arrow" size={15}/></button>
          {noticeOpen && data && <NotificationPopup rows={data.notifications} onRead={(id) => action("MARK_NOTIFICATION_READ", { notificationId: id })} openAll={() => open("Notifications")} />}
        </header>

        {toast && <div className={styles.toast}>{toast}</div>}
        {loading ? <Loading/> : error ? <ErrorState text={error} retry={() => void load(true)}/> : data ?
          <div className={styles.reveal} key={page}><PageContent page={page} data={data} busy={busy} action={action} upload={upload} open={open} notify={setToast} period={period} setPeriod={setPeriod} anchor={anchor} setAnchor={setAnchor} reload={() => load(false)} /></div> : null}
      </section>
    </main>
  );
}

function PageContent(props: {
  page: PageKey; data: DashboardData; busy: boolean;
  action: (name: string, payload?: Record<string, unknown>) => Promise<boolean>;
  upload: (file: File, kind?: UploadClientKind) => Promise<string>;
  open: (page: PageKey) => void; notify: (text: string) => void;
  period: string; setPeriod: (value: string) => void; anchor: string; setAnchor: (value: string) => void; reload: () => Promise<void>;
}) {
  const common = { data: props.data, busy: props.busy, action: props.action, upload: props.upload, notify: props.notify };
  switch (props.page) {
    case "Receive & Confirm Float": return <ReceiveFloatPage {...common}/>;
    case "Issue Float to Brokers": return <IssueFloatPage {...common}/>;
    case "Receive Collections": return <CollectionsPage {...common}/>;
    case "Return Money": case "Deposit to Accountant": return <ReturnMoneyPage {...common}/>;
    case "Deposit to Bank": return <BankDepositPage {...common}/>;
    case "Upload Proof of Payment": return <ProofPage {...common}/>;
    case "Bank Verification": return <BankStatusPage data={props.data}/>;
    case "Expense Management": return <ExpensePage {...common}/>;
    case "Service Visits": return <ServiceVisitPage {...common}/>;
    case "Assigned Transactions": return <TransactionsPage data={props.data} assigned/>;
    case "Transaction History": return <TransactionsPage data={props.data}/>;
    case "Own Performance": return <PerformancePage data={props.data} period={props.period} setPeriod={props.setPeriod} anchor={props.anchor} setAnchor={props.setAnchor}/>;
    case "Reports": return <ReportsPage data={props.data} period={props.period} setPeriod={props.setPeriod} anchor={props.anchor} setAnchor={props.setAnchor}/>;
    case "Attendance": return <AttendancePage data={props.data}/>;
    case "Live Locations": return <GpsPage data={props.data} notify={props.notify} reload={props.reload}/>;
    case "Travel History": return <TravelPage data={props.data}/>;
    case "GPS Alerts": return <GpsAlertsPage data={props.data}/>;
    case "Notifications": return <NotificationsPage data={props.data} action={props.action}/>;
    case "Profile": return <ProfilePage {...common}/>;
    default: return <DashboardHome data={props.data} open={props.open}/>;
  }
}

function DashboardHome({ data, open }: { data: DashboardData; open: (page: PageKey) => void }) {
  const depositTotal = arr<any>(data.dailyDeposits).length;
  const verified = arr<any>(data.dailyDeposits).filter((item) => item.status === "VERIFIED").length;
  const verifiedPct = depositTotal ? (verified / depositTotal) * 100 : 100;
  return <section className={styles.stack}>
    {data.financialHold && <div className={styles.holdBanner}><Icon name="alert" size={25}/><div><strong>Financial Hold</strong><span>{data.financialHold.mismatchReason || "A bank deposit mismatch must be resolved before another deposit is submitted."}</span></div><button onClick={() => open("Bank Verification")}>Review hold</button></div>}
    {!data.brokers.length && !data.customers.length && <div className={styles.holdBanner}><Icon name="user" size={25}/><div><strong>No work assignments</strong><span>A Company Admin must assign your brokers and customers before you can issue float or record service visits.</span></div></div>}
    <div className={styles.metricGrid}>
      <Metric title="Float Received Today" value={money(data.stats.todayFloatReceived)} change="Morning accountant supply" icon="receive" tone="green"/>
      <Metric title="Float Issued Today" value={money(data.stats.todayIssued)} change={`${data.stats.brokersServed || 0} brokers served`} icon="send" tone="purple"/>
      <Metric title="Collections Today" value={money(data.stats.todayCollections)} change={`${data.stats.customersServed || 0} customers recorded`} icon="collection" tone="gold"/>
      <Metric title="Daily Float Return" value={money(data.stats.todayReturned + data.stats.todayBanked)} change={`${data.stats.pendingApprovals || 0} pending controls`} icon="return" tone="blue"/>
    </div>
    <div className={styles.analyticsGrid}>
      <Card title="Float Flow Analysis" subtitle="Daily received, issued, collections and return movement" action={<button className={styles.smallButton} onClick={() => open("Reports")}>View report</button>}><LineChart rows={data.dailyFlowSeries}/> </Card>
      <Card title="Deposit Accuracy" subtitle="Bank verification and mismatch control"><Donut percent={verifiedPct} value={money(arr<any>(data.dailyDeposits).reduce((s, r) => s + Number(r.amount || 0), 0))}/><div className={styles.legend}><span><i className={styles.greenDot}/>Verified {verified}</span><span><i className={styles.redDot}/>Mismatch {depositTotal - verified}</span></div></Card>
    </div>
    <div className={styles.secondaryGrid}>
      <Card title="Current Float Position" subtitle="Available, outstanding and pending"><div className={styles.bigBalance}>{money(data.stats.availableBalance)}</div><Progress label="Performance score" value={data.stats.performanceScore || 0}/><Progress label="Attendance" value={data.stats.attendanceRate || 0}/><Progress label="GPS compliance" value={data.stats.gpsCompliance || 0}/></Card>
      <Card title="Quick Operations" subtitle="Common staff actions"><div className={styles.quickGrid}><Quick icon="confirm" text="Confirm float" onClick={() => open("Receive & Confirm Float")}/><Quick icon="send" text="Issue to broker" onClick={() => open("Issue Float to Brokers")}/><Quick icon="bank" text="Bank deposit" onClick={() => open("Deposit to Bank")}/><Quick icon="location" text="Start live GPS" onClick={() => open("Live Locations")}/><Quick icon="expense" text="Submit expense" onClick={() => open("Expense Management")}/><Quick icon="report" text="View reports" onClick={() => open("Reports")}/></div></Card>
      <Card title="Recent Transactions" subtitle="Database records with user details"><MiniTransactions rows={data.dailyTransactions.slice(0, 6)}/></Card>
    </div>
  </section>;
}

function ReceiveFloatPage({ data, busy, action }: CommonProps) {
  const rows = data.floats.filter((item) => item.transactionType === "ACCOUNTANT_TO_STAFF");
  return <Section title="Receive & Confirm Morning Float" subtitle="Confirm only float physically or electronically received from the accountant." icon="confirm">
    <Card title="Assigned morning float" subtitle="Confirmation creates your operational check-in">
      <div className={styles.receiptList}>{rows.map((item) => <article key={item.id}><Avatar person={item.fromUser}/><div><strong>{item.fromUser?.name || "Accountant"}</strong><span>{item.referenceNo || "Float assignment"} • {date(item.createdAt, true)}</span></div><b>{money(item.amount)}</b><Status value={item.status}/>{item.status === "ISSUED" ? <button disabled={busy} onClick={() => action("CONFIRM_FLOAT_RECEIVED", { transactionId: item.id })}><Icon name="check"/> Confirm received</button> : <small>Transaction is locked after confirmation or approval.</small>}</article>)}{!rows.length && <Empty text="No float has been assigned to you yet."/>}</div>
    </Card>
  </Section>;
}

type CommonProps = { data: DashboardData; busy: boolean; action: (name: string, payload?: Record<string, unknown>) => Promise<boolean>; upload: (file: File, kind?: UploadClientKind) => Promise<string>; notify: (text: string) => void };

function IssueFloatPage({ data, busy, action, upload, notify }: CommonProps) {
  const [form, setForm] = useState({ brokerId: "", amount: "", purpose: "Morning float supply", referenceNo: "", notes: "", receiptUrl: "" });
  const [up, setUp] = useState(false);
  async function file(e: ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setUp(true); try { setForm({ ...form, receiptUrl: await upload(f,"proof") }); notify("Proof uploaded."); } catch (x) { notify(x instanceof Error ? x.message : "Upload failed."); } finally { setUp(false); } }
  async function submit(e: FormEvent) { e.preventDefault(); if (await action("ISSUE_FLOAT", form)) setForm({ brokerId: "", amount: "", purpose: "Morning float supply", referenceNo: "", notes: "", receiptUrl: "" }); }
  return <Section title="Issue Float to Brokers" subtitle={`Available balance: ${money(data.stats.availableBalance)}. Approved records cannot be edited.`} icon="send"><div className={styles.split}>
    <FormCard title="New broker float" onSubmit={submit}><Field label="Broker"><select required value={form.brokerId} onChange={(e) => setForm({ ...form, brokerId: e.target.value })}><option value="">Select broker</option>{data.brokers.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.username}</option>)}</select></Field><div className={styles.formRow}><Field label="Amount"><input type="number" min="1" max={data.stats.availableBalance} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/></Field><Field label="Reference"><input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="Automatic when blank"/></Field></div><Field label="Purpose"><input required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}/></Field><Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></Field><Upload url={form.receiptUrl} onChange={file} uploading={up} optional/><Submit busy={busy || up} text="Issue float" icon="send"/></FormCard>
    <Card title="Broker supply register" subtitle="How many times and how much each broker received"><BrokerTable rows={data.brokerStats}/></Card>
  </div></Section>;
}

function CollectionsPage({ data, busy, action, upload, notify }: CommonProps) {
  const [form, setForm] = useState({ brokerId: "", amount: "", referenceNo: "", collectionDate: today(), description: "", receiptUrl: "" }); const [up, setUp] = useState(false);
  async function file(e: ChangeEvent<HTMLInputElement>) { const f=e.target.files?.[0]; if(!f)return; setUp(true); try{setForm({...form,receiptUrl:await upload(f,"receipt")});notify("Collection receipt uploaded.");}catch(x){notify(x instanceof Error?x.message:"Upload failed.");}finally{setUp(false);} }
  async function submit(e:FormEvent){e.preventDefault();if(await action("RECORD_COLLECTION",form))setForm({brokerId:"",amount:"",referenceNo:"",collectionDate:today(),description:"",receiptUrl:""});}
  return <Section title="Receive Collections" subtitle="Record money returned by brokers, exact time, proof and reference." icon="collection"><div className={styles.split}><FormCard title="New broker collection" onSubmit={submit}><Field label="Broker"><select required value={form.brokerId} onChange={(e)=>setForm({...form,brokerId:e.target.value})}><option value="">Select broker</option>{data.brokers.map((b)=><option key={b.id} value={b.id}>{b.name} — {b.email}</option>)}</select></Field><div className={styles.formRow}><Field label="Amount"><input type="number" min="1" required value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></Field><Field label="Collection date"><input type="date" required value={form.collectionDate} onChange={(e)=>setForm({...form,collectionDate:e.target.value})}/></Field></div><Field label="Reference"><input value={form.referenceNo} onChange={(e)=>setForm({...form,referenceNo:e.target.value})}/></Field><Field label="Description"><textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></Field><Upload url={form.receiptUrl} onChange={file} uploading={up} optional/><Submit busy={busy||up} text="Record collection" icon="collection"/></FormCard><Card title="Recent collections" subtitle="Verification status from accounting"><MiniTransactions rows={data.collections.map((r)=>({id:r.id,description:r.description||"Broker collection",amount:r.amount,status:r.status,date:r.collectionDate,person:r.broker,reference:r.referenceNo})).slice(0,15)}/></Card></div></Section>;
}

function ReturnMoneyPage({ data, busy, action, upload, notify }: CommonProps) {
  const [form,setForm]=useState({accountantId:"",amount:"",referenceNo:"",purpose:"Afternoon float and collection return",notes:"",receiptUrl:""}); const [up,setUp]=useState(false);
  async function file(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setUp(true);try{setForm({...form,receiptUrl:await upload(f,"proof")});notify("Proof of payment uploaded.");}catch(x){notify(x instanceof Error?x.message:"Upload failed.");}finally{setUp(false);}}
  async function submit(e:FormEvent){e.preventDefault();if(await action("RETURN_MONEY",form))setForm({accountantId:"",amount:"",referenceNo:"",purpose:"Afternoon float and collection return",notes:"",receiptUrl:""});}
  const rows=data.floats.filter((r)=>r.transactionType==="STAFF_RETURN_TO_ACCOUNTANT");
  return <Section title="Return Money to Accountant" subtitle="Afternoon settlement requires proof of payment and becomes locked after approval." icon="return"><div className={styles.split}><FormCard title="Return float and collections" onSubmit={submit}><Field label="Accountant"><select required value={form.accountantId} onChange={(e)=>setForm({...form,accountantId:e.target.value})}><option value="">Select accountant</option>{data.accountants.map((a)=><option key={a.id} value={a.id}>{a.name} — {a.email}</option>)}</select></Field><div className={styles.formRow}><Field label="Amount"><input type="number" min="1" max={data.stats.availableBalance} required value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></Field><Field label="Reference"><input value={form.referenceNo} onChange={(e)=>setForm({...form,referenceNo:e.target.value})}/></Field></div><Field label="Purpose"><input required value={form.purpose} onChange={(e)=>setForm({...form,purpose:e.target.value})}/></Field><Field label="Notes"><textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></Field><Upload url={form.receiptUrl} onChange={file} uploading={up}/><Submit busy={busy||up} text="Return money" icon="return"/></FormCard><Card title="Daily return history" subtitle="Recorded creation and verification times"><MiniTransactions rows={rows.map((r)=>({id:r.id,description:r.purpose,amount:r.returnedAmount||r.amount,status:r.status,date:r.returnedAt||r.createdAt,person:r.toUser,reference:r.referenceNo})).slice(0,20)}/></Card></div></Section>;
}

function BankDepositPage({data,busy,action,upload,notify}:CommonProps){const[form,setForm]=useState({amount:"",referenceNo:"",bankAccount:"",depositDate:today(),receiptUrl:""});const[up,setUp]=useState(false);async function file(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setUp(true);try{setForm({...form,receiptUrl:await upload(f,"bank")});notify("Bank receipt uploaded.");}catch(x){notify(x instanceof Error?x.message:"Upload failed.");}finally{setUp(false);}}async function submit(e:FormEvent){e.preventDefault();if(await action("DEPOSIT_TO_BANK",form))setForm({amount:"",referenceNo:"",bankAccount:"",depositDate:today(),receiptUrl:""});}return <Section title="Deposit Money to Bank" subtitle="The system compares amount, reference, date and bank account with the bank record." icon="bank">{data.financialHold&&<div className={styles.inlineWarning}><Icon name="alert"/><span>Another deposit is blocked until the existing mismatch is resolved.</span></div>}<div className={styles.split}><FormCard title="New bank deposit" onSubmit={submit}><div className={styles.formRow}><Field label="Amount"><input disabled={!!data.financialHold} type="number" min="1" max={data.stats.availableBalance} required value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></Field><Field label="Deposit date"><input disabled={!!data.financialHold} type="date" required value={form.depositDate} onChange={(e)=>setForm({...form,depositDate:e.target.value})}/></Field></div><Field label="Bank account"><input disabled={!!data.financialHold} required value={form.bankAccount} onChange={(e)=>setForm({...form,bankAccount:e.target.value})} placeholder="Bank and account number"/></Field><Field label="Bank reference"><input disabled={!!data.financialHold} required value={form.referenceNo} onChange={(e)=>setForm({...form,referenceNo:e.target.value})}/></Field><Upload url={form.receiptUrl} onChange={file} uploading={up}/><Submit busy={busy||up||!!data.financialHold} text="Submit bank deposit" icon="bank"/></FormCard><Card title="Automatic verification statuses" subtitle="Verified, amount mismatch, missing receipt, duplicate or missing bank record"><BankCards rows={data.deposits}/></Card></div></Section>}

function ProofPage({data,busy,action,upload,notify}:CommonProps){const editable=data.deposits.filter((r)=>r.status!=="VERIFIED");async function file(id:string,f?:File){if(!f)return;try{const url=await upload(f,"bank");await action("UPLOAD_PROOF_OF_PAYMENT",{depositId:id,receiptUrl:url});}catch(x){notify(x instanceof Error?x.message:"Upload failed.");}}return <Section title="Upload Proof of Payment" subtitle="Verified deposits are immutable. Pending or mismatched deposits can receive new proof." icon="upload"><Card title="Receipt controls" subtitle="Large images and PDFs are compressed before private storage"><div className={styles.proofGrid}>{editable.map((r)=><article key={r.id}><Icon name="document" size={25}/><div><strong>{r.referenceNo}</strong><span>{r.bankAccount} • {date(r.depositDate)}</span></div><b>{money(r.amount)}</b><Status value={r.status}/>{r.bankReceiptUrl&&<a href={r.bankReceiptUrl} target="_blank">View current receipt</a>}<label><Icon name="upload"/>Upload replacement<input type="file" accept="image/*,application/pdf" disabled={busy} onChange={(e)=>void file(r.id,e.target.files?.[0])}/></label></article>)}{!editable.length&&<Empty text="All bank deposits are verified and locked."/>}</div></Card></Section>}

function BankStatusPage({data}:{data:DashboardData}){return <Section title="Bank Deposit Verification" subtitle="Read-only comparison results for your submitted deposits." icon="verify"><div className={styles.metricGrid}><Metric title="Verified" value={String(data.deposits.filter((r)=>r.status==="VERIFIED").length)} change="Matched bank records" icon="check" tone="green"/><Metric title="Financial Holds" value={String(data.deposits.filter((r)=>r.holdActive).length)} change="Blocks another deposit" icon="alert" tone="red"/><Metric title="Pending" value={String(data.deposits.filter((r)=>r.status==="PENDING").length)} change="Awaiting bank record" icon="history" tone="gold"/><Metric title="Total Deposited" value={money(data.deposits.reduce((s,r)=>s+Number(r.amount||0),0))} change="All submitted deposits" icon="bank" tone="blue"/></div><Card title="Receipt-to-bank comparison" subtitle="Amount, reference number, deposit date and bank account"><div className={styles.compareTable}><table><thead><tr><th>Date</th><th>Reference</th><th>Entered Amount</th><th>Statement Amount</th><th>Bank Account</th><th>Checks</th><th>Status</th></tr></thead><tbody>{data.deposits.map((r)=><tr key={r.id}><td>{date(r.depositDate,true)}</td><td>{r.referenceNo}</td><td>{money(r.amount)}</td><td>{r.statementAmount==null?"Awaiting bank":money(r.statementAmount)}</td><td>{r.bankAccount}</td><td><Comparison value={r.comparison}/></td><td><Status value={r.status}/>{r.mismatchReason&&<small>{r.mismatchReason}</small>}</td></tr>)}</tbody></table></div></Card></Section>}

function ExpensePage({data,busy,action,upload,notify}:CommonProps){const[form,setForm]=useState({category:"FUEL",amount:"",expenseDate:today(),description:"",receiptUrl:""});const[up,setUp]=useState(false);async function file(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setUp(true);try{setForm({...form,receiptUrl:await upload(f,"expense")});notify("Expense receipt uploaded.");}catch(x){notify(x instanceof Error?x.message:"Upload failed.");}finally{setUp(false);}}async function submit(e:FormEvent){e.preventDefault();if(await action("SUBMIT_EXPENSE",form))setForm({category:"FUEL",amount:"",expenseDate:today(),description:"",receiptUrl:""});}return <Section title="Expense Management" subtitle="Every employee may submit an expense request. Approved or rejected requests cannot be edited." icon="expense"><div className={styles.expenseLayout}><FormCard title="New expense request" onSubmit={submit}><Field label="Category"><select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}>{["FUEL","TRANSPORT","AIRTIME","ACCOMMODATION","REPAIRS","STATIONERY","MEALS","OFFICE_EXPENSES","EMERGENCY_EXPENSES"].map((v)=><option key={v}>{label(v)}</option>)}</select></Field><div className={styles.formRow}><Field label="Amount"><input type="number" min="1" required value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></Field><Field label="Expense date"><input type="date" required value={form.expenseDate} onChange={(e)=>setForm({...form,expenseDate:e.target.value})}/></Field></div><Field label="Description"><textarea required value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></Field><Upload url={form.receiptUrl} onChange={file} uploading={up} optional/><Submit busy={busy||up} text="Submit expense" icon="expense"/></FormCard><Card title="My expense requests" subtitle="Approval workflow and review notes"><div className={styles.compareTable}><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Receipt</th><th>Status</th><th>Reviewer</th></tr></thead><tbody>{data.expenses.map((r)=><tr key={r.id}><td>{date(r.expenseDate)}</td><td>{label(r.category)}</td><td>{r.description}</td><td>{money(r.amount)}</td><td>{r.receiptUrl?<a href={r.receiptUrl} target="_blank">View</a>:"—"}</td><td><Status value={r.status}/>{r.reviewNote&&<small>{r.reviewNote}</small>}</td><td>{r.reviewedBy?.name||"Awaiting review"}</td></tr>)}</tbody></table></div></Card></div></Section>}

function ServiceVisitPage({data,busy,action}:CommonProps){const latest=data.devices?.[0];const[form,setForm]=useState({brokerId:"",customerId:"",serviceType:"Float supply visit",amount:"",notes:"",latitude:latest?.lastLatitude||"",longitude:latest?.lastLongitude||"",locationName:data.staff?.assignedRegion||""});async function submit(e:FormEvent){e.preventDefault();if(await action("RECORD_SERVICE_VISIT",form))setForm({...form,brokerId:"",customerId:"",amount:"",notes:""});}return <Section title="Broker and Customer Visits" subtitle="Record who was served, the location and how many times service was provided." icon="visit"><div className={styles.split}><FormCard title="Record service visit" onSubmit={submit}><Field label="Broker (optional)"><select value={form.brokerId} onChange={(e)=>setForm({...form,brokerId:e.target.value})}><option value="">No broker</option>{data.brokers.map((b)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Customer (optional)"><select value={form.customerId} onChange={(e)=>setForm({...form,customerId:e.target.value})}><option value="">No customer</option>{data.customers.map((c)=><option key={c.id} value={c.id}>{c.name} — {c.region||"No region"}</option>)}</select></Field><Field label="Service type"><input required value={form.serviceType} onChange={(e)=>setForm({...form,serviceType:e.target.value})}/></Field><div className={styles.formRow}><Field label="Amount"><input type="number" min="0" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></Field><Field label="Location name"><input value={form.locationName} onChange={(e)=>setForm({...form,locationName:e.target.value})}/></Field></div><div className={styles.formRow}><Field label="Latitude"><input value={form.latitude} onChange={(e)=>setForm({...form,latitude:e.target.value})}/></Field><Field label="Longitude"><input value={form.longitude} onChange={(e)=>setForm({...form,longitude:e.target.value})}/></Field></div><Field label="Notes"><textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></Field><Submit busy={busy} text="Record visit" icon="visit"/></FormCard><Card title="Customers and brokers served" subtitle="Period totals and latest locations"><div className={styles.visits}><h4>Brokers</h4><BrokerTable rows={data.brokerStats}/><h4>Customers</h4>{data.customerStats.map((r)=><article key={r.customer.id}><div><strong>{r.customer.name}</strong><span>{r.customer.region||r.customer.address||"No location"}</span></div><b>{r.visits} visits</b><em>{money(r.amount)}</em></article>)}</div></Card></div></Section>}

function TransactionsPage({data,assigned=false}:{data:DashboardData;assigned?:boolean}){const[type,setType]=useState("ALL");const[status,setStatus]=useState("ALL");const[query,setQuery]=useState("");const rows=useMemo(()=>data.assignedTransactions.filter((r)=>{if(type!=="ALL"&&r.kind!==type)return false;if(status!=="ALL"&&r.status!==status)return false;const q=query.toLowerCase();return !q||`${r.reference} ${r.description} ${r.person?.name||""} ${r.person?.email||""}`.toLowerCase().includes(q);}),[data.assignedTransactions,type,status,query]);return <Section title={assigned?"Assigned Transactions":"Transaction History"} subtitle="Filters apply automatically. Locked records cannot be changed." icon={assigned?"transactions":"history"}><FilterBar><select value={type} onChange={(e)=>setType(e.target.value)}><option value="ALL">All types</option>{["FLOAT","COLLECTION","BANK_DEPOSIT","EXPENSE"].map((v)=><option key={v}>{v}</option>)}</select><select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="ALL">All statuses</option>{Array.from(new Set(data.assignedTransactions.map((r)=>r.status))).map((v)=><option key={v}>{label(v)}</option>)}</select><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name, email, reference..."/></FilterBar><Card title={`${rows.length} transaction records`} subtitle="Real data fetched from MySQL"><TransactionTable rows={rows}/></Card></Section>}

function PerformancePage({data,period,setPeriod,anchor,setAnchor}:{data:DashboardData;period:string;setPeriod:(v:string)=>void;anchor:string;setAnchor:(v:string)=>void}){const p=data.currentPerformance||{};return <Section title="Staff Performance" subtitle="Automatic KPI score from float, collection, bank, attendance, GPS and approval data." icon="performance"><PeriodFilter period={period} setPeriod={setPeriod} anchor={anchor} setAnchor={setAnchor}/><div className={styles.scoreHero}><div className={styles.scoreCircle}><strong>{p.score||0}</strong><span>/100</span></div><div><small>PERFORMANCE RATING</small><h3>{p.rating||"Needs Improvement"}</h3><p>90–100 Excellent · 80–89 Very Good · 70–79 Good · 60–69 Fair</p></div></div><div className={styles.kpiGrid}>{[["Total Float Issued",money(p.totalFloatIssued)],["Total Collections",money(p.totalCollections)],["Outstanding Balance",money(p.outstandingBalance)],["Average Return Time",`${Math.round(Number(p.averageReturnMinutes||0))} min`],["Deposit Accuracy",`${Math.round(Number(p.depositAccuracyRate||0))}%`],["Bank Mismatches",String(p.bankMismatches||0)],["Attendance Rate",`${Math.round(Number(p.attendanceRate||0))}%`],["GPS Compliance",`${Math.round(Number(p.gpsComplianceRate||0))}%`],["Customer Visits",String(p.customerVisits||0)],["Broker Visits",String(p.brokerVisits||0)],["Transactions Completed",String(p.transactionsCompleted||0)],["Approval Compliance",`${Math.round(Number(p.approvalComplianceRate||0))}%`]].map(([a,b])=><article key={a}><span>{a}</span><strong>{b}</strong></article>)}</div><div className={styles.analyticsGrid}><Card title="Monthly comparison" subtitle="Stored performance history"><PerformanceBars rows={data.latestPerformanceRecords}/></Card><Card title="Your current position" subtitle="Only your own rank is visible"><div className={styles.ranking}>{data.ranking.map((r)=><article key={r.id}><b>#{r.rank}</b><Avatar person={r}/><div><strong>{r.name}</strong><span>{r.rating} · {r.totalStaff || 1} staff officers</span></div><em>{r.score}/100</em></article>)}</div></Card></div></Section>}

function ReportsPage({data,period,setPeriod,anchor,setAnchor}:{data:DashboardData;period:string;setPeriod:(v:string)=>void;anchor:string;setAnchor:(v:string)=>void}){const summary=data.reportSummary||{};function exportCsv(){const rows=[["Date","Type","Reference","Description","Person","Email","Amount","Status"],...data.reportRows.map((r)=>[date(r.date,true),r.kind,r.reference,r.description,r.person?.name||"",r.person?.email||"",Number(r.amount||0),r.status])];downloadBlob(`staff-report-${period.toLowerCase()}-${anchor}.csv`,rows.map((r)=>r.map(csvCell).join(",")).join("\n"),"text/csv;charset=utf-8");}function exportPdf(){const lines=[`${data.company?.name||"Company"} - Staff Float Officer Report`,`${summary.label||anchor} (${period})`,`Officer: ${data.staff?.name} <${data.staff?.email}>`,``, `Float received: ${money(summary.totalFloatReceived)}`,`Float issued: ${money(summary.totalFloatIssued)}`,`Collections: ${money(summary.totalCollections)}`,`Returned: ${money(summary.totalReturned)}`,`Banked: ${money(summary.totalBanked)}`,`Expenses: ${money(summary.totalExpenses)}`,`Brokers served: ${summary.brokersServed||0}`,`Customers served: ${summary.customersServed||0}`,``,"TRANSACTIONS",...data.reportRows.map((r)=>`${date(r.date,true)} | ${r.kind} | ${r.reference} | ${r.person?.name||""} | ${money(r.amount)} | ${r.status}`)];downloadPdf(`staff-report-${period.toLowerCase()}-${anchor}.pdf`,lines);}return <Section title="Daily, Weekly, Monthly and Yearly Reports" subtitle="Automatic period filters, broker/customer service statistics, returns and bank checks." icon="report"><div className={styles.reportToolbar}><PeriodFilter period={period} setPeriod={setPeriod} anchor={anchor} setAnchor={setAnchor}/><button onClick={exportCsv}><Icon name="download"/>CSV</button><button onClick={exportPdf}><Icon name="document"/>PDF</button></div><div className={styles.metricGrid}><Metric title="Float Received" value={money(summary.totalFloatReceived)} change={summary.label} icon="receive" tone="green"/><Metric title="Float Issued" value={money(summary.totalFloatIssued)} change={`${summary.brokersServed||0} brokers`} icon="send" tone="purple"/><Metric title="Collections" value={money(summary.totalCollections)} change={`${summary.customersServed||0} customers`} icon="collection" tone="gold"/><Metric title="Daily Return" value={money(summary.dailyReturn)} change={`${summary.bankMismatches||0} bank mismatches`} icon="return" tone="blue"/></div><div className={styles.analyticsGrid}><Card title="Period movement trend" subtitle="Float and collection movement"><LineChart rows={data.flowSeries}/></Card><Card title="Report summary" subtitle="Financial and operational totals"><div className={styles.summaryList}>{Object.entries(summary).filter(([k])=>!["label","period"].includes(k)).map(([k,v])=><div key={k}><span>{label(k.replace(/([A-Z])/g,"_$1"))}</span><strong>{typeof v==="number"&&k.toLowerCase().includes("total")?money(v):String(v)}</strong></div>)}</div></Card></div><Card title="Period transactions" subtitle={`${data.reportRows.length} records`}><TransactionTable rows={data.reportRows}/></Card></Section>}

function AttendancePage({data}:{data:DashboardData}){return <Section title="Attendance Management" subtitle="Generated automatically from receiving float, issuing float, returns and GPS movement." icon="attendance"><div className={styles.metricGrid}><Metric title="Attendance Rate" value={`${Math.round(Number(data.currentPerformance?.attendanceRate||0))}%`} change="Operational activity" icon="attendance" tone="green"/><Metric title="Present" value={String(data.attendance.filter((r)=>r.status==="PRESENT").length)} change="Returned before cutoff" icon="check" tone="blue"/><Metric title="Late" value={String(data.attendance.filter((r)=>r.status==="LATE").length)} change="Returned after cutoff" icon="history" tone="gold"/><Metric title="Absent" value={String(data.attendance.filter((r)=>r.status==="ABSENT").length)} change="No return by cutoff" icon="x" tone="red"/></div><Card title="Class-style attendance register" subtitle="✓ present, ⏱ late and ✕ absent"><div className={styles.attendanceTable}><table><thead><tr><th>Date</th><th>Mark</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Source</th><th>Notes</th></tr></thead><tbody>{data.attendance.map((r)=><tr key={r.id}><td>{date(r.date)}</td><td><span className={`${styles.attMark} ${r.status==="ABSENT"?styles.absent:r.status==="LATE"?styles.late:styles.present}`}>{r.status==="ABSENT"?"✕":r.status==="LATE"?"⏱":"✓"}</span></td><td><Status value={r.status}/></td><td>{date(r.checkInAt,true)}</td><td>{date(r.checkOutAt,true)}</td><td>{label(r.source)}</td><td>{r.notes||"—"}</td></tr>)}</tbody></table></div></Card></Section>}

function GpsPage({data,notify,reload}:{data:DashboardData;notify:(t:string)=>void;reload:()=>Promise<void>}){const[tracking,setTracking]=useState(false);const[latest,setLatest]=useState<any>(null);const watch=useRef<number|null>(null);const lastSent=useRef(0);function token(){let value=localStorage.getItem("simamia_staff_device_token");if(!value){value=crypto.randomUUID();localStorage.setItem("simamia_staff_device_token",value);}return value;}async function send(pos:GeolocationPosition){const now=Date.now();if(now-lastSent.current<12000)return;lastSent.current=now;const payload={deviceToken:token(),deviceName:navigator.userAgent.includes("Mobile")?"Staff mobile phone":"Staff browser device",latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,speed:pos.coords.speed,heading:pos.coords.heading,capturedAt:new Date(pos.timestamp).toISOString()};setLatest(payload);try{await requestJson("/api/staff/gps",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});await reload();}catch(e){notify(e instanceof Error?e.message:"GPS save failed.");}}function start(){if(!navigator.geolocation)return notify("This device does not support browser geolocation.");watch.current=navigator.geolocation.watchPosition((p)=>void send(p),async(e)=>{setTracking(false);notify(e.message);await fetch("/api/staff/gps",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"DISABLED"})});},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});setTracking(true);}async function stop(){if(watch.current!=null)navigator.geolocation.clearWatch(watch.current);watch.current=null;setTracking(false);await fetch("/api/staff/gps",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"DISABLED"})});notify("Live GPS stopped and a GPS-disabled event was recorded.");}useEffect(()=>()=>{if(watch.current!=null)navigator.geolocation.clearWatch(watch.current);},[]);const points=data.liveLocations.filter((r)=>r.latitude!=null&&r.longitude!=null).map((r)=>({latitude:Number(r.latitude),longitude:Number(r.longitude),label:r.owner?.name||r.name,subtitle:`${label(r.owner?.role)} • ${r.speedKph?Math.round(r.speedKph)+" km/h":"Stationary"}`,capturedAt:r.lastSeenAt,type:r.owner?.role==="BROKER"?"broker":"staff"}));return <Section title="Live Locations" subtitle="Uses browser location permission and stores real GPS pings in MySQL." icon="location"><div className={styles.gpsToolbar}><button className={styles.primary} onClick={tracking?()=>void stop():start}>{tracking?<><Icon name="x"/>Stop Live GPS</>:<><Icon name="location"/>Start Live GPS</>}</button><span className={tracking?styles.online:styles.offline}>{tracking?"Sharing live location":"GPS not sharing"}</span>{latest&&<small>{Number(latest.latitude).toFixed(6)}, {Number(latest.longitude).toFixed(6)}</small>}</div><div className={styles.mapGrid}><Card title="Your operational map" subtitle="Your device and assigned broker devices"><LiveMap points={points}/></Card><Card title="Device status" subtitle="Only your device and assigned brokers are visible"><div className={styles.deviceList}>{data.liveLocations.map((r)=><article key={r.id}><Avatar person={r.owner}/><div><strong>{r.owner?.name||r.name}</strong><span>{r.latitude?.toFixed?.(5)}, {r.longitude?.toFixed?.(5)}</span><small>{date(r.lastSeenAt,true)} • {Math.round(Number(r.speedKph||0))} km/h</small></div><Status value={r.status}/></article>)}</div></Card></div><div className={styles.note}>Location access works on <b>localhost</b> during development and on an <b>HTTPS</b> domain after deployment.</div></Section>}

function TravelPage({data}:{data:DashboardData}){const pings=arr<any>(data.devices?.[0]?.pings).slice().reverse();const points=pings.map((r)=>({latitude:Number(r.latitude),longitude:Number(r.longitude),label:"Travel point",subtitle:`${Math.round(Number(r.speedKph||0))} km/h`,capturedAt:r.capturedAt,type:"history" as const}));return <Section title="Travel History" subtitle="Recorded route, movement times, speed and accuracy." icon="route"><div className={styles.mapGrid}><Card title="Recorded route" subtitle={`${pings.length} GPS points`}><LiveMap points={points.slice(-1)} history={points}/></Card><Card title="Travel records" subtitle="Newest GPS records"><div className={styles.travelList}>{pings.slice().reverse().slice(0,40).map((r)=><article key={r.id}><Icon name="location"/><div><strong>{Number(r.latitude).toFixed(6)}, {Number(r.longitude).toFixed(6)}</strong><span>{date(r.capturedAt,true)}</span></div><b>{Math.round(Number(r.speedKph||0))} km/h</b></article>)}</div></Card></div></Section>}

function GpsAlertsPage({data}:{data:DashboardData}){return <Section title="GPS Alerts" subtitle="GPS disabled, offline, assigned-region, overspeed and idle-time alerts." icon="alert"><div className={styles.alertGrid}>{data.gpsAlerts.map((r)=><article key={r.id}><span><Icon name="alert"/></span><div><strong>{r.title}</strong><p>{r.message}</p><small>{date(r.createdAt,true)} {r.latitude!=null?`• ${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`:""}</small></div><Status value={r.status}/></article>)}{!data.gpsAlerts.length&&<Empty text="No GPS alerts have been recorded."/>}</div></Section>}

function NotificationsPage({data,action}:{data:DashboardData;action:(n:string,p?:Record<string,unknown>)=>Promise<boolean>}){return <Section title="Notifications" subtitle="In-app, email and SMS events are queued from operational workflows." icon="bell"><div className={styles.notificationActions}><button onClick={()=>action("MARK_ALL_NOTIFICATIONS_READ")}><Icon name="check"/>Mark all read</button></div><div className={styles.noticeList}>{data.notifications.map((r)=><button key={r.id} className={r.isRead?styles.readNotice:""} onClick={()=>!r.isRead&&action("MARK_NOTIFICATION_READ",{notificationId:r.id})}><span><Icon name={r.type==="WARNING"||r.type==="ERROR"?"alert":"bell"}/></span><div><strong>{r.title}</strong><p>{r.message}</p><small>{date(r.createdAt,true)}</small></div><Status value={r.type}/></button>)}</div></Section>}

function ProfilePage({data,busy,action,upload,notify}:CommonProps){
  const [uploading,setUploading]=useState(false);
  const [usernameForm,setUsernameForm]=useState({
    username:String(data.staff?.username||""),
    currentPassword:"",
  });
  const [passwordForm,setPasswordForm]=useState({
    currentPassword:"",
    newPassword:"",
    confirmPassword:"",
  });

  useEffect(()=>{
    setUsernameForm((current)=>({
      ...current,
      username:String(data.staff?.username||""),
    }));
  },[data.staff?.username]);

  async function profileFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    if(!file)return;
    setUploading(true);
    try{
      const url=await upload(file,"profile");
      await action("UPDATE_PROFILE_IMAGE",{profileImageUrl:url});
    }catch(error){
      notify(error instanceof Error?error.message:"Profile upload failed.");
    }finally{
      setUploading(false);
      event.target.value="";
    }
  }

  async function updateUsername(event:FormEvent){
    event.preventDefault();
    const ok=await action("UPDATE_USERNAME",usernameForm);
    if(ok){
      setUsernameForm((current)=>({...current,currentPassword:""}));
    }
  }

  async function changePassword(event:FormEvent){
    event.preventDefault();
    const ok=await action("CHANGE_PASSWORD",passwordForm);
    if(ok){
      setPasswordForm({currentPassword:"",newPassword:"",confirmPassword:""});
    }
  }

  return <Section title="Staff Profile & Security" subtitle="Compressed profile image, username and password changes are validated and recorded in the database." icon="user">
    <div className={styles.profileSecurityGrid}>
      <Card title="Profile image" subtitle="Images are resized, converted to WEBP and stored privately.">
        <div className={styles.profileHero}>
          <Avatar person={data.staff} large/>
          <div>
            <h3>{data.staff.name}</h3>
            <p>@{data.staff.username}</p>
            <span>{data.staff.email}</span>
            <small>{data.staff.branch?.name||"No branch"} • {data.staff.assignedRegion||"No assigned region"}</small>
          </div>
        </div>
        <label className={styles.profileUploadButton}>
          <Icon name="upload"/>
          <span>{uploading?"Compressing and uploading...":"Choose profile image"}</span>
          <input disabled={busy||uploading} type="file" accept="image/jpeg,image/png,image/webp" onChange={profileFile}/>
        </label>
        <div className={styles.securityNote}>Maximum original size: 25 MB. Stored profile output is limited to 2 MB.</div>
      </Card>

      <FormCard title="Change username" onSubmit={updateUsername}>
        <Field label="New username">
          <input
            value={usernameForm.username}
            onChange={(event)=>setUsernameForm({...usernameForm,username:event.target.value})}
            minLength={3}
            maxLength={40}
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Current password">
          <input
            type="password"
            value={usernameForm.currentPassword}
            onChange={(event)=>setUsernameForm({...usernameForm,currentPassword:event.target.value})}
            autoComplete="current-password"
            required
          />
        </Field>
        <Submit busy={busy} text="Save username" icon="check"/>
        <div className={styles.securityNote}>Your current password is required. Usernames must be unique.</div>
      </FormCard>

      <FormCard title="Change password" onSubmit={changePassword}>
        <Field label="Current password">
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(event)=>setPasswordForm({...passwordForm,currentPassword:event.target.value})}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(event)=>setPasswordForm({...passwordForm,newPassword:event.target.value})}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(event)=>setPasswordForm({...passwordForm,confirmPassword:event.target.value})}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Submit busy={busy} text="Change password" icon="check"/>
        <div className={styles.securityNote}>Use at least 8 characters with uppercase, lowercase and a number.</div>
      </FormCard>
    </div>
  </Section>;
}

function Section({title,subtitle,icon,children}:{title:string;subtitle:string;icon:IconName;children:ReactNode}){return <section className={styles.stack}><header className={styles.sectionHeader}><span><Icon name={icon} size={25}/></span><div><small>STAFF FLOAT OFFICER</small><h2>{title}</h2><p>{subtitle}</p></div></header>{children}</section>}
function Card({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode}){return <article className={styles.card}><header><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>{children}</article>}
function FormCard({title,onSubmit,children}:{title:string;onSubmit:(e:FormEvent)=>void;children:ReactNode}){return <form className={styles.formCard} onSubmit={onSubmit}><h3>{title}</h3>{children}</form>}
function Field({label:txt,children}:{label:string;children:ReactNode}){return <label className={styles.field}><span>{txt}</span>{children}</label>}
function Submit({busy,text,icon}:{busy:boolean;text:string;icon:IconName}){return <button className={styles.primary} disabled={busy}><Icon name={icon}/>{busy?"Processing...":text}</button>}
function Upload({url,onChange,uploading,optional=false}:{url:string;onChange:(e:ChangeEvent<HTMLInputElement>)=>void;uploading:boolean;optional?:boolean}){return <label className={styles.upload}><Icon name="upload"/><div><strong>{uploading?"Uploading...":url?"File uploaded":"Choose proof or receipt"}</strong><span>{optional?"Optional JPG, PNG, WEBP or PDF • large files are compressed":"Required JPG, PNG, WEBP or PDF • large files are compressed"}</span></div><input type="file" accept="image/*,application/pdf" onChange={onChange}/>{url&&<b>✓</b>}</label>}
function Metric({title,value,change,icon,tone}:{title:string;value:string;change?:string;icon:IconName;tone:string}){return <article className={`${styles.metric} ${styles[tone]}`}><div><span>{title}</span><strong>{value}</strong><small>{change}</small></div><i><Icon name={icon} size={22}/></i></article>}
function Quick({icon,text,onClick}:{icon:IconName;text:string;onClick:()=>void}){return <button onClick={onClick}><i><Icon name={icon}/></i><span>{text}</span><Icon name="arrow" size={15}/></button>}
function Progress({label:txt,value}:{label:string;value:number}){const safe=Math.max(0,Math.min(100,Number(value||0)));return <div className={styles.progress}><div><span>{txt}</span><b>{Math.round(safe)}%</b></div><i><em style={{width:`${safe}%`}}/></i></div>}
function Status({value}:{value:unknown}){const text=String(value||"UNKNOWN");return <span className={`${styles.status} ${styles[`status${text}`]||""}`}>{label(text)}</span>}
function Avatar({person,large=false}:{person:any;large?:boolean}){const name=String(person?.name||person?.username||"U");return person?.profileImageUrl?<img className={`${styles.avatar} ${large?styles.largeAvatar:""}`} src={person.profileImageUrl} alt={name}/>:<span className={`${styles.avatar} ${styles.avatarFallback} ${large?styles.largeAvatar:""}`}>{name.slice(0,2).toUpperCase()}</span>}
function Empty({text}:{text:string}){return <div className={styles.empty}>{text}</div>}
function FilterBar({children}:{children:ReactNode}){return <div className={styles.filters}><Icon name="filter"/>{children}</div>}
function PeriodFilter({period,setPeriod,anchor,setAnchor}:{period:string;setPeriod:(v:string)=>void;anchor:string;setAnchor:(v:string)=>void}){return <div className={styles.periodFilter}><select value={period} onChange={(e)=>setPeriod(e.target.value)}>{["DAY","WEEK","MONTH","YEAR"].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select><input type="date" value={anchor} onChange={(e)=>setAnchor(e.target.value)}/></div>}

function LineChart({rows}:{rows:any[]}){const safe=rows.length?rows:[{label:"No data",received:0,issued:0,collections:0,deposited:0}];const max=Math.max(1,...safe.flatMap((r)=>[r.received,r.issued,r.collections,r.deposited].map(Number)));const width=760,height=250,pad=28;function points(key:string){return safe.map((r,i)=>`${pad+(i*(width-pad*2))/Math.max(1,safe.length-1)},${height-pad-(Number(r[key]||0)/max)*(height-pad*2)}`).join(" ");}return <div className={styles.chart}><div className={styles.chartLegend}><span><i className={styles.greenDot}/>Received</span><span><i className={styles.purpleDot}/>Issued</span><span><i className={styles.goldDot}/>Collections</span><span><i className={styles.redDot}/>Returned/Banked</span></div><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{[0,1,2,3,4].map((n)=><line key={n} x1={pad} y1={pad+n*(height-pad*2)/4} x2={width-pad} y2={pad+n*(height-pad*2)/4} className={styles.gridLine}/>)}<polyline points={points("received")} className={styles.lineReceived}/><polyline points={points("issued")} className={styles.lineIssued}/><polyline points={points("collections")} className={styles.lineCollection}/><polyline points={points("deposited")} className={styles.lineDeposited}/></svg><div className={styles.chartLabels}>{safe.map((r,i)=><span key={`${r.key||r.label}-${i}`}>{r.label||r.key}</span>)}</div></div>}
function Donut({percent,value}:{percent:number;value:string}){const p=Math.max(0,Math.min(100,percent));return <div className={styles.donutWrap}><div className={styles.donut} style={{background:`conic-gradient(#0d9b70 0 ${p}%, #dc4e68 ${p}% 100%)`}}><span><small>Total Deposits</small><strong>{value}</strong><em>{Math.round(p)}% verified</em></span></div></div>}
function PerformanceBars({rows}:{rows:any[]}){const safe=rows.slice().reverse().slice(-12);return <div className={styles.bars}>{safe.map((r)=><article key={`${r.year}-${r.month}`}><div><span style={{height:`${Math.max(3,Number(r.score||0))}%`}}/></div><b>{r.score}</b><small>{String(r.month).padStart(2,"0")}/{String(r.year).slice(-2)}</small></article>)}{!safe.length&&<Empty text="Performance history will appear after monthly calculations."/>}</div>}
function BrokerTable({rows}:{rows:any[]}){return <div className={styles.brokerRows}>{rows.map((r)=><article key={r.broker.id}><Avatar person={r.broker}/><div><strong>{r.broker.name}</strong><span>{r.broker.email}</span><small>{r.location?`${Number(r.location.latitude).toFixed(4)}, ${Number(r.location.longitude).toFixed(4)}`:r.broker.assignedRegion||"No live location"}</small></div><b>{r.timesServed} times</b><em>{money(r.totalFloat)}</em></article>)}{!rows.length&&<Empty text="No broker service activity in this period."/>}</div>}
function MiniTransactions({rows}:{rows:any[]}){return <div className={styles.miniTransactions}>{rows.map((r)=><article key={r.id}><Avatar person={r.person}/><div><strong>{r.description||r.reference}</strong><span>{r.person?.name||"System"} {r.person?.email?`• ${r.person.email}`:""}</span><small>{date(r.date,true)} • {r.reference}</small></div><b>{money(r.amount)}</b><Status value={r.status}/></article>)}{!rows.length&&<Empty text="No transaction records found."/>}</div>}
function TransactionTable({rows}:{rows:any[]}){return <div className={styles.tableScroll}><table><thead><tr><th>#</th><th>Date</th><th>User</th><th>Type</th><th>Reference</th><th>Description</th><th>Amount</th><th>Proof</th><th>Status</th><th>Control</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{date(r.date,true)}</td><td><div className={styles.personCell}><Avatar person={r.person}/><span><strong>{r.person?.name||"System"}</strong><small>{r.person?.email||"—"}</small></span></div></td><td>{label(r.kind||r.type)}</td><td>{r.reference}</td><td>{r.description}</td><td>{money(r.amount)}</td><td>{r.receiptUrl?<a href={r.receiptUrl} target="_blank">View</a>:"—"}</td><td><Status value={r.status}/></td><td>{r.locked?<span className={styles.locked}>Locked</span>:"Pending"}</td></tr>)}</tbody></table></div>}
function BankCards({rows}:{rows:any[]}){return <div className={styles.bankCards}>{rows.slice(0,12).map((r)=><article key={r.id}><div><strong>{r.referenceNo}</strong><span>{r.bankAccount}</span><small>{date(r.depositDate,true)}</small></div><b>{money(r.amount)}</b><Status value={r.status}/>{r.mismatchReason&&<p>{r.mismatchReason}</p>}</article>)}{!rows.length&&<Empty text="No bank deposits submitted."/>}</div>}
function Comparison({value}:{value:any}){if(!value)return <span className={styles.waiting}>Waiting</span>;return <div className={styles.checks}>{[["Amount",value.amountMatch],["Reference",value.referenceMatch],["Date",value.dateMatch],["Account",value.accountMatch],["Receipt",value.receiptPresent]].map(([a,b])=><span key={String(a)} className={b?styles.ok:styles.bad}>{b?"✓":"✕"} {a}</span>)}</div>}
function NotificationPopup({rows,onRead,openAll}:{rows:any[];onRead:(id:string)=>Promise<boolean>;openAll:()=>void}){return <div className={styles.popup}><header><strong>Notifications</strong><button onClick={openAll}>View all</button></header>{rows.slice(0,7).map((r)=><button key={r.id} className={r.isRead?styles.readNotice:""} onClick={()=>!r.isRead&&void onRead(r.id)}><Icon name={r.type==="WARNING"?"alert":"bell"}/><span><strong>{r.title}</strong><small>{r.message}</small></span></button>)}</div>}
function Loading(){return <div className={styles.loading}><span/><p>Loading staff operations...</p></div>}
function ErrorState({text,retry}:{text:string;retry:()=>void}){return <div className={styles.error}><Icon name="alert" size={30}/><h2>Staff dashboard could not load</h2><p>{text}</p><button onClick={retry}>Try again</button></div>}
function downloadBlob(name:string,content:string,type:string){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function csvCell(value:unknown){const text=String(value??"");return `"${text.replaceAll('"','""')}"`}
function pdfEscape(value:string){return value.replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)").replaceAll(/[^\x20-\x7E]/g,"?")}
function downloadPdf(name:string,lines:string[]){const pages:Array<string[]>=[];for(let i=0;i<lines.length;i+=44)pages.push(lines.slice(i,i+44));if(!pages.length)pages.push(["No data"]);const objects:string[]=[];objects[1]="<< /Type /Catalog /Pages 2 0 R >>";objects[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";const pageRefs:string[]=[];let obj=4;for(const pageLines of pages){const pageObj=obj++,contentObj=obj++;pageRefs.push(`${pageObj} 0 R`);let y=800;const commands=pageLines.map((line)=>{const cmd=`BT /F1 9 Tf 38 ${y} Td (${pdfEscape(String(line).slice(0,150))}) Tj ET`;y-=17;return cmd;}).join("\n");objects[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`;objects[contentObj]=`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;}objects[2]=`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;let pdf="%PDF-1.4\n";const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;downloadBlob(name,pdf,"application/pdf")}
