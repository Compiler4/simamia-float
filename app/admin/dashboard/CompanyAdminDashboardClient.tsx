"use client";

import {
  type ChangeEvent,
  type ComponentType,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BadgeDollarSign,
  Banknote,
  BatteryCharging,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileBarChart2,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  LayoutDashboard,
  Landmark,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  MessageSquareText,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Signal,
  Smartphone,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  UploadCloud,
  UserCheck,
  UserCircle2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import styles from "./CompanyAdminDashboard.module.css";

type Props = {
  user: {
    id: string;
    name: string;
    username?: string | null;
    email: string;
    role: string;
    companyId: string | null;
    companyName?: string | null;
  };
};

type BrokerCustomerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

type BrokerCustomerItem = {
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
  status: BrokerCustomerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type BrokerCustomerForm = {
  id: string;
  code: string;
  name: string;
  businessName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  location: string;
  region: string;
  district: string;
  ward: string;
  address: string;
  latitude: string;
  longitude: string;
  status: BrokerCustomerStatus;
  notes: string;
};

type CustomerServiceSummaryRow = {
  customerKey: string;
  customerName: string;
  phone: string;
  email: string;
  region: string;
  staffNames: string[];
  serviceTypes: string[];
  dayCount: number;
  weekCount: number;
  monthCount: number;
  yearCount: number;
  selectedCount: number;
  totalCount: number;
  selectedValue: number;
  lastServedAt: string;
};

type PageName =
  | "Dashboard"
  | "Manage Users"
  | "Manage Brokers"
  | "Manage Branches"
  | "Expenses"
  | "Bank Verification"
  | "Attendance"
  | "Staff Performance"
  | "GPS Tracking"
  | "Accounting Module"
  | "Notifications"
  | "Reports"
  | "Approvals"
  | "Company Settings";

type DashboardData = {
  success: boolean;
  company: Record<string, any>;
  stats: Record<string, number>;
  users: any[];
  branches: any[];
  expenses: any[];
  bankVerifications: any[];
  attendance: any[];
  attendanceSummary: any[];
  notifications: any[];
  gpsDevices: any[];
  gpsPings: any[];
  settings: Record<string, any>;
  activities: any[];
  financialDays: any[];
  customers: any[];
  serviceActivities: any[];
  brokers: BrokerCustomerItem[];
  brokerLoadError?: string;
};

type IconType = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}>;

const PROFILE_KEY = "simamia_company_admin_profile";
const SIDEBAR_KEY = "simamia_company_admin_sidebar";

const emptyUserForm = {
  id: "",
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  role: "STAFF",
  branchId: "",
  status: "ACTIVE",
};

const emptyBranchForm = {
  id: "",
  name: "",
  code: "",
  region: "",
  address: "",
  status: "ACTIVE",
};

const emptyBrokerForm: BrokerCustomerForm = {
  id: "",
  code: "",
  name: "",
  businessName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  location: "",
  region: "",
  district: "",
  ward: "",
  address: "",
  latitude: "",
  longitude: "",
  status: "ACTIVE",
  notes: "",
};

const defaultSettings = {
  sms: true,
  email: true,
  inApp: true,
  gpsAlerts: true,
  dayClosingLock: true,
  attendanceApproval: true,
  bankMismatchHold: true,
  lowCashAlert: true,
  accent: "TEAL",
  currency: "TZS",
  timezone: "Africa/Dar_es_Salaam",
};

const navigation: Array<{
  page: PageName;
  icon: IconType;
  section: string;
}> = [
  { page: "Dashboard", icon: LayoutDashboard, section: "Workspace" },
  { page: "Manage Users", icon: Users, section: "Management" },
  { page: "Manage Brokers", icon: UserCheck, section: "Management" },
  { page: "Manage Branches", icon: Building2, section: "Management" },
  { page: "Expenses", icon: ReceiptText, section: "Finance" },
  { page: "Bank Verification", icon: Landmark, section: "Finance" },
  { page: "Attendance", icon: CalendarCheck2, section: "Workforce" },
  { page: "Staff Performance", icon: Trophy, section: "Workforce" },
  { page: "GPS Tracking", icon: MapPinned, section: "Tracking" },
  { page: "Accounting Module", icon: BookOpen, section: "Finance" },
  { page: "Notifications", icon: Bell, section: "Communication" },
  { page: "Reports", icon: FileBarChart2, section: "Insights" },
  { page: "Approvals", icon: CheckCircle2, section: "Controls" },
  { page: "Company Settings", icon: Settings, section: "System" },
];

function safeText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

async function requestJson<T = any>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });

  const text = await response.text();
  let result: any = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`The server returned invalid JSON (${response.status}).`);
  }

  if (!response.ok || result.success === false) {
    const message =
      safeText(result.message) ||
      `Request failed (${response.status}) for ${url}.`;
    const detail = safeText(result.error);

    throw new Error(
      detail && detail !== message ? `${message} ${detail}` : message,
    );
  }

  return result as T;
}

async function uploadDocument(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const result = await requestJson<{ success: true; url: string }>(
    "/api/company-admin/uploads",
    {
      method: "POST",
      body: formData,
    },
  );

  return result.url;
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatMoneyShort(value: unknown) {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) >= 1_000_000_000) {
    return `TZS ${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `TZS ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `TZS ${(amount / 1_000).toFixed(1)}K`;
  }
  return `TZS ${Math.round(amount).toLocaleString()}`;
}

function formatDate(value: unknown, withTime = false) {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function dateInputValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUserForm(item: any) {
  return {
    id: safeText(item?.id),
    name: safeText(item?.name),
    username: safeText(item?.username),
    email: safeText(item?.email),
    phone: safeText(item?.phone),
    password: "",
    role: safeText(item?.role) || "STAFF",
    branchId: safeText(item?.branchId),
    status: safeText(item?.status) || "ACTIVE",
  };
}

function normalizeBranchForm(item: any) {
  return {
    id: safeText(item?.id),
    name: safeText(item?.name),
    code: safeText(item?.code),
    region: safeText(item?.region),
    address: safeText(item?.address),
    status: safeText(item?.status) || "ACTIVE",
  };
}

function normalizeBrokerForm(item: BrokerCustomerItem): BrokerCustomerForm {
  return {
    id: safeText(item.id),
    code: safeText(item.code),
    name: safeText(item.name),
    businessName: safeText(item.businessName),
    phone: safeText(item.phone),
    alternatePhone: safeText(item.alternatePhone),
    email: safeText(item.email),
    location: safeText(item.location),
    region: safeText(item.region),
    district: safeText(item.district),
    ward: safeText(item.ward),
    address: safeText(item.address),
    latitude:
      item.latitude === null || item.latitude === undefined
        ? ""
        : String(item.latitude),
    longitude:
      item.longitude === null || item.longitude === undefined
        ? ""
        : String(item.longitude),
    status: item.status || "ACTIVE",
    notes: safeText(item.notes),
  };
}

export default function CompanyAdminDashboardClient({ user }: Props) {
  const router = useRouter();
  const [activePage, setActivePage] = useState<PageName>("Dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const unreadCount = safeArray<any>(data?.notifications).filter(
    (item) => !item.isRead,
  ).length;

  useEffect(() => {
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedSidebar = localStorage.getItem(SIDEBAR_KEY);

    if (savedProfile) setProfileImage(savedProfile);
    if (savedSidebar === "collapsed") setSidebarCollapsed(true);

    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function loadDashboard(showLoader = true) {
    if (showLoader) setLoading(true);
    setErrorMessage("");

    try {
      const dashboardResult = await requestJson<
        Omit<DashboardData, "brokers" | "brokerLoadError">
      >("/api/company-admin/dashboard");

      let brokers: BrokerCustomerItem[] = [];
      let brokerLoadError = "";

      try {
        const brokerResult = await requestJson<{
          success: true;
          brokers: BrokerCustomerItem[];
          setupRequired?: boolean;
          warning?: string;
        }>("/api/company-admin/brokers");

        brokers = safeArray<BrokerCustomerItem>(brokerResult.brokers);
        brokerLoadError = safeText(brokerResult.warning);
      } catch (brokerError) {
        brokerLoadError =
          brokerError instanceof Error
            ? brokerError.message
            : "Could not load broker customers.";

        // The broker directory is optional during dashboard startup.
        // Do not use console.error here because Next.js development mode
        // displays caught console errors as a Turbopack error overlay.
      }

      setData({
        ...dashboardResult,
        brokers,
        brokerLoadError,
      });

      if (brokerLoadError) {
        setToast(
          "Dashboard loaded, but the broker directory needs database setup.",
        );
      }
    } catch (error) {
      setData(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Dashboard loading failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openPage(page: PageName) {
    setActivePage(page);
    setShowNotifications(false);
    setMobileSidebarOpen(false);
  }

  function toggleSidebar() {
    if (window.innerWidth <= 920) {
      setMobileSidebarOpen((current) => !current);
      return;
    }

    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }

  function runSearch() {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const match = navigation.find((item) =>
      item.page.toLowerCase().includes(query),
    );

    if (!match) {
      setToast(`No dashboard section matched “${searchQuery}”.`);
      return;
    }

    openPage(match.page);
    setSearchQuery("");
  }

  async function handleProfileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    if (file.size > 3 * 1024 * 1024) {
      setToast("Profile image must be smaller than 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = safeText(reader.result);
      localStorage.setItem(PROFILE_KEY, result);
      setProfileImage(result);
    };
    reader.readAsDataURL(file);
  }

  async function markNotificationRead(id: string) {
    try {
      await requestJson(`/api/company-admin/notifications/${id}/read`, {
        method: "PATCH",
      });
      await loadDashboard(false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not mark read.");
    }
  }

  async function markAllNotificationsRead() {
    try {
      await requestJson("/api/company-admin/notifications/read-all", {
        method: "PATCH",
      });
      await loadDashboard(false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const currentNav = navigation.find((item) => item.page === activePage);
  const CurrentIcon = currentNav?.icon ?? LayoutDashboard;

  return (
    <main
      className={`${styles.page} ${
        sidebarCollapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <button
        type="button"
        className={`${styles.mobileBackdrop} ${
          mobileSidebarOpen ? styles.mobileBackdropShow : ""
        }`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-label="Close sidebar"
      />

      <aside
        className={`${styles.sidebar} ${
          mobileSidebarOpen ? styles.sidebarMobileOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <WalletCards size={25} />
          </div>
          <div className={styles.brandText}>
            <strong>Simamia Float</strong>
            <span>{safeText(data?.company?.name) || "Company Admin"}</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={toggleSidebar}
          aria-label={
            mobileSidebarOpen
              ? "Close sidebar"
              : sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
          }
          title={
            mobileSidebarOpen
              ? "Close sidebar"
              : sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
          }
        >
          {mobileSidebarOpen || !sidebarCollapsed ? (
            <PanelLeftClose size={20} />
          ) : (
            <PanelLeftOpen size={20} />
          )}
        </button>

        <nav className={styles.navigation}>
          {Array.from(new Set(navigation.map((item) => item.section))).map(
            (section) => (
              <div className={styles.navSection} key={section}>
                <small>{section}</small>
                {navigation
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = item.page === activePage;

                    return (
                      <button
                        type="button"
                        key={item.page}
                        className={isActive ? styles.activeNav : ""}
                        onClick={() => openPage(item.page)}
                        title={item.page}
                      >
                        <span>
                          <Icon size={19} strokeWidth={2.2} />
                        </span>
                        <b>{item.page}</b>
                        {item.page === "Notifications" && unreadCount > 0 && (
                          <em>{unreadCount}</em>
                        )}
                      </button>
                    );
                  })}
              </div>
            ),
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.securityPulse}>
            <ShieldCheck size={20} />
            <span>
              <strong>Protected workspace</strong>
              <small>Company-level RBAC enabled</small>
            </span>
          </div>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={toggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>

          <div className={styles.workspacePill}>
            <span>
              <CurrentIcon size={20} />
            </span>
            <div>
              <small>Current workspace</small>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className={styles.searchBox}>
            <Search size={19} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              placeholder="Search dashboard section..."
            />
            <button type="button" onClick={runSearch}>
              Search
            </button>
          </div>

          <div className={styles.topbarActions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setShowNotifications((current) => !current)}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className={styles.notificationDot}>{unreadCount}</span>
              )}
            </button>

            <button
              type="button"
              className={styles.iconButton}
              onClick={() => void loadDashboard(false)}
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={20} />
            </button>

            <label className={styles.profileBox}>
              <span className={styles.profileImage}>
                {profileImage ? (
                  <img src={profileImage} alt={user.name} />
                ) : (
                  <UserCircle2 size={22} />
                )}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileUpload}
              />
              <span>
                <strong>{user.name}</strong>
                <small>Company Admin</small>
              </span>
            </label>

            <button
              type="button"
              className={styles.logoutButton}
              onClick={logout}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>

          {showNotifications && (
            <div className={styles.notificationPopup}>
              <div className={styles.popupHeader}>
                <div>
                  <strong>Notifications</strong>
                  <small>{unreadCount} unread</small>
                </div>
                <button type="button" onClick={markAllNotificationsRead}>
                  Mark all read
                </button>
              </div>
              <div className={styles.popupList}>
                {safeArray<any>(data?.notifications).length ? (
                  safeArray<any>(data?.notifications)
                    .slice(0, 12)
                    .map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={item.isRead ? styles.readNotice : ""}
                        onClick={() => markNotificationRead(item.id)}
                      >
                        <span>
                          {item.type === "BANK" ? (
                            <Landmark size={18} />
                          ) : item.type === "EXPENSE" ? (
                            <ReceiptText size={18} />
                          ) : (
                            <Bell size={18} />
                          )}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.message}</p>
                          <small>{formatDate(item.createdAt, true)}</small>
                        </div>
                      </button>
                    ))
                ) : (
                  <div className={styles.emptyState}>
                    <Bell size={28} />
                    <p>No notifications found.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {toast && <div className={styles.toast}>{toast}</div>}

        {loading ? (
          <LoadingState />
        ) : errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={() => void loadDashboard()}
          />
        ) : data ? (
          <div className={styles.pageTransition} key={activePage}>
            <DashboardContent
              page={activePage}
              data={data}
              currentUser={user}
              busy={busy}
              setBusy={setBusy}
              reload={() => loadDashboard(false)}
              notify={setToast}
              openPage={openPage}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DashboardContent({
  page,
  data,
  currentUser,
  busy,
  setBusy,
  reload,
  notify,
  openPage,
}: {
  page: PageName;
  data: DashboardData;
  currentUser: Props["user"];
  busy: boolean;
  setBusy: (value: boolean) => void;
  reload: () => Promise<void>;
  notify: (message: string) => void;
  openPage: (page: PageName) => void;
}) {
  const common = {
    data,
    currentUser,
    busy,
    setBusy,
    reload,
    notify,
  };

  if (page === "Manage Users") return <UsersPage {...common} />;
  if (page === "Manage Brokers") return <BrokersPage {...common} />;
  if (page === "Manage Branches") return <BranchesPage {...common} />;
  if (page === "Expenses") return <ExpensesPage {...common} />;
  if (page === "Bank Verification") return <BankVerificationPage {...common} />;
  if (page === "Attendance") return <AttendancePage {...common} />;
  if (page === "Staff Performance") return <PerformancePage data={data} />;
  if (page === "GPS Tracking") return <GpsPage {...common} />;
  if (page === "Accounting Module") return <AccountingPage data={data} />;
  if (page === "Notifications") return <NotificationsPage {...common} />;
  if (page === "Reports") return <ReportsPage data={data} />;
  if (page === "Approvals") return <ApprovalsPage {...common} />;
  if (page === "Company Settings") return <SettingsPage {...common} />;

  return <HomeDashboard data={data} openPage={openPage} />;
}

function HomeDashboard({
  data,
  openPage,
}: {
  data: DashboardData;
  openPage: (page: PageName) => void;
}) {
  const latestExpenses = safeArray<any>(data.expenses).slice(0, 5);
  const latestBank = safeArray<any>(data.bankVerifications).slice(0, 5);
  const totalFlow =
    Number(data.stats.totalDeposits ?? 0) -
    Number(data.stats.approvedExpenses ?? 0);

  return (
    <section className={styles.dashboardWorkspace}>
      <div className={styles.dashboardHeading}>
        <div>
          <p className={styles.eyebrow}>Company financial command center</p>
          <h1>{safeText(data.company?.name) || "Company Dashboard"}</h1>
          <span>
            Live financial operations, employees, bank reviews, attendance and
            GPS activity from the database.
          </span>
        </div>
        <div className={styles.headingActions}>
          <button type="button" onClick={() => openPage("Expenses")}>
            <Plus size={17} /> Add expense
          </button>
          <button type="button" onClick={() => openPage("Reports")}>
            <FileBarChart2 size={17} /> Full report
          </button>
        </div>
      </div>

      <div className={styles.dashboardCanvas}>
        <div className={styles.dashboardMain}>
          <section className={styles.overviewTopGrid}>
            <article className={styles.accountCard}>
              <div className={styles.accountCardTop}>
                <div>
                  <small>Company account</small>
                  <strong>{safeText(data.company?.name)}</strong>
                </div>
                <span>SIMAMIA</span>
              </div>
              <p className={styles.accountNumber}>•••• •••• •••• 2026</p>
              <div className={styles.accountBalance}>
                <div>
                  <small>Net verified cash</small>
                  <strong>{formatMoney(totalFlow)}</strong>
                </div>
                <WalletCards size={31} />
              </div>
              <div className={styles.accountMeta}>
                <span>{safeText(data.company?.code) || "COMPANY"}</span>
                <b>LIVE DATABASE</b>
              </div>
            </article>

            <CompactMetric
              icon={TrendingUp}
              label="Total deposits"
              value={formatMoneyShort(data.stats.totalDeposits)}
              change={`${data.bankVerifications.length} records`}
              positive
            />
            <CompactMetric
              icon={TrendingDown}
              label="Approved expenses"
              value={formatMoneyShort(data.stats.approvedExpenses)}
              change={`${data.stats.pendingExpenses || 0} pending`}
            />
          </section>

          <section className={styles.quickActionPanel}>
            {[
              ["Users", Users, "Manage Users"],
              ["Brokers", UserCheck, "Manage Brokers"],
              ["Expense", ReceiptText, "Expenses"],
              ["Bank Review", Landmark, "Bank Verification"],
              ["Attendance", CalendarCheck2, "Attendance"],
              ["GPS", MapPinned, "GPS Tracking"],
              ["Reports", FileBarChart2, "Reports"],
            ].map(([label, Icon, page]) => {
              const Component = Icon as IconType;
              return (
                <button
                  type="button"
                  key={String(label)}
                  onClick={() => openPage(page as PageName)}
                >
                  <span>
                    <Component size={20} />
                  </span>
                  <b>{String(label)}</b>
                </button>
              );
            })}
          </section>

          <section className={styles.financeGrid}>
            <article className={styles.cashflowCard}>
              <CardHeader
                icon={Activity}
                title="Cashflow"
                subtitle="Verified deposits versus approved expenses"
              />
              <CashflowChart days={data.financialDays} />
            </article>

            <article className={styles.dailyLimitCard}>
              <CardHeader
                icon={Gauge}
                title="Operations health"
                subtitle="Live controls"
              />
              <ProgressRow
                label="Active users"
                value={data.stats.activeUsers}
                total={Math.max(1, data.stats.totalUsers)}
              />
              <ProgressRow
                label="Verified bank records"
                value={
                  safeArray<any>(data.bankVerifications).filter(
                    (item) => item.status === "VERIFIED",
                  ).length
                }
                total={Math.max(1, data.bankVerifications.length)}
              />
              <ProgressRow
                label="Online GPS devices"
                value={Math.max(
                  0,
                  Number(data.stats.activeGpsDevices || 0) -
                    Number(data.stats.offlineGpsDevices || 0),
                )}
                total={Math.max(1, data.stats.activeGpsDevices)}
              />
            </article>
          </section>

          <section className={styles.tableDashboardGrid}>
            <article className={styles.transactionsCard}>
              <CardHeader
                icon={ReceiptText}
                title="Recent expenses"
                subtitle="Latest submitted expenses"
              />
              <div className={styles.compactList}>
                {latestExpenses.length ? (
                  latestExpenses.map((item) => (
                    <div key={item.id}>
                      <span className={styles.listIcon}>
                        <ReceiptText size={17} />
                      </span>
                      <div>
                        <strong>{item.category}</strong>
                        <small>
                          {item.createdByName} · {item.createdByRole}
                        </small>
                      </div>
                      <span>
                        <b>-{formatMoneyShort(item.amount)}</b>
                        <StatusBadge status={item.status} />
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyInline text="No expense records yet." />
                )}
              </div>
            </article>

            <article className={styles.transactionsCard}>
              <CardHeader
                icon={Landmark}
                title="Bank verification"
                subtitle="Most recent bank uploads"
              />
              <div className={styles.compactList}>
                {latestBank.length ? (
                  latestBank.map((item) => (
                    <div key={item.id}>
                      <span className={styles.listIcon}>
                        <Landmark size={17} />
                      </span>
                      <div>
                        <strong>{item.referenceNumber}</strong>
                        <small>{item.uploadedByName}</small>
                      </div>
                      <span>
                        <b>+{formatMoneyShort(item.amount)}</b>
                        <StatusBadge status={item.status} />
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyInline text="No bank records yet." />
                )}
              </div>
            </article>
          </section>
        </div>

        <aside className={styles.dashboardSide}>
          <article className={styles.statisticsCard}>
            <CardHeader
              icon={CircleDollarSign}
              title="Financial statistics"
              subtitle="Current database totals"
            />
            <DonutChart
              approved={Number(data.stats.approvedExpenses || 0)}
              deposits={Number(data.stats.totalDeposits || 0)}
              pending={Number(data.stats.pendingExpenses || 0)}
            />
            <div className={styles.legendList}>
              <LegendRow
                label="Verified deposits"
                value={formatMoneyShort(data.stats.totalDeposits)}
                kind="teal"
              />
              <LegendRow
                label="Approved expenses"
                value={formatMoneyShort(data.stats.approvedExpenses)}
                kind="purple"
              />
              <LegendRow
                label="Net position"
                value={formatMoneyShort(data.stats.netCash)}
                kind="orange"
              />
            </div>
          </article>

          <article className={styles.activityCard}>
            <CardHeader
              icon={Activity}
              title="Recent activity"
              subtitle="System audit trail"
            />
            <div className={styles.activityList}>
              {safeArray<any>(data.activities)
                .slice(0, 7)
                .map((item) => (
                  <div key={item.id}>
                    <span>
                      <Activity size={15} />
                    </span>
                    <div>
                      <strong>{item.action}</strong>
                      <p>{item.details || item.module}</p>
                      <small>{formatDate(item.createdAt, true)}</small>
                    </div>
                  </div>
                ))}
              {!safeArray<any>(data.activities).length && (
                <EmptyInline text="No audit activity yet." />
              )}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function UsersPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const [form, setForm] = useState(emptyUserForm);
  const users = safeArray<any>(data.users);

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      const editing = Boolean(form.id);
      await requestJson(
        editing
          ? `/api/company-admin/users/${form.id}`
          : "/api/company-admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            phone: safeText(form.phone),
            branchId: safeText(form.branchId),
          }),
        },
      );
      setForm(emptyUserForm);
      notify(editing ? "User updated successfully." : "User created.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save user.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      notify(status === "ACTIVE" ? "User reactivated." : "User deactivated.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (!window.confirm("Remove this user permanently?")) return;
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/users/${id}`, {
        method: "DELETE",
      });
      notify("User removed.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not remove user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={Users}
      title="Manage Users"
      subtitle="Create authenticated company users. Brokers are managed separately as customer records and do not receive login accounts."
    >
      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={saveUser}>
          <SectionHeading
            icon={form.id ? Pencil : Plus}
            title={form.id ? "Edit company user" : "Add company user"}
            text="All controlled input values are normalized to empty strings, so nullable database fields do not trigger React warnings."
          />

          <div className={styles.formGrid}>
            <Field label="Full name">
              <input
                value={safeText(form.name)}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Username">
              <input
                value={safeText(form.username)}
                onChange={(event) =>
                  setForm({ ...form, username: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={safeText(form.email)}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Phone">
              <input
                value={safeText(form.phone)}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="+255..."
              />
            </Field>
            <Field label="Role">
              <select
                value={safeText(form.role) || "STAFF"}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
              >
                <option value="COMPANY_ADMIN">Company Admin</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="STAFF">Staff</option>
                <option value="GPS_MANAGER">GPS Manager</option>
              </select>
            </Field>
            <Field label="Branch">
              <select
                value={safeText(form.branchId)}
                onChange={(event) =>
                  setForm({ ...form, branchId: event.target.value })
                }
              >
                <option value="">No branch</option>
                {safeArray<any>(data.branches).map((branch) => (
                  <option value={branch.id} key={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={form.id ? "New password (optional)" : "Password"}>
              <input
                type="password"
                value={safeText(form.password)}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                required={!form.id}
              />
            </Field>
            <Field label="Status">
              <select
                value={safeText(form.status) || "ACTIVE"}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </Field>
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={busy}>
              <Save size={17} />
              {busy ? "Saving..." : form.id ? "Update user" : "Create user"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setForm(emptyUserForm)}
            >
              <X size={17} /> Clear
            </button>
          </div>
        </form>

        <TableCard
          title="Company users"
          subtitle={`${users.length} user records from the database`}
        >
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Username</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Entity
                      name={safeText(item.name)}
                      sub={safeText(item.email)}
                    />
                  </td>
                  <td>{safeText(item.username) || "N/A"}</td>
                  <td>{safeText(item.phone) || "N/A"}</td>
                  <td>{formatRole(item.role)}</td>
                  <td>{safeText(item.branchName) || "No branch"}</td>
                  <td>
                    <StatusBadge status={safeText(item.status)} />
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => setForm(normalizeUserForm(item))}
                      >
                        <Pencil size={15} />
                      </button>
                      {item.status === "ACTIVE" ? (
                        <button
                          type="button"
                          className={styles.warningAction}
                          onClick={() => changeStatus(item.id, "SUSPENDED")}
                          title="Deactivate"
                        >
                          <PowerOff size={15} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.successAction}
                          onClick={() => changeStatus(item.id, "ACTIVE")}
                          title="Reactivate"
                        >
                          <Power size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.dangerAction}
                        onClick={() => removeUser(item.id)}
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <EmptyTable colSpan={8} text="No users found." />
              )}
            </tbody>
          </DataTable>
        </TableCard>
      </div>
    </PageShell>
  );
}

function BrokersPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const brokers = safeArray<BrokerCustomerItem>(data.brokers);
  const [form, setForm] = useState<BrokerCustomerForm>(emptyBrokerForm);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          brokers
            .map((broker) => safeText(broker.location).trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [brokers],
  );

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
        ].some((value) => safeText(value).toLowerCase().includes(query));

      const locationMatches =
        !locationFilter ||
        safeText(broker.location).toLowerCase() ===
          locationFilter.toLowerCase();

      const statusMatches =
        !statusFilter || safeText(broker.status).toUpperCase() === statusFilter;

      return searchMatches && locationMatches && statusMatches;
    });
  }, [brokers, search, locationFilter, statusFilter]);

  const activeCount = brokers.filter(
    (broker) => broker.status === "ACTIVE",
  ).length;

  const inactiveCount = brokers.filter(
    (broker) => broker.status !== "ACTIVE",
  ).length;

  async function saveBroker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.location.trim()) {
      notify("Broker name, phone and location are required.");
      return;
    }

    setBusy(true);

    try {
      const editing = Boolean(form.id);

      await requestJson(
        editing
          ? `/api/company-admin/brokers/${form.id}`
          : "/api/company-admin/brokers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            latitude:
              form.latitude.trim() === "" ? null : Number(form.latitude),
            longitude:
              form.longitude.trim() === "" ? null : Number(form.longitude),
          }),
        },
      );

      setForm(emptyBrokerForm);
      notify(
        editing
          ? "Broker customer updated successfully."
          : "Broker customer registered successfully.",
      );
      await reload();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not save broker customer.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeBrokerStatus(id: string, status: BrokerCustomerStatus) {
    setBusy(true);

    try {
      await requestJson(`/api/company-admin/brokers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      notify(
        status === "ACTIVE"
          ? "Broker customer activated."
          : "Broker customer deactivated.",
      );
      await reload();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not update broker status.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeBroker(id: string) {
    if (
      !window.confirm(
        "Remove this broker customer? This does not delete any user because brokers are not login users.",
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await requestJson(`/api/company-admin/brokers/${id}`, {
        method: "DELETE",
      });

      if (form.id === id) {
        setForm(emptyBrokerForm);
      }

      notify("Broker customer removed.");
      await reload();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not remove broker customer.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={UserCheck}
      title="Manage Broker Customers"
      subtitle="Register brokers as customer records with their real service locations. They do not receive usernames, passwords or login access."
    >
      {data.brokerLoadError && (
        <section className={styles.brokerSetupError}>
          <div>
            <ShieldCheck size={22} />
          </div>
          <section>
            <strong>Broker database setup is incomplete</strong>
            <p>{data.brokerLoadError}</p>
            <small>
              Run Prisma migration and generation commands, clear .next, then
              restart the development server.
            </small>
          </section>
        </section>
      )}

      <section className={styles.brokerMetricGrid}>
        <ColorMetric
          icon={UserCheck}
          label="All brokers"
          value={String(brokers.length)}
          theme="purple"
        />
        <ColorMetric
          icon={CheckCircle2}
          label="Active brokers"
          value={String(activeCount)}
          theme="green"
        />
        <ColorMetric
          icon={PowerOff}
          label="Inactive / suspended"
          value={String(inactiveCount)}
          theme="red"
        />
        <ColorMetric
          icon={MapPin}
          label="Registered locations"
          value={String(locations.length)}
          theme="orange"
        />
      </section>

      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={saveBroker}>
          <SectionHeading
            icon={form.id ? Pencil : Plus}
            title={
              form.id ? "Edit broker customer" : "Register broker customer"
            }
            text="This form stores a broker as a company business/customer record. It does not create a record in the users table."
          />

          <div className={styles.brokerNotice}>
            <ShieldCheck size={19} />
            <div>
              <strong>No login account is created</strong>
              <p>
                Staff from the same company can view and select this broker when
                providing services.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <Field label="Broker code">
              <input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
                placeholder="Auto-generated when blank"
              />
            </Field>

            <Field label="Broker full name">
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Example: John Mushi"
                required
              />
            </Field>

            <Field label="Business / shop name">
              <input
                value={form.businessName}
                onChange={(event) =>
                  setForm({ ...form, businessName: event.target.value })
                }
                placeholder="Example: Mushi Mobile Money"
              />
            </Field>

            <Field label="Primary phone">
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="+255..."
                required
              />
            </Field>

            <Field label="Alternative phone">
              <input
                value={form.alternatePhone}
                onChange={(event) =>
                  setForm({
                    ...form,
                    alternatePhone: event.target.value,
                  })
                }
                placeholder="+255..."
              />
            </Field>

            <Field label="Email address">
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder="broker@example.com"
              />
            </Field>

            <Field label="Main location">
              <input
                value={form.location}
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
                placeholder="Example: Kariakoo"
                required
              />
            </Field>

            <Field label="Region">
              <input
                value={form.region}
                onChange={(event) =>
                  setForm({ ...form, region: event.target.value })
                }
                placeholder="Example: Dar es Salaam"
              />
            </Field>

            <Field label="District">
              <input
                value={form.district}
                onChange={(event) =>
                  setForm({ ...form, district: event.target.value })
                }
                placeholder="Example: Ilala"
              />
            </Field>

            <Field label="Ward">
              <input
                value={form.ward}
                onChange={(event) =>
                  setForm({ ...form, ward: event.target.value })
                }
                placeholder="Example: Kariakoo"
              />
            </Field>

            <Field label="Physical address">
              <input
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                placeholder="Street, building or landmark"
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as BrokerCustomerStatus,
                  })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </Field>

            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(event) =>
                  setForm({ ...form, latitude: event.target.value })
                }
                placeholder="-6.7924"
              />
            </Field>

            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(event) =>
                  setForm({ ...form, longitude: event.target.value })
                }
                placeholder="39.2083"
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="Services, opening hours or special instructions..."
              />
            </Field>
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={busy}>
              <Save size={17} />
              {busy
                ? "Saving..."
                : form.id
                  ? "Update broker"
                  : "Register broker"}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setForm(emptyBrokerForm)}
              disabled={busy}
            >
              <X size={17} /> Clear
            </button>
          </div>
        </form>

        <TableCard
          title="Registered broker customers"
          subtitle={`${filteredBrokers.length} of ${brokers.length} broker records`}
        >
          <section className={styles.brokerFilterBar}>
            <label>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, phone, code or address..."
              />
            </label>

            <label>
              <MapPin size={17} />
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option value={location} key={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <Filter size={17} />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setLocationFilter("");
                setStatusFilter("");
              }}
            >
              <RefreshCw size={16} /> Reset filters
            </button>
          </section>

          <DataTable minWidth={1350}>
            <thead>
              <tr>
                <th>#</th>
                <th>Broker</th>
                <th>Code</th>
                <th>Business</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Region / District</th>
                <th>Address</th>
                <th>Coordinates</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredBrokers.map((broker, index) => (
                <tr key={broker.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Entity
                      name={broker.name}
                      sub={broker.email || "Broker customer"}
                    />
                  </td>
                  <td>{broker.code}</td>
                  <td>{broker.businessName || "N/A"}</td>
                  <td>
                    <div className={styles.brokerContactCell}>
                      <strong>{broker.phone}</strong>
                      <small>{broker.alternatePhone || ""}</small>
                    </div>
                  </td>
                  <td>
                    <span className={styles.locationBadge}>
                      <MapPin size={13} /> {broker.location}
                    </span>
                  </td>
                  <td>
                    {[broker.region, broker.district, broker.ward]
                      .filter(Boolean)
                      .join(" / ") || "N/A"}
                  </td>
                  <td>{broker.address || "N/A"}</td>
                  <td>
                    {broker.latitude !== null && broker.longitude !== null
                      ? `${broker.latitude.toFixed(5)}, ${broker.longitude.toFixed(5)}`
                      : "Not set"}
                  </td>
                  <td>
                    <StatusBadge status={broker.status} />
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        title="Edit broker"
                        onClick={() => setForm(normalizeBrokerForm(broker))}
                      >
                        <Pencil size={15} />
                      </button>

                      {broker.status === "ACTIVE" ? (
                        <button
                          type="button"
                          className={styles.warningAction}
                          title="Deactivate broker"
                          onClick={() =>
                            changeBrokerStatus(broker.id, "INACTIVE")
                          }
                          disabled={busy}
                        >
                          <PowerOff size={15} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.successAction}
                          title="Activate broker"
                          onClick={() =>
                            changeBrokerStatus(broker.id, "ACTIVE")
                          }
                          disabled={busy}
                        >
                          <Power size={15} />
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.dangerAction}
                        title="Remove broker"
                        onClick={() => removeBroker(broker.id)}
                        disabled={busy}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredBrokers.length && (
                <EmptyTable
                  colSpan={11}
                  text="No broker customers match the selected location or search filters."
                />
              )}
            </tbody>
          </DataTable>
        </TableCard>
      </div>
    </PageShell>
  );
}

function BranchesPage({
  data,
  busy,
  setBusy,
  reload,
  notify,
}: CommonPageProps) {
  const [form, setForm] = useState(emptyBranchForm);

  async function saveBranch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const editing = Boolean(form.id);
      await requestJson(
        editing
          ? `/api/company-admin/branches/${form.id}`
          : "/api/company-admin/branches",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setForm(emptyBranchForm);
      notify(editing ? "Branch updated." : "Branch created.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save branch.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBranch(id: string) {
    if (!window.confirm("Remove this branch?")) return;
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/branches/${id}`, {
        method: "DELETE",
      });
      notify("Branch removed.");
      await reload();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not remove branch.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={Building2}
      title="Manage Branches"
      subtitle="Create and organize operational branches using real company database records."
    >
      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={saveBranch}>
          <SectionHeading
            icon={Building2}
            title={form.id ? "Edit branch" : "Add branch"}
            text="Branch codes should remain unique inside the company."
          />
          <div className={styles.formGrid}>
            <Field label="Branch name">
              <input
                value={safeText(form.name)}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Branch code">
              <input
                value={safeText(form.code)}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Region">
              <input
                value={safeText(form.region)}
                onChange={(event) =>
                  setForm({ ...form, region: event.target.value })
                }
              />
            </Field>
            <Field label="Address">
              <input
                value={safeText(form.address)}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </Field>
            <Field label="Status">
              <select
                value={safeText(form.status) || "ACTIVE"}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>
          <div className={styles.formActions}>
            <button disabled={busy} type="submit">
              <Save size={17} /> {form.id ? "Update branch" : "Save branch"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setForm(emptyBranchForm)}
            >
              <X size={17} /> Clear
            </button>
          </div>
        </form>

        <TableCard title="Branches" subtitle="All company branches">
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>Branch</th>
                <th>Code</th>
                <th>Region</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeArray<any>(data.branches).map((branch, index) => (
                <tr key={branch.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Entity
                      name={branch.name}
                      sub={branch.address || "No address"}
                    />
                  </td>
                  <td>{branch.code || "N/A"}</td>
                  <td>{branch.region || "N/A"}</td>
                  <td>
                    <StatusBadge status={branch.status} />
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        onClick={() => setForm(normalizeBranchForm(branch))}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles.dangerAction}
                        onClick={() => removeBranch(branch.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!safeArray<any>(data.branches).length && (
                <EmptyTable colSpan={6} text="No branches found." />
              )}
            </tbody>
          </DataTable>
        </TableCard>
      </div>
    </PageShell>
  );
}

function ExpensesPage({
  data,
  currentUser,
  busy,
  setBusy,
  reload,
  notify,
}: CommonPageProps) {
  const [form, setForm] = useState({
    category: "Fuel",
    amount: "",
    expenseDate: todayInput(),
    description: "",
    autoApprove: false,
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const receiptUrl = receipt ? await uploadDocument(receipt) : "";
      await requestJson("/api/company-admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          receiptUrl,
          amount: Number(form.amount),
        }),
      });
      setForm({
        category: "Fuel",
        amount: "",
        expenseDate: todayInput(),
        description: "",
        autoApprove: false,
      });
      setReceipt(null);
      notify("Expense saved and workflow notification created.");
      await reload();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not save expense.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decideExpense(id: string, status: "APPROVED" | "REJECTED") {
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote: decisionNote,
        }),
      });
      setDecisionNote("");
      notify(`Expense ${status.toLowerCase()}.`);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }

  const expenses = safeArray<any>(data.expenses);

  return (
    <PageShell
      icon={ReceiptText}
      title="Expense Management"
      subtitle="Submit expenses and review every expense made by company users, including their role and approval decision."
    >
      <section className={styles.metricStrip}>
        <ColorMetric
          icon={ReceiptText}
          label="All expenses"
          value={formatMoneyShort(data.stats.totalExpenses)}
          theme="purple"
        />
        <ColorMetric
          icon={Clock3}
          label="Pending"
          value={String(data.stats.pendingExpenses || 0)}
          theme="orange"
        />
        <ColorMetric
          icon={CheckCircle2}
          label="Approved"
          value={formatMoneyShort(data.stats.approvedExpenses)}
          theme="green"
        />
        <ColorMetric
          icon={X}
          label="Rejected"
          value={String(data.stats.rejectedExpenses || 0)}
          theme="red"
        />
      </section>

      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={submitExpense}>
          <SectionHeading
            icon={Plus}
            title="Add expense"
            text={`The expense will be recorded under ${currentUser.name} (${currentUser.role}).`}
          />
          <div className={styles.formGrid}>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {[
                  "Fuel",
                  "Transport",
                  "Airtime",
                  "Accommodation",
                  "Repairs",
                  "Stationery",
                  "Meals",
                  "Office Expenses",
                  "Emergency Expenses",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="1"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Expense date">
              <input
                type="date"
                value={form.expenseDate}
                onChange={(event) =>
                  setForm({ ...form, expenseDate: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows={4}
              />
            </Field>
            <Field label="Receipt / supporting document">
              <label className={styles.fileInput}>
                <UploadCloud size={20} />
                <span>{receipt?.name || "Choose JPG, PNG or PDF"}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(event) =>
                    setReceipt(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </Field>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={form.autoApprove}
                onChange={(event) =>
                  setForm({ ...form, autoApprove: event.target.checked })
                }
              />
              Auto-approve this admin-created expense
            </label>
          </div>
          <button className={styles.fullButton} type="submit" disabled={busy}>
            <Save size={17} /> {busy ? "Saving..." : "Submit expense"}
          </button>
        </form>

        <article className={styles.decisionCard}>
          <SectionHeading
            icon={ShieldCheck}
            title="Approval decision"
            text="Add an optional review note, then approve or reject a pending expense from the table."
          />
          <Field label="Decision note">
            <textarea
              rows={5}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              placeholder="Reason, correction request or approval note..."
            />
          </Field>
          <div className={styles.workflowDiagram}>
            <span>Submitted</span>
            <ChevronRight size={17} />
            <span>Admin review</span>
            <ChevronRight size={17} />
            <span>Approved / Rejected</span>
          </div>
        </article>
      </div>

      <TableCard
        title="All company expenses"
        subtitle="Serial number, user, role, receipt and approval decisions"
      >
        <DataTable>
          <thead>
            <tr>
              <th>S/N</th>
              <th>Expense owner</th>
              <th>Role</th>
              <th>Category</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Status</th>
              <th>Reviewer</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  <Entity
                    name={item.createdByName}
                    sub={item.description || "No description"}
                  />
                </td>
                <td>{formatRole(item.createdByRole)}</td>
                <td>{item.category}</td>
                <td>{formatDate(item.expenseDate)}</td>
                <td>{formatMoney(item.amount)}</td>
                <td>
                  {item.receiptUrl ? (
                    <a
                      className={styles.documentLink}
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={15} /> Review
                    </a>
                  ) : (
                    "No receipt"
                  )}
                </td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>{item.reviewedByName || "Pending"}</td>
                <td>
                  {item.status === "PENDING" ? (
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.successAction}
                        onClick={() => decideExpense(item.id, "APPROVED")}
                        title="Approve"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles.dangerAction}
                        onClick={() => decideExpense(item.id, "REJECTED")}
                        title="Reject"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className={styles.decisionDone}>Reviewed</span>
                  )}
                </td>
              </tr>
            ))}
            {!expenses.length && (
              <EmptyTable colSpan={10} text="No expenses have been recorded." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function BankVerificationPage({
  data,
  busy,
  setBusy,
  reload,
  notify,
}: CommonPageProps) {
  const records = safeArray<any>(data.bankVerifications);
  const [selectedId, setSelectedId] = useState(records[0]?.id || "");
  const [message, setMessage] = useState("");
  const selected =
    records.find((item) => item.id === selectedId) ?? records[0] ?? null;

  useEffect(() => {
    if (!selectedId && records[0]?.id) setSelectedId(records[0].id);
  }, [records, selectedId]);

  async function updateRecord(
    id: string,
    body: Record<string, unknown>,
    success: string,
  ) {
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/bank-verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      notify(success);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!selected || !message.trim()) return;
    setBusy(true);
    try {
      await requestJson(
        `/api/company-admin/bank-verifications/${selected.id}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
      setMessage("");
      notify("Review message sent.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Message failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={Landmark}
      title="Bank Verification"
      subtitle="Review uploaded slips, receipts and statements, inspect transactions, communicate with the uploader and mark records seen."
    >
      <section className={styles.metricStrip}>
        {[
          ["Pending", "PENDING", Clock3, "orange"],
          ["Verified", "VERIFIED", FileCheck2, "green"],
          ["Mismatch", "AMOUNT_MISMATCH", TrendingDown, "red"],
          ["Missing receipt", "MISSING_RECEIPT", FileText, "purple"],
        ].map(([label, status, Icon, theme]) => {
          const Component = Icon as IconType;
          return (
            <ColorMetric
              key={String(status)}
              icon={Component}
              label={String(label)}
              value={String(
                records.filter((item) => item.status === status).length,
              )}
              theme={theme as any}
            />
          );
        })}
      </section>

      <div className={styles.bankLayout}>
        <TableCard
          title="Uploaded bank records"
          subtitle={`${records.length} transaction records`}
        >
          <DataTable>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Uploader</th>
                <th>Role</th>
                <th>Reference</th>
                <th>Deposit date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Seen</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {records.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Entity name={item.uploadedByName} sub={item.bankAccount} />
                  </td>
                  <td>{formatRole(item.uploadedByRole)}</td>
                  <td>{item.referenceNumber}</td>
                  <td>{formatDate(item.depositDate)}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.isSeenByAdmin ? (
                      <span className={styles.seenLabel}>
                        <Eye size={14} /> Seen
                      </span>
                    ) : (
                      <span className={styles.unseenLabel}>
                        <EyeOff size={14} /> New
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.reviewButton}
                      onClick={() => {
                        setSelectedId(item.id);
                        if (!item.isSeenByAdmin) {
                          void updateRecord(
                            item.id,
                            { isSeenByAdmin: true },
                            "Record marked as seen.",
                          );
                        }
                      }}
                    >
                      <Eye size={15} /> Open
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <EmptyTable colSpan={9} text="No bank uploads found." />
              )}
            </tbody>
          </DataTable>
        </TableCard>

        <article className={styles.bankReviewPanel}>
          {selected ? (
            <>
              <SectionHeading
                icon={Landmark}
                title={selected.referenceNumber}
                text={`${selected.uploadedByName} · ${formatRole(
                  selected.uploadedByRole,
                )}`}
              />

              <div className={styles.detailGrid}>
                <Detail label="Amount" value={formatMoney(selected.amount)} />
                <Detail label="Bank account" value={selected.bankAccount} />
                <Detail
                  label="Deposit date"
                  value={formatDate(selected.depositDate)}
                />
                <Detail
                  label="Uploaded"
                  value={formatDate(selected.createdAt, true)}
                />
              </div>

              <div className={styles.documentGrid}>
                <DocumentButton
                  label="Deposit slip"
                  url={selected.depositSlipUrl}
                />
                <DocumentButton
                  label="Bank receipt"
                  url={selected.bankReceiptUrl}
                />
                <DocumentButton
                  label="Bank statement"
                  url={selected.bankStatementUrl}
                />
              </div>

              <Field label="Verification decision">
                <select
                  value={selected.status}
                  disabled={busy}
                  onChange={(event) =>
                    updateRecord(
                      selected.id,
                      { status: event.target.value, isSeenByAdmin: true },
                      "Bank verification updated.",
                    )
                  }
                >
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="AMOUNT_MISMATCH">Amount mismatch</option>
                  <option value="MISSING_RECEIPT">Missing receipt</option>
                  <option value="DUPLICATE_DEPOSIT">Duplicate deposit</option>
                  <option value="MISSING_BANK_RECORD">
                    Missing bank record
                  </option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </Field>

              <div className={styles.messageTimeline}>
                {safeArray<any>(selected.messages).map((item) => (
                  <div key={item.id}>
                    <span>
                      <MessageSquareText size={15} />
                    </span>
                    <div>
                      <strong>
                        {item.senderName} · {formatRole(item.senderRole)}
                      </strong>
                      <p>{item.message}</p>
                      <small>{formatDate(item.createdAt, true)}</small>
                    </div>
                  </div>
                ))}
                {!safeArray<any>(selected.messages).length && (
                  <EmptyInline text="No review messages yet." />
                )}
              </div>

              <div className={styles.messageComposer}>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a message to the uploader..."
                  rows={3}
                />
                <button type="button" onClick={sendMessage} disabled={busy}>
                  <MessageSquareText size={16} /> Send message
                </button>
              </div>
            </>
          ) : (
            <EmptyInline text="Select a bank verification record." />
          )}
        </article>
      </div>
    </PageShell>
  );
}

function AttendancePage({
  data,
  busy,
  setBusy,
  reload,
  notify,
}: CommonPageProps) {
  const users = safeArray<any>(data.users);
  const records = safeArray<any>(data.attendance);

  const [period, setPeriod] = useState<AttendanceFilterPeriod>("WEEK");
  const [referenceDate, setReferenceDate] = useState(todayInput());
  const [roleFilter, setRoleFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");
  const [form, setForm] = useState({
    userId: users[0]?.id || "",
    attendanceDate: todayInput(),
    mark: "PRESENT",
    note: "",
  });

  useEffect(() => {
    if (!form.userId && users[0]?.id) {
      setForm((current) => ({ ...current, userId: users[0].id }));
    }

    if (!selectedUserId && users[0]?.id) {
      setSelectedUserId(users[0].id);
    }
  }, [users, form.userId, selectedUserId]);

  const range = useMemo(
    () => getAttendancePeriodRange(period, referenceDate),
    [period, referenceDate],
  );

  const columns = useMemo(
    () => buildAttendanceColumns(period, referenceDate),
    [period, referenceDate],
  );

  const visibleUsers = useMemo(() => {
    const query = userFilter.trim().toLowerCase();

    return users.filter((item) => {
      const roleMatches = !roleFilter || item.role === roleFilter;
      const userMatches =
        !query ||
        safeText(item.name).toLowerCase().includes(query) ||
        safeText(item.email).toLowerCase().includes(query) ||
        safeText(item.username).toLowerCase().includes(query);

      return roleMatches && userMatches;
    });
  }, [users, roleFilter, userFilter]);

  const filteredRecords = useMemo(
    () =>
      records.filter((item) =>
        dateIsInsideRange(item.attendanceDate, range.start, range.end),
      ),
    [records, range],
  );

  const dailyIndex = useMemo(() => {
    const map = new Map<string, any>();

    filteredRecords.forEach((item) => {
      map.set(
        `${safeText(item.userId)}:${localDateKey(item.attendanceDate)}`,
        item,
      );
    });

    return map;
  }, [filteredRecords]);

  async function saveAttendance(event: FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await requestJson("/api/company-admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      notify("Attendance journal updated.");
      await reload();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not save attendance.",
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedUser =
    users.find((item) => item.id === selectedUserId) ?? visibleUsers[0];

  const selectedPeriodRecords = filteredRecords.filter(
    (item) => item.userId === selectedUser?.id,
  );

  const periodSummary = summarizeAttendanceRange(selectedPeriodRecords);

  return (
    <PageShell
      icon={CalendarCheck2}
      title="Attendance Journal"
      subtitle="Filter the attendance journal by day, week, month or year, then review each employee using real database records."
    >
      <section className={styles.attendanceFilterPanel}>
        <div className={styles.periodTabs}>
          {(
            [
              ["DAY", "Day"],
              ["WEEK", "Week"],
              ["MONTH", "Month"],
              ["YEAR", "Year"],
            ] as Array<[AttendanceFilterPeriod, string]>
          ).map(([value, label]) => (
            <button
              type="button"
              className={period === value ? styles.activePeriod : ""}
              onClick={() => setPeriod(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.attendanceFilterFields}>
          <Field label="Reference date">
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
            />
          </Field>

          <Field label="Role">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="">All roles</option>
              <option value="COMPANY_ADMIN">Company Admin</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="STAFF">Staff</option>
              <option value="BROKER">Broker</option>
              <option value="GPS_MANAGER">GPS Manager</option>
            </select>
          </Field>

          <Field label="Search user">
            <input
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              placeholder="Name, username or email"
            />
          </Field>
        </div>

        <div className={styles.periodRangeLabel}>
          <CalendarDays size={18} />
          <span>
            <small>Displaying</small>
            <strong>{formatPeriodRange(range.start, range.end)}</strong>
          </span>
        </div>
      </section>

      <form className={styles.inlineForm} onSubmit={saveAttendance}>
        <Field label="User">
          <select
            value={form.userId}
            onChange={(event) =>
              setForm({ ...form, userId: event.target.value })
            }
            required
          >
            {users.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} — {formatRole(item.role)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date">
          <input
            type="date"
            value={form.attendanceDate}
            onChange={(event) =>
              setForm({ ...form, attendanceDate: event.target.value })
            }
            required
          />
        </Field>

        <Field label="Mark">
          <select
            value={form.mark}
            onChange={(event) => setForm({ ...form, mark: event.target.value })}
          >
            <option value="PRESENT">Present ✓</option>
            <option value="LATE">Late ⏱</option>
            <option value="ABSENT">Absent ✕</option>
            <option value="LEAVE">Leave</option>
            <option value="HOLIDAY">Holiday</option>
          </select>
        </Field>

        <Field label="Note">
          <input
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Optional"
          />
        </Field>

        <button type="submit" disabled={busy}>
          <Save size={17} /> Save mark
        </button>
      </form>

      <section className={styles.attendanceMetricGrid}>
        <AttendanceMetric
          icon={Check}
          label="Present"
          value={periodSummary.present}
          theme="green"
        />
        <AttendanceMetric
          icon={Clock3}
          label="Late"
          value={periodSummary.late}
          theme="orange"
        />
        <AttendanceMetric
          icon={X}
          label="Absent"
          value={periodSummary.absent}
          theme="red"
        />
        <AttendanceMetric
          icon={CalendarDays}
          label="Leave / Holiday"
          value={periodSummary.leave + periodSummary.holiday}
          theme="purple"
        />
      </section>

      <TableCard
        title="Attendance register"
        subtitle={`${periodLabel(period)} view · ${visibleUsers.length} users · ${filteredRecords.length} attendance records`}
      >
        <DataTable minWidth={Math.max(1000, columns.length * 76 + 390)}>
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Role</th>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>Period score</th>
              <th>Review</th>
            </tr>
          </thead>

          <tbody>
            {visibleUsers.map((item, rowIndex) => {
              const userPeriodRecords = filteredRecords.filter(
                (record) => record.userId === item.id,
              );
              const userSummary = summarizeAttendanceRange(userPeriodRecords);

              return (
                <tr key={item.id}>
                  <td>{rowIndex + 1}</td>
                  <td>
                    <Entity name={item.name} sub={item.email} />
                  </td>
                  <td>{formatRole(item.role)}</td>

                  {columns.map((column) => {
                    if (column.mode === "DAY") {
                      const mark = dailyIndex.get(
                        `${item.id}:${localDateKey(column.start)}`,
                      )?.mark;

                      return (
                        <td key={column.key}>
                          <AttendanceMark mark={mark} />
                        </td>
                      );
                    }

                    const monthRecords = userPeriodRecords.filter((record) =>
                      dateIsInsideRange(
                        record.attendanceDate,
                        column.start,
                        column.end,
                      ),
                    );

                    return (
                      <td key={column.key}>
                        <AttendanceAggregate records={monthRecords} />
                      </td>
                    );
                  })}

                  <td>
                    <AttendanceRate
                      value={userSummary.rate}
                      attended={userSummary.present + userSummary.late}
                      total={userSummary.workingRecords}
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      className={styles.reviewButton}
                      onClick={() => setSelectedUserId(item.id)}
                    >
                      <Eye size={15} /> Review
                    </button>
                  </td>
                </tr>
              );
            })}

            {!visibleUsers.length && (
              <EmptyTable
                colSpan={columns.length + 5}
                text="No users match the selected attendance filters."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>

      <div className={styles.attendanceReview}>
        <div>
          <SectionHeading
            icon={UserCheck}
            title={selectedUser?.name || "Select a user"}
            text={`${formatRole(
              selectedUser?.role,
            )} attendance for ${formatPeriodRange(range.start, range.end)}`}
          />

          <div className={styles.reviewStats}>
            <ReviewStat label="Present" value={String(periodSummary.present)} />
            <ReviewStat label="Late" value={String(periodSummary.late)} />
            <ReviewStat label="Absent" value={String(periodSummary.absent)} />
            <ReviewStat
              label="Attendance rate"
              value={`${periodSummary.rate}%`}
            />
          </div>
        </div>

        <div className={styles.attendanceLegend}>
          <span>
            <Check size={15} /> Present
          </span>
          <span>
            <Clock3 size={15} /> Late
          </span>
          <span>
            <X size={15} /> Absent
          </span>
          <span>
            <CalendarDays size={15} /> Leave/Holiday
          </span>
        </div>
      </div>
    </PageShell>
  );
}

function PerformancePage({ data }: { data: DashboardData }) {
  const rows = safeArray<any>(data.attendanceSummary);

  return (
    <PageShell
      icon={Trophy}
      title="Staff Performance"
      subtitle="Performance scores generated from real attendance records in the selected company."
    >
      <section className={styles.performanceGrid}>
        {rows.slice(0, 8).map((item, index) => (
          <article className={styles.performanceCard} key={item.userId}>
            <span className={styles.rankBadge}>#{index + 1}</span>
            <div className={styles.performanceAvatar}>
              {safeText(item.userName).slice(0, 1).toUpperCase()}
            </div>
            <h3>{item.userName}</h3>
            <p>{formatRole(item.userRole)}</p>
            <div
              className={styles.scoreRing}
              style={{ "--score": `${Math.min(100, item.score)}%` } as any}
            >
              <strong>{item.score}%</strong>
            </div>
            <StatusBadge status={item.rating} />
          </article>
        ))}
      </section>

      <TableCard
        title="Attendance-based KPI"
        subtitle="Present, late, absent and leave records"
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Role</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Leave</th>
              <th>Score</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.userId}>
                <td>{index + 1}</td>
                <td>{item.userName}</td>
                <td>{formatRole(item.userRole)}</td>
                <td>{item.present}</td>
                <td>{item.late}</td>
                <td>{item.absent}</td>
                <td>{item.leave}</td>
                <td>{item.score}%</td>
                <td>
                  <StatusBadge status={item.rating} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <EmptyTable colSpan={9} text="No performance data yet." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function GpsPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const devices = safeArray<any>(data.gpsDevices);
  const [selectedId, setSelectedId] = useState(devices[0]?.id || "");
  const [form, setForm] = useState({
    name: "",
    deviceType: "PHONE",
    ownerUserId: "",
  });
  const [newToken, setNewToken] = useState("");

  useEffect(() => {
    if (!selectedId && devices[0]?.id) setSelectedId(devices[0].id);
  }, [devices, selectedId]);

  const selected =
    devices.find((item) => item.id === selectedId) ?? devices[0] ?? null;

  async function createDevice(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await requestJson("/api/company-admin/gps-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setNewToken(result.device.deviceToken);
      setForm({ name: "", deviceType: "PHONE", ownerUserId: "" });
      notify("GPS device created. Copy the token now.");
      await reload();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Device creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeDeviceStatus(id: string, status: string) {
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/gps-devices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      notify(`GPS device ${status.toLowerCase()}.`);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const mapUrl =
    selected?.lastLatitude !== null &&
    selected?.lastLatitude !== undefined &&
    selected?.lastLongitude !== null &&
    selected?.lastLongitude !== undefined
      ? createOsmEmbedUrl(
          Number(selected.lastLatitude),
          Number(selected.lastLongitude),
        )
      : "";

  return (
    <PageShell
      icon={MapPinned}
      title="GPS Tracking"
      subtitle="Create tracked devices, connect a phone using its secure token, and review live location on OpenStreetMap."
    >
      <section className={styles.gpsLayout}>
        <article className={styles.mapPanel}>
          <div className={styles.mapHeader}>
            <div>
              <strong>{selected?.name || "No GPS device selected"}</strong>
              <span>
                {selected?.ownerName || "Unassigned"} ·{" "}
                {selected?.deviceType || "Device"}
              </span>
            </div>
            {selected && <StatusBadge status={deviceOnlineStatus(selected)} />}
          </div>

          {mapUrl ? (
            <iframe
              className={styles.mapFrame}
              src={mapUrl}
              title="Tracked device map"
              loading="lazy"
            />
          ) : (
            <div className={styles.mapEmpty}>
              <MapPin size={44} />
              <strong>No GPS position received</strong>
              <p>
                Open the phone tracker page and start sharing location using the
                device token.
              </p>
            </div>
          )}

          {selected && (
            <div className={styles.mapStats}>
              <MapStat
                icon={Navigation}
                label="Coordinates"
                value={
                  selected.lastLatitude == null
                    ? "Waiting"
                    : `${Number(selected.lastLatitude).toFixed(5)}, ${Number(
                        selected.lastLongitude,
                      ).toFixed(5)}`
                }
              />
              <MapStat
                icon={Gauge}
                label="Speed"
                value={
                  selected.speedKph == null
                    ? "N/A"
                    : `${Number(selected.speedKph).toFixed(1)} km/h`
                }
              />
              <MapStat
                icon={BatteryCharging}
                label="Battery"
                value={
                  selected.batteryLevel == null
                    ? "N/A"
                    : `${selected.batteryLevel}%`
                }
              />
              <MapStat
                icon={Signal}
                label="Last seen"
                value={formatDate(selected.lastSeenAt, true)}
              />
            </div>
          )}
        </article>

        <div className={styles.gpsSide}>
          <form className={styles.formCard} onSubmit={createDevice}>
            <SectionHeading
              icon={Smartphone}
              title="Register GPS device"
              text="A secure token is generated for the phone or tracking unit."
            />
            <div className={styles.formGrid}>
              <Field label="Device name">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Staff Phone 01"
                  required
                />
              </Field>
              <Field label="Device type">
                <select
                  value={form.deviceType}
                  onChange={(event) =>
                    setForm({ ...form, deviceType: event.target.value })
                  }
                >
                  <option value="PHONE">Phone</option>
                  <option value="MOTORCYCLE">Motorcycle tracker</option>
                  <option value="VEHICLE">Vehicle tracker</option>
                </select>
              </Field>
              <Field label="Assign user">
                <select
                  value={form.ownerUserId}
                  onChange={(event) =>
                    setForm({ ...form, ownerUserId: event.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {safeArray<any>(data.users).map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button className={styles.fullButton} disabled={busy}>
              <Plus size={17} /> Create device
            </button>
          </form>

          {newToken && (
            <div className={styles.tokenCard}>
              <ShieldCheck size={22} />
              <div>
                <strong>Copy this token now</strong>
                <code>{newToken}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(newToken)}
                >
                  Copy token
                </button>
              </div>
            </div>
          )}

          <div className={styles.integrationCard}>
            <SectionHeading
              icon={Smartphone}
              title="Phone integration"
              text="Open the tracker page on the phone, paste the token and allow precise GPS permission."
            />
            <ol>
              <li>Create a device above and copy its token.</li>
              <li>
                On the phone, open <code>/device-tracker</code>.
              </li>
              <li>Paste the token and press Start live tracking.</li>
              <li>Keep the browser page open while tracking.</li>
              <li>
                For a dedicated hardware tracker, configure it to POST JSON to{" "}
                <code>/api/gps/ping</code> with header{" "}
                <code>x-device-token</code>.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <TableCard
        title="Tracked devices"
        subtitle="Phone, motorcycle and vehicle trackers"
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>Device</th>
              <th>Owner</th>
              <th>Type</th>
              <th>Last location</th>
              <th>Battery</th>
              <th>Last seen</th>
              <th>Status</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device, index) => (
              <tr key={device.id}>
                <td>{index + 1}</td>
                <td>
                  <button
                    type="button"
                    className={styles.deviceSelect}
                    onClick={() => setSelectedId(device.id)}
                  >
                    <MapPin size={15} /> {device.name}
                  </button>
                </td>
                <td>{device.ownerName || "Unassigned"}</td>
                <td>{device.deviceType}</td>
                <td>
                  {device.lastLatitude == null
                    ? "Waiting"
                    : `${Number(device.lastLatitude).toFixed(4)}, ${Number(
                        device.lastLongitude,
                      ).toFixed(4)}`}
                </td>
                <td>
                  {device.batteryLevel == null
                    ? "N/A"
                    : `${device.batteryLevel}%`}
                </td>
                <td>{formatDate(device.lastSeenAt, true)}</td>
                <td>
                  <StatusBadge status={deviceOnlineStatus(device)} />
                </td>
                <td>
                  {device.status === "ACTIVE" ? (
                    <button
                      type="button"
                      className={styles.dangerTextButton}
                      onClick={() => changeDeviceStatus(device.id, "INACTIVE")}
                    >
                      <PowerOff size={15} /> Disable
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.successTextButton}
                      onClick={() => changeDeviceStatus(device.id, "ACTIVE")}
                    >
                      <Power size={15} /> Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!devices.length && (
              <EmptyTable colSpan={9} text="No GPS devices registered." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function AccountingPage({ data }: { data: DashboardData }) {
  const totals = {
    deposits: Number(data.stats.totalDeposits || 0),
    expenses: Number(data.stats.approvedExpenses || 0),
  };
  const profit = totals.deposits - totals.expenses;

  return (
    <PageShell
      icon={BookOpen}
      title="Accounting Module"
      subtitle="A live financial summary produced from verified deposits and approved expenses."
    >
      <section className={styles.metricStrip}>
        <ColorMetric
          icon={Landmark}
          label="Verified cash in"
          value={formatMoneyShort(totals.deposits)}
          theme="green"
        />
        <ColorMetric
          icon={ReceiptText}
          label="Approved cash out"
          value={formatMoneyShort(totals.expenses)}
          theme="red"
        />
        <ColorMetric
          icon={BadgeDollarSign}
          label="Net balance"
          value={formatMoneyShort(profit)}
          theme="purple"
        />
        <ColorMetric
          icon={WalletCards}
          label="Pending liabilities"
          value={String(data.stats.pendingExpenses || 0)}
          theme="orange"
        />
      </section>

      <div className={styles.accountingGrid}>
        {[
          ["Cash Book", "Verified deposits and approved expenses", BookOpen],
          ["Profit & Loss", `Current net: ${formatMoney(profit)}`, TrendingUp],
          [
            "Bank Reconciliation",
            `${data.stats.bankMismatches || 0} mismatches`,
            Landmark,
          ],
          ["General Ledger", "Audit-backed transaction activity", FileText],
          ["Trial Balance", "Debit and credit readiness", BadgeDollarSign],
          ["Cash Flow Statement", "Seven-day database trend", Activity],
        ].map(([title, textValue, Icon]) => {
          const Component = Icon as IconType;
          return (
            <article key={String(title)} className={styles.moduleCard}>
              <span>
                <Component size={21} />
              </span>
              <h3>{String(title)}</h3>
              <p>{String(textValue)}</p>
              <button type="button" onClick={() => window.print()}>
                Open report <ChevronRight size={15} />
              </button>
            </article>
          );
        })}
      </div>

      <TableCard
        title="Daily cash movement"
        subtitle="Seven-day verified cashflow"
      >
        <DataTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Opening</th>
              <th>Cash in</th>
              <th>Cash out</th>
              <th>Closing</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.financialDays).map((day) => (
              <tr key={day.id}>
                <td>{formatDate(day.date)}</td>
                <td>{formatMoney(day.openingBalance)}</td>
                <td>{formatMoney(day.cashIn)}</td>
                <td>{formatMoney(day.cashOut)}</td>
                <td>{formatMoney(day.closingBalance)}</td>
                <td>
                  <StatusBadge status={day.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function NotificationsPage({ data, reload, notify }: CommonPageProps) {
  const notifications = safeArray<any>(data.notifications);

  async function readOne(id: string) {
    try {
      await requestJson(`/api/company-admin/notifications/${id}/read`, {
        method: "PATCH",
      });
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function readAll() {
    try {
      await requestJson("/api/company-admin/notifications/read-all", {
        method: "PATCH",
      });
      notify("All notifications marked as read.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <PageShell
      icon={Bell}
      title="Notification Center"
      subtitle="Live company notifications with unread counting and automatic count removal after reading."
      action={
        <button type="button" onClick={readAll}>
          <CheckCircle2 size={17} /> Mark all read
        </button>
      }
    >
      <section className={styles.notificationGrid}>
        {notifications.map((item) => (
          <article
            className={`${styles.notificationCard} ${
              item.isRead ? styles.notificationRead : ""
            }`}
            key={item.id}
          >
            <span className={styles.notificationTypeIcon}>
              {item.type === "BANK" ? (
                <Landmark size={21} />
              ) : item.type === "EXPENSE" ? (
                <ReceiptText size={21} />
              ) : item.type === "ATTENDANCE" ? (
                <CalendarCheck2 size={21} />
              ) : (
                <Bell size={21} />
              )}
            </span>
            <div>
              <div className={styles.notificationTitleRow}>
                <strong>{item.title}</strong>
                <StatusBadge status={item.isRead ? "READ" : "UNREAD"} />
              </div>
              <p>{item.message}</p>
              <small>{formatDate(item.createdAt, true)}</small>
            </div>
            {!item.isRead && (
              <button type="button" onClick={() => readOne(item.id)}>
                <Eye size={15} /> Mark read
              </button>
            )}
          </article>
        ))}
        {!notifications.length && (
          <div className={styles.largeEmpty}>
            <Bell size={40} />
            <h3>No notifications</h3>
            <p>New company alerts will appear here.</p>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function ReportsPage({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState({
    period: "MONTH" as ReportPeriod,
    from: "",
    to: "",
    branch: "",
    role: "",
    status: "",
    customer: "",
  });

  const range = useMemo(
    () =>
      getReportPeriodRange(filter.period, filter.from, filter.to, todayInput()),
    [filter.period, filter.from, filter.to],
  );

  const userMap = useMemo(
    () =>
      new Map(
        safeArray<any>(data.users).map((item) => [safeText(item.id), item]),
      ),
    [data.users],
  );

  const filteredServices = useMemo(() => {
    const customerQuery = filter.customer.trim().toLowerCase();

    return safeArray<any>(data.serviceActivities).filter((item) => {
      const servedAt = item.servedAt || item.createdAt;
      const staff = item.staff || userMap.get(safeText(item.staffId));
      const customer = item.customer;

      const dateMatches = dateIsInsideRange(servedAt, range.start, range.end);
      const branchMatches =
        !filter.branch || safeText(staff?.branchId) === filter.branch;
      const roleMatches = !filter.role || safeText(staff?.role) === filter.role;
      const statusMatches =
        !filter.status || safeText(item.status) === filter.status;
      const customerMatches =
        !customerQuery ||
        safeText(customer?.name).toLowerCase().includes(customerQuery) ||
        safeText(customer?.phone).toLowerCase().includes(customerQuery) ||
        safeText(customer?.email).toLowerCase().includes(customerQuery);

      return (
        dateMatches &&
        branchMatches &&
        roleMatches &&
        statusMatches &&
        customerMatches
      );
    });
  }, [
    data.serviceActivities,
    userMap,
    filter.branch,
    filter.role,
    filter.status,
    filter.customer,
    range,
  ]);

  const filteredAttendance = useMemo(
    () =>
      safeArray<any>(data.attendance).filter((item) => {
        const user = userMap.get(safeText(item.userId));

        return (
          dateIsInsideRange(item.attendanceDate, range.start, range.end) &&
          (!filter.branch || safeText(user?.branchId) === filter.branch) &&
          (!filter.role || safeText(item.userRole) === filter.role)
        );
      }),
    [data.attendance, userMap, filter.branch, filter.role, range],
  );

  const customerServiceRows = useMemo(
    () =>
      buildCustomerServiceSummary(
        safeArray<any>(data.serviceActivities),
        filteredServices,
      ),
    [data.serviceActivities, filteredServices],
  );

  const attendanceReportRows = useMemo(() => {
    const map = new Map<string, any[]>();

    filteredAttendance.forEach((record) => {
      const key = safeText(record.userId);
      const current = map.get(key) ?? [];
      current.push(record);
      map.set(key, current);
    });

    return safeArray<any>(data.users)
      .filter((item) => {
        if (filter.branch && item.branchId !== filter.branch) return false;
        if (filter.role && item.role !== filter.role) return false;
        return map.has(item.id);
      })
      .map((item) => {
        const records = map.get(item.id) ?? [];
        return {
          user: item,
          ...summarizeAttendanceRange(records),
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [data.users, filteredAttendance, filter.branch, filter.role]);

  const serviceRevenue = filteredServices.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const uniqueCustomers = new Set(
    filteredServices
      .map((item) => safeText(item.customerId || item.customer?.id))
      .filter(Boolean),
  ).size;

  const uniqueStaff = new Set(
    filteredServices
      .map((item) => safeText(item.staffId || item.staff?.id))
      .filter(Boolean),
  ).size;

  const attendanceTotals = summarizeAttendanceRange(filteredAttendance);

  function downloadCsv(name: string, rows: Array<Array<string | number>>) {
    const content = rows
      .map((row) =>
        row
          .map((cell) => `"${safeText(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([content], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${name}-${todayInput()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const roleMap = safeArray<any>(data.users).reduce(
    (map: Map<string, number>, item) => {
      const role = safeText(item.role) || "UNKNOWN";
      map.set(role, (map.get(role) || 0) + 1);
      return map;
    },
    new Map<string, number>(),
  );

  const roleCounts: Array<[string, number]> = Array.from(roleMap.entries());

  return (
    <PageShell
      icon={FileBarChart2}
      title="Full System Reports"
      subtitle="Generate customer-service, staff, attendance, finance, bank and GPS reports directly from the company database."
      action={
        <button type="button" onClick={() => window.print()}>
          <Printer size={17} /> Print / PDF
        </button>
      }
    >
      <section className={styles.reportPeriodHero}>
        <div>
          <span>
            <FileBarChart2 size={25} />
          </span>
          <div>
            <small>Active report period</small>
            <strong>{formatPeriodRange(range.start, range.end)}</strong>
            <p>
              Customer services and attendance are filtered using the same
              reporting period.
            </p>
          </div>
        </div>

        <div className={styles.periodTabs}>
          {(
            [
              ["DAY", "Day"],
              ["WEEK", "Week"],
              ["MONTH", "Month"],
              ["YEAR", "Year"],
              ["CUSTOM", "Custom"],
            ] as Array<[ReportPeriod, string]>
          ).map(([value, label]) => (
            <button
              type="button"
              className={filter.period === value ? styles.activePeriod : ""}
              onClick={() => setFilter({ ...filter, period: value })}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.reportFilters}>
        <Field label="From">
          <input
            type="date"
            value={
              filter.period === "CUSTOM"
                ? filter.from
                : localDateKey(range.start)
            }
            disabled={filter.period !== "CUSTOM"}
            onChange={(event) =>
              setFilter({ ...filter, from: event.target.value })
            }
          />
        </Field>

        <Field label="To">
          <input
            type="date"
            value={
              filter.period === "CUSTOM" ? filter.to : localDateKey(range.end)
            }
            disabled={filter.period !== "CUSTOM"}
            onChange={(event) =>
              setFilter({ ...filter, to: event.target.value })
            }
          />
        </Field>

        <Field label="Branch">
          <select
            value={filter.branch}
            onChange={(event) =>
              setFilter({ ...filter, branch: event.target.value })
            }
          >
            <option value="">All branches</option>
            {safeArray<any>(data.branches).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Staff role">
          <select
            value={filter.role}
            onChange={(event) =>
              setFilter({ ...filter, role: event.target.value })
            }
          >
            <option value="">All roles</option>
            <option value="COMPANY_ADMIN">Company Admin</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="STAFF">Staff</option>
            <option value="BROKER">Broker</option>
            <option value="GPS_MANAGER">GPS Manager</option>
          </select>
        </Field>

        <Field label="Service status">
          <select
            value={filter.status}
            onChange={(event) =>
              setFilter({ ...filter, status: event.target.value })
            }
          >
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Field>

        <Field label="Search customer">
          <input
            value={filter.customer}
            onChange={(event) =>
              setFilter({ ...filter, customer: event.target.value })
            }
            placeholder="Name, phone or email"
          />
        </Field>
      </div>

      <section className={styles.customerServiceMetrics}>
        <ColorMetric
          icon={Users}
          label="Customers served"
          value={String(uniqueCustomers)}
          theme="purple"
        />
        <ColorMetric
          icon={UserCheck}
          label="Staff involved"
          value={String(uniqueStaff)}
          theme="green"
        />
        <ColorMetric
          icon={Activity}
          label="Services provided"
          value={String(filteredServices.length)}
          theme="orange"
        />
        <ColorMetric
          icon={BadgeDollarSign}
          label="Service value"
          value={formatMoneyShort(serviceRevenue)}
          theme="red"
        />
      </section>

      <section className={styles.reportCards}>
        <ReportCard
          icon={Users}
          title="Customer Service Report"
          description="Customer, serving staff, service frequency and value."
          onExport={() =>
            downloadCsv("customer-service-summary", [
              [
                "Customer",
                "Phone",
                "Email",
                "Staff",
                "Today",
                "This Week",
                "This Month",
                "This Year",
                "Selected Period",
                "Total Services",
                "Selected Value",
                "Last Service",
              ],
              ...customerServiceRows.map((item) => [
                item.customerName,
                item.phone,
                item.email,
                item.staffNames.join(" | "),
                item.dayCount,
                item.weekCount,
                item.monthCount,
                item.yearCount,
                item.selectedCount,
                item.totalCount,
                item.selectedValue,
                item.lastServedAt,
              ]),
            ])
          }
        />

        <ReportCard
          icon={Activity}
          title="Service Activity Details"
          description="Every service with customer, staff, role, date and amount."
          onExport={() =>
            downloadCsv("service-activity-details", [
              [
                "Customer",
                "Phone",
                "Service",
                "Staff",
                "Staff Role",
                "Broker",
                "Amount",
                "Status",
                "Served At",
              ],
              ...filteredServices.map((item) => [
                item.customer?.name || "Walk-in Customer",
                item.customer?.phone || "",
                item.serviceType,
                item.staff?.name || item.staffName || "Unknown",
                item.staff?.role || item.staffRole || "",
                item.brokerCustomer?.name || item.broker?.name || "",
                item.amount || 0,
                item.status,
                item.servedAt,
              ]),
            ])
          }
        />

        <ReportCard
          icon={CalendarCheck2}
          title="Attendance Report"
          description="Filtered attendance summary for day, week, month or year."
          onExport={() =>
            downloadCsv("attendance-period-report", [
              [
                "User",
                "Role",
                "Present",
                "Late",
                "Absent",
                "Leave",
                "Holiday",
                "Attendance Rate",
              ],
              ...attendanceReportRows.map((item) => [
                item.user.name,
                item.user.role,
                item.present,
                item.late,
                item.absent,
                item.leave,
                item.holiday,
                `${item.rate}%`,
              ]),
            ])
          }
        />

        <ReportCard
          icon={ReceiptText}
          title="Expense Report"
          description="Every expense, role, category, amount and approval."
          onExport={() =>
            downloadCsv("expense-report", [
              ["User", "Role", "Category", "Amount", "Status", "Date"],
              ...safeArray<any>(data.expenses).map((item) => [
                item.createdByName,
                item.createdByRole,
                item.category,
                item.amount,
                item.status,
                dateInputValue(item.expenseDate),
              ]),
            ])
          }
        />

        <ReportCard
          icon={Landmark}
          title="Bank Verification Report"
          description="References, documents, status and uploader records."
          onExport={() =>
            downloadCsv("bank-verification-report", [
              ["Uploader", "Role", "Reference", "Amount", "Status", "Date"],
              ...safeArray<any>(data.bankVerifications).map((item) => [
                item.uploadedByName,
                item.uploadedByRole,
                item.referenceNumber,
                item.amount,
                item.status,
                dateInputValue(item.depositDate),
              ]),
            ])
          }
        />

        <ReportCard
          icon={MapPinned}
          title="GPS Movement Report"
          description="Device status, location, battery, speed and last seen."
          onExport={() =>
            downloadCsv("gps-report", [
              [
                "Device",
                "Owner",
                "Type",
                "Latitude",
                "Longitude",
                "Battery",
                "Last Seen",
              ],
              ...safeArray<any>(data.gpsDevices).map((item) => [
                item.name,
                item.ownerName || "",
                item.deviceType,
                item.lastLatitude ?? "",
                item.lastLongitude ?? "",
                item.batteryLevel ?? "",
                item.lastSeenAt ?? "",
              ]),
            ])
          }
        />
      </section>

      <TableCard
        title="Customer service frequency"
        subtitle="Shows who received service, who served them and how often they were served."
      >
        <DataTable minWidth={1450}>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Contact</th>
              <th>Served by staff</th>
              <th>Service types</th>
              <th>Today</th>
              <th>This week</th>
              <th>This month</th>
              <th>This year</th>
              <th>Selected period</th>
              <th>Total</th>
              <th>Selected value</th>
              <th>Last service</th>
            </tr>
          </thead>

          <tbody>
            {customerServiceRows.map((item, index) => (
              <tr key={item.customerKey}>
                <td>{index + 1}</td>
                <td>
                  <Entity
                    name={item.customerName}
                    sub={item.email || item.region || "Customer"}
                  />
                </td>
                <td>{item.phone || "N/A"}</td>
                <td>
                  <div className={styles.staffServiceList}>
                    {item.staffNames.map((staffName: string) => (
                      <span key={staffName}>
                        <UserCheck size={13} /> {staffName}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{item.serviceTypes.join(", ") || "N/A"}</td>
                <td>
                  <ServiceCountBadge value={item.dayCount} />
                </td>
                <td>
                  <ServiceCountBadge value={item.weekCount} />
                </td>
                <td>
                  <ServiceCountBadge value={item.monthCount} />
                </td>
                <td>
                  <ServiceCountBadge value={item.yearCount} />
                </td>
                <td>
                  <ServiceCountBadge value={item.selectedCount} highlighted />
                </td>
                <td>{item.totalCount}</td>
                <td>{formatMoney(item.selectedValue)}</td>
                <td>{formatDate(item.lastServedAt, true)}</td>
              </tr>
            ))}

            {!customerServiceRows.length && (
              <EmptyTable
                colSpan={13}
                text="No customer service records match the selected filters."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>

      <TableCard
        title="Detailed service activity"
        subtitle={`${filteredServices.length} services in ${formatPeriodRange(
          range.start,
          range.end,
        )}`}
      >
        <DataTable minWidth={1250}>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Staff</th>
              <th>Staff role</th>
              <th>Broker</th>
              <th>Date and time</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>

          <tbody>
            {filteredServices.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  <Entity
                    name={
                      item.customer?.name ||
                      item.customerName ||
                      "Walk-in Customer"
                    }
                    sub={
                      item.customer?.phone ||
                      item.customer?.email ||
                      "No contact"
                    }
                  />
                </td>
                <td>{item.serviceType || "Service"}</td>
                <td>
                  <Entity
                    name={item.staff?.name || item.staffName || "Unknown staff"}
                    sub={item.staff?.email || ""}
                  />
                </td>
                <td>
                  {formatRole(item.staff?.role || item.staffRole || "STAFF")}
                </td>
                <td>
                  {item.brokerCustomer?.name ||
                    item.broker?.name ||
                    "No broker"}
                </td>
                <td>{formatDate(item.servedAt, true)}</td>
                <td>{formatMoney(item.amount)}</td>
                <td>
                  <StatusBadge status={item.status || "COMPLETED"} />
                </td>
                <td>{item.notes || "N/A"}</td>
              </tr>
            ))}

            {!filteredServices.length && (
              <EmptyTable
                colSpan={10}
                text="No service activities match the selected report filters."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>

      <section className={styles.attendanceReportHeader}>
        <div>
          <CalendarCheck2 size={23} />
          <span>
            <small>Attendance report</small>
            <strong>{formatPeriodRange(range.start, range.end)}</strong>
          </span>
        </div>

        <div>
          <span>Present: {attendanceTotals.present}</span>
          <span>Late: {attendanceTotals.late}</span>
          <span>Absent: {attendanceTotals.absent}</span>
          <span>Rate: {attendanceTotals.rate}%</span>
        </div>
      </section>

      <TableCard
        title="Filtered attendance summary"
        subtitle="Attendance is filtered using the same day, week, month, year or custom period."
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Leave</th>
              <th>Holiday</th>
              <th>Rate</th>
            </tr>
          </thead>

          <tbody>
            {attendanceReportRows.map((item, index) => (
              <tr key={item.user.id}>
                <td>{index + 1}</td>
                <td>
                  <Entity name={item.user.name} sub={item.user.email} />
                </td>
                <td>{formatRole(item.user.role)}</td>
                <td>{item.user.branchName || "No branch"}</td>
                <td>{item.present}</td>
                <td>{item.late}</td>
                <td>{item.absent}</td>
                <td>{item.leave}</td>
                <td>{item.holiday}</td>
                <td>
                  <AttendanceRate
                    value={item.rate}
                    attended={item.present + item.late}
                    total={item.workingRecords}
                  />
                </td>
              </tr>
            ))}

            {!attendanceReportRows.length && (
              <EmptyTable
                colSpan={10}
                text="No attendance records match the selected filters."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>

      <section className={styles.reportSummaryGrid}>
        <article className={styles.reportSummaryCard}>
          <CardHeader
            icon={Users}
            title="Users by role"
            subtitle="Real company account distribution"
          />
          {roleCounts.map(([role, count]) => (
            <div className={styles.reportLine} key={role}>
              <span>{formatRole(role)}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </article>

        <article className={styles.reportSummaryCard}>
          <CardHeader
            icon={BadgeDollarSign}
            title="Finance summary"
            subtitle="Verified versus approved"
          />
          <div className={styles.bigFinanceValue}>
            <span>Net position</span>
            <strong>{formatMoney(data.stats.netCash)}</strong>
          </div>
          <div className={styles.reportLine}>
            <span>Verified deposits</span>
            <strong>{formatMoney(data.stats.totalDeposits)}</strong>
          </div>
          <div className={styles.reportLine}>
            <span>Approved expenses</span>
            <strong>{formatMoney(data.stats.approvedExpenses)}</strong>
          </div>
          <div className={styles.reportLine}>
            <span>Selected service value</span>
            <strong>{formatMoney(serviceRevenue)}</strong>
          </div>
        </article>

        <article className={styles.reportSummaryCard}>
          <CardHeader
            icon={ShieldCheck}
            title="Control summary"
            subtitle="Pending operations requiring attention"
          />
          <div className={styles.reportLine}>
            <span>Pending expenses</span>
            <strong>{data.stats.pendingExpenses || 0}</strong>
          </div>
          <div className={styles.reportLine}>
            <span>Pending bank checks</span>
            <strong>{data.stats.pendingBankVerifications || 0}</strong>
          </div>
          <div className={styles.reportLine}>
            <span>Offline GPS</span>
            <strong>{data.stats.offlineGpsDevices || 0}</strong>
          </div>
          <div className={styles.reportLine}>
            <span>Services in selected period</span>
            <strong>{filteredServices.length}</strong>
          </div>
        </article>
      </section>
    </PageShell>
  );
}

function ApprovalsPage({
  data,
  busy,
  setBusy,
  reload,
  notify,
}: CommonPageProps) {
  const pendingExpenses = safeArray<any>(data.expenses).filter(
    (item) => item.status === "PENDING",
  );
  const pendingBank = safeArray<any>(data.bankVerifications).filter(
    (item) => item.status === "PENDING",
  );

  async function approveExpense(id: string, status: string) {
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      notify("Expense decision saved.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyBank(id: string, status: string) {
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/bank-verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, isSeenByAdmin: true }),
      });
      notify("Bank decision saved.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={CheckCircle2}
      title="Approval Center"
      subtitle="One decision workspace for pending expenses and bank verification records."
    >
      <section className={styles.approvalGrid}>
        <article className={styles.approvalColumn}>
          <SectionHeading
            icon={ReceiptText}
            title={`Pending expenses (${pendingExpenses.length})`}
            text="Approve or reject financial requests."
          />
          {pendingExpenses.map((item) => (
            <div className={styles.approvalItem} key={item.id}>
              <span>
                <ReceiptText size={18} />
              </span>
              <div>
                <strong>{item.category}</strong>
                <p>
                  {item.createdByName} · {formatRole(item.createdByRole)}
                </p>
                <small>{formatMoney(item.amount)}</small>
              </div>
              <div className={styles.approvalActions}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approveExpense(item.id, "APPROVED")}
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approveExpense(item.id, "REJECTED")}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
          {!pendingExpenses.length && (
            <EmptyInline text="No pending expenses." />
          )}
        </article>

        <article className={styles.approvalColumn}>
          <SectionHeading
            icon={Landmark}
            title={`Pending bank records (${pendingBank.length})`}
            text="Verify or flag uploaded bank transactions."
          />
          {pendingBank.map((item) => (
            <div className={styles.approvalItem} key={item.id}>
              <span>
                <Landmark size={18} />
              </span>
              <div>
                <strong>{item.referenceNumber}</strong>
                <p>{item.uploadedByName}</p>
                <small>{formatMoney(item.amount)}</small>
              </div>
              <div className={styles.approvalActions}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => verifyBank(item.id, "VERIFIED")}
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => verifyBank(item.id, "AMOUNT_MISMATCH")}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
          {!pendingBank.length && (
            <EmptyInline text="No pending bank records." />
          )}
        </article>
      </section>
    </PageShell>
  );
}

function SettingsPage({
  data,
  busy,
  setBusy,
  reload,
  notify,
}: CommonPageProps) {
  const [settings, setSettings] = useState({
    ...defaultSettings,
    ...(data.settings || {}),
  });

  async function saveSettings() {
    setBusy(true);
    try {
      await requestJson("/api/company-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      notify("Company settings saved.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Settings failed.");
    } finally {
      setBusy(false);
    }
  }

  const toggles = [
    [
      "sms",
      "SMS notifications",
      "Send selected financial alerts by SMS.",
      Smartphone,
    ],
    [
      "email",
      "Email notifications",
      "Email reports and workflow alerts.",
      MessageSquareText,
    ],
    [
      "inApp",
      "In-app notifications",
      "Show live alerts inside the portal.",
      Bell,
    ],
    [
      "gpsAlerts",
      "GPS alerts",
      "Notify on offline, overspeed and geofence events.",
      MapPinned,
    ],
    [
      "dayClosingLock",
      "Day closing lock",
      "Prevent closing when mismatches are unresolved.",
      ShieldCheck,
    ],
    [
      "attendanceApproval",
      "Attendance approval",
      "Require approval for manual attendance changes.",
      CalendarCheck2,
    ],
    [
      "bankMismatchHold",
      "Bank mismatch hold",
      "Apply controlled financial hold after mismatch.",
      Landmark,
    ],
    [
      "lowCashAlert",
      "Low cash alert",
      "Notify management when cash falls below threshold.",
      CircleDollarSign,
    ],
  ] as const;

  return (
    <PageShell
      icon={Settings}
      title="Company Settings"
      subtitle="Persist company notification, security, finance, attendance and display preferences in the database."
      action={
        <button type="button" onClick={saveSettings} disabled={busy}>
          <Save size={17} /> Save settings
        </button>
      }
    >
      <section className={styles.settingsHero}>
        <div>
          <span>
            <Settings size={24} />
          </span>
          <div>
            <h2>{safeText(data.company?.name)}</h2>
            <p>
              Company ID: {safeText(data.company?.id)} · Status:{" "}
              {safeText(data.company?.status)}
            </p>
          </div>
        </div>
        <div className={styles.settingsSelects}>
          <Field label="Currency">
            <select
              value={safeText(settings.currency) || "TZS"}
              onChange={(event) =>
                setSettings({ ...settings, currency: event.target.value })
              }
            >
              <option value="TZS">TZS</option>
              <option value="USD">USD</option>
              <option value="KES">KES</option>
            </select>
          </Field>
          <Field label="Timezone">
            <select
              value={safeText(settings.timezone) || "Africa/Dar_es_Salaam"}
              onChange={(event) =>
                setSettings({ ...settings, timezone: event.target.value })
              }
            >
              <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <Field label="Accent">
            <select
              value={safeText(settings.accent) || "TEAL"}
              onChange={(event) =>
                setSettings({ ...settings, accent: event.target.value })
              }
            >
              <option value="TEAL">Teal</option>
              <option value="PURPLE">Purple</option>
              <option value="BLUE">Blue</option>
            </select>
          </Field>
        </div>
      </section>

      <section className={styles.settingsGrid}>
        {toggles.map(([key, title, description, Icon], index) => {
          const Component = Icon as IconType;
          const enabled = Boolean(settings[key]);
          return (
            <article
              className={`${styles.settingCard} ${
                enabled ? styles.settingEnabled : ""
              }`}
              key={key}
              style={{ "--delay": `${index * 45}ms` } as any}
            >
              <span>
                <Component size={22} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <button
                type="button"
                className={enabled ? styles.toggleOn : ""}
                onClick={() => setSettings({ ...settings, [key]: !enabled })}
                aria-label={`Toggle ${title}`}
              >
                <i></i>
              </button>
            </article>
          );
        })}
      </section>
    </PageShell>
  );
}

type CommonPageProps = {
  data: DashboardData;
  currentUser: Props["user"];
  busy: boolean;
  setBusy: (value: boolean) => void;
  reload: () => Promise<void>;
  notify: (message: string) => void;
};

function PageShell({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: IconType;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <Icon size={27} />
        </div>
        <div>
          <p>Company Admin Portal</p>
          <h1>{title}</h1>
          <span>{subtitle}</span>
        </div>
        {action && <div className={styles.pageHeaderAction}>{action}</div>}
      </header>
      {children}
    </section>
  );
}

function CardHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: IconType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className={styles.cardHeader}>
      <span>
        <Icon size={18} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  text,
}: {
  icon: IconType;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span>
        <Icon size={20} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TableCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.tableCard}>
      <div className={styles.tableCardHeader}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span>
          <FileText size={19} />
        </span>
      </div>
      {children}
    </article>
  );
}

function DataTable({
  children,
  minWidth = 900,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className={styles.tableScroll}>
      <table style={{ minWidth }}>{children}</table>
    </div>
  );
}

function Entity({ name, sub }: { name: string; sub: string }) {
  return (
    <div className={styles.entity}>
      <span>{safeText(name).slice(0, 1).toUpperCase() || "?"}</span>
      <div>
        <strong>{name || "Unnamed"}</strong>
        <small>{sub || "No details"}</small>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const value = safeText(status).toUpperCase();
  const className = [
    "ACTIVE",
    "APPROVED",
    "VERIFIED",
    "PRESENT",
    "EXCELLENT",
    "READ",
    "ONLINE",
  ].includes(value)
    ? styles.statusSuccess
    : ["PENDING", "LATE", "FAIR", "WARNING"].includes(value)
      ? styles.statusWarning
      : [
            "SUSPENDED",
            "REJECTED",
            "ABSENT",
            "AMOUNT_MISMATCH",
            "MISSING_RECEIPT",
            "DUPLICATE_DEPOSIT",
            "MISSING_BANK_RECORD",
            "OFFLINE",
            "INACTIVE",
          ].includes(value)
        ? styles.statusDanger
        : styles.statusNeutral;

  return (
    <span className={`${styles.statusBadge} ${className}`}>
      <i></i>
      {value.replaceAll("_", " ") || "N/A"}
    </span>
  );
}

function CompactMetric({
  icon: Icon,
  label,
  value,
  change,
  positive = false,
}: {
  icon: IconType;
  label: string;
  value: string;
  change: string;
  positive?: boolean;
}) {
  return (
    <article className={styles.compactMetric}>
      <div>
        <span>
          <Icon size={19} />
        </span>
        <em className={positive ? styles.positive : styles.negative}>
          {change}
        </em>
      </div>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function ColorMetric({
  icon: Icon,
  label,
  value,
  theme,
}: {
  icon: IconType;
  label: string;
  value: string;
  theme: "purple" | "green" | "orange" | "red";
}) {
  return (
    <article className={`${styles.colorMetric} ${styles[theme]}`}>
      <span>
        <Icon size={21} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function CashflowChart({ days }: { days: any[] }) {
  const list = safeArray<any>(days);
  const max = Math.max(
    1,
    ...list.flatMap((item) => [
      Number(item.cashIn || 0),
      Number(item.cashOut || 0),
    ]),
  );

  return (
    <div className={styles.cashflowChart}>
      <div className={styles.chartLegend}>
        <span>
          <i></i> Cash in
        </span>
        <span>
          <i></i> Cash out
        </span>
      </div>
      <div className={styles.chartBars}>
        {list.map((item) => (
          <div className={styles.chartDay} key={item.id}>
            <div className={styles.barPair}>
              <span
                style={{
                  height: `${Math.max(
                    6,
                    (Number(item.cashIn || 0) / max) * 100,
                  )}%`,
                }}
                title={formatMoney(item.cashIn)}
              ></span>
              <span
                style={{
                  height: `${Math.max(
                    6,
                    (Number(item.cashOut || 0) / max) * 100,
                  )}%`,
                }}
                title={formatMoney(item.cashOut)}
              ></span>
            </div>
            <small>
              {new Intl.DateTimeFormat("en-TZ", {
                weekday: "short",
              }).format(new Date(item.date))}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  return (
    <div className={styles.progressRow}>
      <div>
        <span>{label}</span>
        <strong>
          {value}/{total}
        </strong>
      </div>
      <div>
        <span style={{ width: `${percent}%` }}></span>
      </div>
    </div>
  );
}

function DonutChart({
  approved,
  deposits,
  pending,
}: {
  approved: number;
  deposits: number;
  pending: number;
}) {
  const total = Math.max(1, approved + deposits + pending);
  const first = Math.round((deposits / total) * 100);
  const second = first + Math.round((approved / total) * 100);

  return (
    <div
      className={styles.donutChart}
      style={{
        background: `radial-gradient(circle, white 0 47%, transparent 48%), conic-gradient(#0e9eaa 0 ${first}%, #6d35ff ${first}% ${second}%, #f59e0b ${second}% 100%)`,
      }}
    >
      <span>
        <strong>{formatMoneyShort(deposits - approved)}</strong>
        <small>Net cash</small>
      </span>
    </div>
  );
}

function LegendRow({
  label,
  value,
  kind,
}: {
  label: string;
  value: string;
  kind: string;
}) {
  return (
    <div className={styles.legendRow}>
      <span>
        <i className={styles[kind]}></i>
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function AttendanceMark({ mark }: { mark?: string }) {
  if (mark === "PRESENT") {
    return (
      <span className={`${styles.attendanceMark} ${styles.markPresent}`}>
        <Check size={15} />
      </span>
    );
  }
  if (mark === "LATE") {
    return (
      <span className={`${styles.attendanceMark} ${styles.markLate}`}>
        <Clock3 size={15} />
      </span>
    );
  }
  if (mark === "ABSENT") {
    return (
      <span className={`${styles.attendanceMark} ${styles.markAbsent}`}>
        <X size={15} />
      </span>
    );
  }
  if (mark === "LEAVE" || mark === "HOLIDAY") {
    return (
      <span className={`${styles.attendanceMark} ${styles.markLeave}`}>
        <CalendarDays size={15} />
      </span>
    );
  }
  return <span className={styles.attendanceEmpty}>—</span>;
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailItem}>
      <span>{label}</span>
      <strong>{value || "N/A"}</strong>
    </div>
  );
}

function DocumentButton({ label, url }: { label: string; url?: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <FileText size={17} />
      <span>
        <strong>{label}</strong>
        <small>Open document</small>
      </span>
    </a>
  ) : (
    <div className={styles.missingDocument}>
      <FileText size={17} />
      <span>
        <strong>{label}</strong>
        <small>Not uploaded</small>
      </span>
    </div>
  );
}

function MapStat({
  icon: Icon,
  label,
  value,
}: {
  icon: IconType;
  label: string;
  value: string;
}) {
  return (
    <article>
      <span>
        <Icon size={18} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  onExport,
}: {
  icon: IconType;
  title: string;
  description: string;
  onExport: () => void;
}) {
  return (
    <article className={styles.reportCard}>
      <span>
        <Icon size={23} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div>
        <button type="button" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </button>
        <button type="button" onClick={onExport}>
          <Download size={15} /> CSV
        </button>
      </div>
    </article>
  );
}

function EmptyTable({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className={styles.emptyTable}>
          <FileText size={25} />
          <span>{text}</span>
        </div>
      </td>
    </tr>
  );
}

function EmptyInline({ text }: { text: string }) {
  return (
    <div className={styles.emptyInline}>
      <FileText size={20} />
      <span>{text}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <section className={styles.loadingState}>
      <div className={styles.loader}></div>
      <h2>Loading real company data...</h2>
      <p>Users, expenses, bank records, attendance, GPS and reports.</p>
    </section>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={styles.errorState}>
      <X size={36} />
      <h2>Dashboard API error</h2>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        <RefreshCw size={17} /> Try again
      </button>
    </section>
  );
}

function formatRole(role: unknown) {
  return safeText(role)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deviceOnlineStatus(device: any) {
  if (device.status !== "ACTIVE") return "INACTIVE";
  if (!device.lastSeenAt) return "OFFLINE";
  return Date.now() - new Date(device.lastSeenAt).getTime() <= 10 * 60 * 1000
    ? "ONLINE"
    : "OFFLINE";
}

function createOsmEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.01;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(",");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

type AttendanceFilterPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";
type ReportPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

type AttendanceColumn = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  mode: "DAY" | "MONTH";
};

function localDateKey(value: unknown): string {
  const date =
    value instanceof Date ? new Date(value) : new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfLocalDay(value: unknown): Date {
  const date =
    value instanceof Date ? new Date(value) : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return startOfLocalDay(new Date());
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfLocalDay(value: unknown): Date {
  const date = startOfLocalDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfLocalWeek(value: unknown): Date {
  const date = startOfLocalDay(value);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + mondayOffset);
  return date;
}

function endOfLocalWeek(value: unknown): Date {
  const date = startOfLocalWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfLocalMonth(value: unknown): Date {
  const date = startOfLocalDay(value);
  date.setDate(1);
  return date;
}

function endOfLocalMonth(value: unknown): Date {
  const date = startOfLocalDay(value);
  date.setMonth(date.getMonth() + 1, 0);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfLocalYear(value: unknown): Date {
  const date = startOfLocalDay(value);
  date.setMonth(0, 1);
  return date;
}

function endOfLocalYear(value: unknown): Date {
  const date = startOfLocalDay(value);
  date.setMonth(11, 31);
  date.setHours(23, 59, 59, 999);
  return date;
}

function dateIsInsideRange(value: unknown, start: Date, end: Date): boolean {
  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return false;

  return date >= start && date <= end;
}

function getAttendancePeriodRange(
  period: AttendanceFilterPeriod,
  referenceDate: string,
) {
  if (period === "DAY") {
    return {
      start: startOfLocalDay(referenceDate),
      end: endOfLocalDay(referenceDate),
    };
  }

  if (period === "WEEK") {
    return {
      start: startOfLocalWeek(referenceDate),
      end: endOfLocalWeek(referenceDate),
    };
  }

  if (period === "MONTH") {
    return {
      start: startOfLocalMonth(referenceDate),
      end: endOfLocalMonth(referenceDate),
    };
  }

  return {
    start: startOfLocalYear(referenceDate),
    end: endOfLocalYear(referenceDate),
  };
}

function getReportPeriodRange(
  period: ReportPeriod,
  from: string,
  to: string,
  referenceDate: string,
) {
  if (period === "CUSTOM") {
    const start = from
      ? startOfLocalDay(from)
      : startOfLocalMonth(referenceDate);
    const end = to ? endOfLocalDay(to) : endOfLocalDay(referenceDate);

    return start <= end
      ? { start, end }
      : { start: startOfLocalDay(to), end: endOfLocalDay(from) };
  }

  return getAttendancePeriodRange(
    period as AttendanceFilterPeriod,
    referenceDate,
  );
}

function buildAttendanceColumns(
  period: AttendanceFilterPeriod,
  referenceDate: string,
): AttendanceColumn[] {
  const range = getAttendancePeriodRange(period, referenceDate);

  if (period === "YEAR") {
    const columns: AttendanceColumn[] = [];

    for (let month = 0; month < 12; month += 1) {
      const start = new Date(range.start.getFullYear(), month, 1);
      const end = new Date(
        range.start.getFullYear(),
        month + 1,
        0,
        23,
        59,
        59,
        999,
      );

      columns.push({
        key: `${range.start.getFullYear()}-${month + 1}`,
        label: new Intl.DateTimeFormat("en-TZ", {
          month: "short",
        }).format(start),
        start,
        end,
        mode: "MONTH",
      });
    }

    return columns;
  }

  const columns: AttendanceColumn[] = [];
  const cursor = new Date(range.start);

  while (cursor <= range.end) {
    const start = startOfLocalDay(cursor);

    columns.push({
      key: localDateKey(start),
      label:
        period === "DAY"
          ? new Intl.DateTimeFormat("en-TZ", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            }).format(start)
          : new Intl.DateTimeFormat("en-TZ", {
              day: "2-digit",
              month: "short",
            }).format(start),
      start,
      end: endOfLocalDay(start),
      mode: "DAY",
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return columns;
}

function formatPeriodRange(start: Date, end: Date): string {
  const sameDay = localDateKey(start) === localDateKey(end);

  if (sameDay) {
    return new Intl.DateTimeFormat("en-TZ", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(start);
  }

  return `${new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(start)} — ${new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(end)}`;
}

function periodLabel(period: AttendanceFilterPeriod): string {
  return {
    DAY: "Daily",
    WEEK: "Weekly",
    MONTH: "Monthly",
    YEAR: "Yearly",
  }[period];
}

function summarizeAttendanceRange(records: any[]) {
  const present = records.filter(
    (item) => safeText(item.mark) === "PRESENT",
  ).length;
  const late = records.filter((item) => safeText(item.mark) === "LATE").length;
  const absent = records.filter(
    (item) => safeText(item.mark) === "ABSENT",
  ).length;
  const leave = records.filter(
    (item) => safeText(item.mark) === "LEAVE",
  ).length;
  const holiday = records.filter(
    (item) => safeText(item.mark) === "HOLIDAY",
  ).length;

  const workingRecords = present + late + absent;
  const attended = present + late;
  const rate = workingRecords
    ? Math.round((attended / workingRecords) * 100)
    : 0;

  return {
    present,
    late,
    absent,
    leave,
    holiday,
    workingRecords,
    attended,
    rate,
  };
}

function AttendanceMetric({
  icon: Icon,
  label,
  value,
  theme,
}: {
  icon: IconType;
  label: string;
  value: number;
  theme: "green" | "orange" | "red" | "purple";
}) {
  return (
    <article className={`${styles.attendanceMetric} ${styles[theme]}`}>
      <span>
        <Icon size={20} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function AttendanceAggregate({ records }: { records: any[] }) {
  const summary = summarizeAttendanceRange(records);

  if (!records.length) {
    return <span className={styles.attendanceEmpty}>—</span>;
  }

  return (
    <span className={styles.attendanceAggregate}>
      <strong>
        {summary.present + summary.late}/{summary.workingRecords}
      </strong>
      <small>{summary.rate}%</small>
    </span>
  );
}

function AttendanceRate({
  value,
  attended,
  total,
}: {
  value: number;
  attended: number;
  total: number;
}) {
  return (
    <div className={styles.attendanceRate}>
      <div>
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <small>
        {value}% · {attended}/{total}
      </small>
    </div>
  );
}

function serviceCountInRange(services: any[], start: Date, end: Date): number {
  return services.filter((item) =>
    dateIsInsideRange(item.servedAt || item.createdAt, start, end),
  ).length;
}

function buildCustomerServiceSummary(
  allServices: any[],
  selectedServices: any[],
): CustomerServiceSummaryRow[] {
  const selectedIds = new Set(
    selectedServices.map((item) => safeText(item.id)),
  );
  const now = new Date();

  const dayRange = {
    start: startOfLocalDay(now),
    end: endOfLocalDay(now),
  };
  const weekRange = {
    start: startOfLocalWeek(now),
    end: endOfLocalWeek(now),
  };
  const monthRange = {
    start: startOfLocalMonth(now),
    end: endOfLocalMonth(now),
  };
  const yearRange = {
    start: startOfLocalYear(now),
    end: endOfLocalYear(now),
  };

  const grouped = new Map<string, any[]>();

  allServices.forEach((item) => {
    const customerKey =
      safeText(item.customerId || item.customer?.id) ||
      `walk-in:${safeText(item.customer?.name || item.customerName)}`;

    const current = grouped.get(customerKey) ?? [];
    current.push(item);
    grouped.set(customerKey, current);
  });

  return Array.from(grouped.entries())
    .map(([customerKey, services]): CustomerServiceSummaryRow | null => {
      const selected = services.filter((item) =>
        selectedIds.has(safeText(item.id)),
      );

      if (!selected.length) return null;

      const first = services[0];
      const customer = first.customer ?? {};
      const lastService = [...services].sort(
        (a, b) =>
          new Date(b.servedAt || b.createdAt).getTime() -
          new Date(a.servedAt || a.createdAt).getTime(),
      )[0];

      const staffNames = Array.from(
        new Set<string>(
          services
            .map((item) =>
              safeText(item.staff?.name || item.staffName || "Unknown staff"),
            )
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const serviceTypes = Array.from(
        new Set<string>(
          services
            .map((item) => safeText(item.serviceType))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      return {
        customerKey,
        customerName: customer.name || first.customerName || "Walk-in Customer",
        phone: customer.phone || "",
        email: customer.email || "",
        region: customer.region || "",
        staffNames,
        serviceTypes,
        dayCount: serviceCountInRange(services, dayRange.start, dayRange.end),
        weekCount: serviceCountInRange(
          services,
          weekRange.start,
          weekRange.end,
        ),
        monthCount: serviceCountInRange(
          services,
          monthRange.start,
          monthRange.end,
        ),
        yearCount: serviceCountInRange(
          services,
          yearRange.start,
          yearRange.end,
        ),
        selectedCount: selected.length,
        totalCount: services.length,
        selectedValue: selected.reduce(
          (sum: number, item: any) => sum + Number(item.amount || 0),
          0,
        ),
        lastServedAt: lastService?.servedAt || lastService?.createdAt || "",
      };
    })
    .filter((item): item is CustomerServiceSummaryRow => item !== null)
    .sort(
      (a, b) =>
        b.selectedCount - a.selectedCount || b.totalCount - a.totalCount,
    );
}

function ServiceCountBadge({
  value,
  highlighted = false,
}: {
  value: number;
  highlighted?: boolean;
}) {
  return (
    <span
      className={`${styles.serviceCountBadge} ${
        highlighted ? styles.serviceCountHighlighted : ""
      }`}
    >
      {value}
    </span>
  );
}

function summarizeAttendance(records: any[]) {
  const now = new Date();

  const isSameDay = (value: unknown) => {
    const date = new Date(String(value));
    return date.toDateString() === now.toDateString();
  };

  const startWeek = new Date(now);
  startWeek.setDate(now.getDate() - now.getDay());
  startWeek.setHours(0, 0, 0, 0);

  const presentText = (list: any[]) => {
    const present = list.filter(
      (item) => item.mark === "PRESENT" || item.mark === "LATE",
    ).length;
    return `${present}/${list.length || 0}`;
  };

  return {
    day: presentText(records.filter((item) => isSameDay(item.attendanceDate))),
    week: presentText(
      records.filter((item) => new Date(item.attendanceDate) >= startWeek),
    ),
    month: presentText(
      records.filter((item) => {
        const date = new Date(item.attendanceDate);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }),
    ),
    year: presentText(
      records.filter(
        (item) =>
          new Date(item.attendanceDate).getFullYear() === now.getFullYear(),
      ),
    ),
  };
}
