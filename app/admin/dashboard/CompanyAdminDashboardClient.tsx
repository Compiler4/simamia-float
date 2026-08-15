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
import StaffAreaAssignmentsPanel from "@/components/company-admin/StaffAreaAssignmentsPanel";
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

type BrokerAgentAccountItem = {
  id?: string;
  network: "VODACOM" | "YAS_MIX" | "AIRTEL" | "HALOTEL" | "OTHER";
  simPhoneNumber: string;
  agentNumber: string;
  accountName?: string | null;
  isPrimary?: boolean;
  status?: string;
};

type BrokerCustomerItem = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  title?: "MR" | "MRS" | "MS" | null;
  firstName?: string | null;
  surname?: string | null;
  businessName: string | null;
  tinNumber?: string | null;
  officialAgentNo?: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  location: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  postalAddress?: string | null;
  city?: string | null;
  country?: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  identityType?: string | null;
  identityNumber?: string | null;
  identityIssuedBy?: string | null;
  identityOther?: string | null;
  profileImageUrl?: string | null;
  signatureUrl?: string | null;
  registrationDate?: string | null;
  attendedBy?: string | null;
  attendedSignatureUrl?: string | null;
  attendedDate?: string | null;
  attendedLocation?: string | null;
  latitude: number | null;
  longitude: number | null;
  status: BrokerCustomerStatus;
  notes: string | null;
  agentAccounts?: BrokerAgentAccountItem[];
  createdAt: string;
  updatedAt: string;
};

type BrokerCustomerForm = {
  id: string;
  code: string;
  title: "MR" | "MRS" | "MS";
  firstName: string;
  surname: string;
  businessName: string;
  tinNumber: string;
  officialAgentNo: string;
  phone: string;
  alternatePhone: string;
  email: string;
  nationality: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  postalAddress: string;
  location: string;
  city: string;
  region: string;
  district: string;
  ward: string;
  country: string;
  identityType: string;
  identityNumber: string;
  identityIssuedBy: string;
  identityOther: string;
  profileImageUrl: string;
  signatureUrl: string;
  registrationDate: string;
  attendedBy: string;
  attendedSignatureUrl: string;
  attendedDate: string;
  attendedLocation: string;
  latitude: string;
  longitude: string;
  status: BrokerCustomerStatus;
  notes: string;
  agentAccounts: BrokerAgentAccountItem[];
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
  | "Staff Work Areas"
  | "Unified Control Centre"
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
  performanceRows: any[];
  notifications: any[];
  allNotifications: any[];
  gpsDevices: any[];
  gpsPings: any[];
  settings: Record<string, any>;
  reportBrand?: {
    logoUrl?: string;
    registrationNumber?: string;
    tin?: string;
    website?: string;
  };
  activities: any[];
  financialDays: any[];
  customers: any[];
  serviceActivities: any[];
  brokers: BrokerCustomerItem[];
  documents: any[];
  approvalDecisions: any[];
  serviceVisits: any[];
  floatTransactions: any[];
  staffCollections: any[];
  networkBalances: any[];
  importedBankStatements: any[];
  importedBankTransactions: any[];
  brokerLoadError?: string;
};

type IconType = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}>;

const PROFILE_KEY = "simamia_company_admin_profile";
const SIDEBAR_KEY = "simamia_company_admin_sidebar";
const ACTIVE_PAGE_KEY = "simamia_company_admin_active_page";

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
  nidaNumber: "",
  dateOfBirth: "",
  gender: "MALE",
  nationality: "Tanzania",
  physicalAddress: "",
  profileImageUrl: "",
  assignedRegion: "",
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
  title: "MR",
  firstName: "",
  surname: "",
  businessName: "",
  tinNumber: "",
  officialAgentNo: "",
  phone: "",
  alternatePhone: "",
  email: "",
  nationality: "Tanzania",
  dateOfBirth: "",
  gender: "MALE",
  postalAddress: "",
  location: "",
  city: "Dodoma",
  region: "Dodoma",
  district: "Dodoma",
  ward: "",
  country: "Tanzania",
  identityType: "NIDA",
  identityNumber: "",
  identityIssuedBy: "NIDA",
  identityOther: "",
  profileImageUrl: "",
  signatureUrl: "",
  registrationDate: todayInput(),
  attendedBy: "",
  attendedSignatureUrl: "",
  attendedDate: todayInput(),
  attendedLocation: "Dodoma",
  latitude: "",
  longitude: "",
  status: "ACTIVE",
  notes: "",
  agentAccounts: [
    {
      network: "VODACOM",
      simPhoneNumber: "",
      agentNumber: "",
      accountName: "",
      isPrimary: true,
      status: "ACTIVE",
    },
  ],
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
  proofGraceMinutes: 30,
  visitRadiusMeters: 200,
  minimumPerformanceScore: 60,
};

const navigation: Array<{
  page: PageName;
  icon: IconType;
  section: string;
}> = [
  { page: "Dashboard", icon: LayoutDashboard, section: "Workspace" },
  { page: "Manage Users", icon: Users, section: "Management" },
  { page: "Manage Brokers", icon: UserCheck, section: "Management" },
  { page: "Staff Work Areas", icon: MapPinned, section: "Management" },
  { page: "Unified Control Centre", icon: LayoutDashboard, section: "Workspace" },
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

function isPageName(value: unknown): value is PageName {
  return navigation.some((item) => item.page === value);
}

const pageAliases: Record<string, PageName> = {
  dashboard: "Dashboard",
  users: "Manage Users",
  "manage-users": "Manage Users",
  brokers: "Manage Brokers",
  "manage-brokers": "Manage Brokers",
  staff: "Staff Work Areas",
  "staff-areas": "Staff Work Areas",
  "work-areas": "Staff Work Areas",
  unified: "Unified Control Centre",
  "control-centre": "Unified Control Centre",
  branches: "Manage Branches",
  expenses: "Expenses",
  bank: "Bank Verification",
  "bank-verification": "Bank Verification",
  attendance: "Attendance",
  performance: "Staff Performance",
  gps: "GPS Tracking",
  accounting: "Accounting Module",
  notifications: "Notifications",
  reports: "Reports",
  approvals: "Approvals",
  settings: "Company Settings",
};

function resolvePageName(value: unknown): PageName | null {
  const clean = safeText(value).trim();
  if (isPageName(clean)) return clean;
  const alias = clean.toLowerCase().replace(/\s+/g, "-");
  return pageAliases[alias] ?? null;
}

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

async function uploadPortalDocument(
  file: File,
  kind = "OTHER",
  links: Record<string, string> = {},
): Promise<{ url: string; document: any; proofAnalysis?: any }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  Object.entries(links).forEach(([key, value]) => {
    if (value) formData.append(key, value);
  });

  return requestJson<{ success: true; url: string; document: any; proofAnalysis?: any }>(
    "/api/company-admin/uploads",
    {
      method: "POST",
      body: formData,
    },
  );
}

async function uploadDocument(file: File): Promise<string> {
  return (await uploadPortalDocument(file, "OTHER")).url;
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
    nidaNumber: safeText(item?.nidaNumber),
    dateOfBirth: dateInputValue(item?.dateOfBirth),
    gender: safeText(item?.gender) || "MALE",
    nationality: safeText(item?.nationality) || "Tanzania",
    physicalAddress: safeText(item?.physicalAddress),
    profileImageUrl: safeText(item?.profileImageUrl),
    assignedRegion: safeText(item?.assignedRegion),
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
    title: (safeText(item.title) || "MR") as BrokerCustomerForm["title"],
    firstName: safeText(item.firstName) || safeText(item.name).split(" ")[0] || "",
    surname: safeText(item.surname) || safeText(item.name).split(" ").slice(1).join(" "),
    businessName: safeText(item.businessName),
    tinNumber: safeText(item.tinNumber),
    officialAgentNo: safeText(item.officialAgentNo),
    phone: safeText(item.phone),
    alternatePhone: safeText(item.alternatePhone),
    email: safeText(item.email),
    nationality: safeText(item.nationality) || "Tanzania",
    dateOfBirth: dateInputValue(item.dateOfBirth),
    gender: (safeText(item.gender) || "MALE") as BrokerCustomerForm["gender"],
    postalAddress: safeText(item.postalAddress),
    location: safeText(item.location),
    city: safeText(item.city),
    region: safeText(item.region),
    district: safeText(item.district),
    ward: safeText(item.ward),
    country: safeText(item.country) || "Tanzania",
    identityType: safeText(item.identityType) || "NIDA",
    identityNumber: safeText(item.identityNumber),
    identityIssuedBy: safeText(item.identityIssuedBy),
    identityOther: safeText(item.identityOther),
    profileImageUrl: safeText(item.profileImageUrl),
    signatureUrl: safeText(item.signatureUrl),
    registrationDate: dateInputValue(item.registrationDate) || todayInput(),
    attendedBy: safeText(item.attendedBy),
    attendedSignatureUrl: safeText(item.attendedSignatureUrl),
    attendedDate: dateInputValue(item.attendedDate) || todayInput(),
    attendedLocation: safeText(item.attendedLocation),
    latitude:
      item.latitude === null || item.latitude === undefined ? "" : String(item.latitude),
    longitude:
      item.longitude === null || item.longitude === undefined ? "" : String(item.longitude),
    status: item.status || "ACTIVE",
    notes: safeText(item.notes),
    agentAccounts: safeArray<BrokerAgentAccountItem>(item.agentAccounts).length
      ? safeArray<BrokerAgentAccountItem>(item.agentAccounts).map((account) => ({
          id: account.id,
          network: account.network,
          simPhoneNumber: safeText(account.simPhoneNumber),
          agentNumber: safeText(account.agentNumber),
          accountName: safeText(account.accountName),
          isPrimary: Boolean(account.isPrimary),
          status: safeText(account.status) || "ACTIVE",
        }))
      : [...emptyBrokerForm.agentAccounts],
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
    const requestedPage = resolvePageName(
      new URLSearchParams(window.location.search).get("section"),
    );
    const savedPage = resolvePageName(localStorage.getItem(ACTIVE_PAGE_KEY));

    if (savedProfile) setProfileImage(savedProfile);
    if (savedSidebar === "collapsed") setSidebarCollapsed(true);
    if (requestedPage || savedPage) setActivePage(requestedPage || savedPage || "Dashboard");

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
  locations: string[];
  total: number;
  summary: {
    active: number;
    inactive: number;
    suspended: number;
    imported: number;
  };
}>("/api/company-admin/brokers");

        brokers = safeArray<BrokerCustomerItem>(brokerResult.brokers);
        brokerLoadError = "";
      } catch (brokerError) {
        brokerLoadError =
          brokerError instanceof Error
            ? brokerError.message
            : "Could not load broker customers.";
      }

      setData({
        ...dashboardResult,
        brokers,
        brokerLoadError,
      });
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
    localStorage.setItem(ACTIVE_PAGE_KEY, page);
    const url = new URL(window.location.href);
    url.searchParams.set("section", page);
    window.history.replaceState(
      null,
      "",
      `${url.pathname}?${url.searchParams.toString()}${url.hash}`,
    );
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
  if (page === "Staff Work Areas") {
    return <StaffAreaAssignmentsPanel dashboardHref="/admin/dashboard" />;
  }
  if (page === "Unified Control Centre") {
    return (
      <PageShell
        icon={LayoutDashboard}
        title="Unified Company Admin Control Centre"
        subtitle="Open staff areas, accountant verification, imported finance and staff operations from one combined workspace."
      >
        <section
          style={{
            padding: 24,
            border: "1px solid #dce8eb",
            borderRadius: 22,
            background: "linear-gradient(135deg, #ffffff, #eefbf7)",
            boxShadow: "0 18px 42px rgba(6, 79, 67, 0.09)",
          }}
        >
          <h3 style={{ margin: 0 }}>All operational modules in one page</h3>
          <p style={{ color: "#617871", lineHeight: 1.7 }}>
            Use the unified page to move between staff-area assignments,
            accountant bridge controls, imported finance and staff operations
            without returning to separate routes.
          </p>
          <a
            href="/admin/control-centre?module=staff-areas"
            style={{
              minHeight: 45,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 16px",
              borderRadius: 14,
              color: "white",
              background: "linear-gradient(135deg, #0e9e77, #08717e)",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            <LayoutDashboard size={18} /> Open unified control centre
          </a>
        </section>
      </PageShell>
    );
  }
  if (page === "Manage Branches") return <BranchesPage {...common} />;
  if (page === "Expenses") return <ExpensesPage {...common} />;
  if (page === "Bank Verification") return <BankVerificationPage {...common} />;
  if (page === "Attendance") return <AttendancePage {...common} />;
  if (page === "Staff Performance") return <PerformancePage {...common} />;
  if (page === "GPS Tracking") return <GpsPage {...common} />;
  if (page === "Accounting Module") return <AccountingPage {...common} />;
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
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const users = safeArray<any>(data.users);

  async function saveUser(event: FormEvent) {
    event.preventDefault();

    const requiredValues = [
      form.name,
      form.email,
      form.phone,
      form.role,
      form.branchId,
      form.nidaNumber,
      form.dateOfBirth,
      form.gender,
      form.nationality,
      form.physicalAddress,
      form.assignedRegion,
    ];

    if (requiredValues.some((value) => !safeText(value).trim())) {
      notify("Complete every required user field before registration.");
      return;
    }

    if (!form.id && !profileFile && !form.profileImageUrl) {
      notify("A profile photo is required for every new user.");
      return;
    }

    setBusy(true);
    try {
      let profileImageUrl = form.profileImageUrl;
      if (profileFile) {
        profileImageUrl = (
          await uploadPortalDocument(profileFile, "PROFILE_IMAGE")
        ).url;
      }

      const editing = Boolean(form.id);
      await requestJson(
        editing
          ? `/api/company-admin/users/${form.id}`
          : "/api/company-admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, profileImageUrl }),
        },
      );

      setForm(emptyUserForm);
      setProfileFile(null);
      notify(editing ? "User updated successfully." : "User registered successfully.");
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
      notify(status === "ACTIVE" ? "User reactivated." : "User suspended.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (!window.confirm("Remove this user from active company access?")) return;
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/users/${id}`, { method: "DELETE" });
      notify("User removed while historical records were preserved.");
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
      subtitle="Register fully identified company users with mandatory NIDA details, a profile photo and complete contact information."
    >
      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={saveUser}>
          <SectionHeading
            icon={form.id ? Pencil : Plus}
            title={form.id ? "Edit company user" : "Register company user"}
            text="Every displayed field is mandatory for a new user. The API also rejects incomplete registrations."
          />

          <div className={styles.profileUploadRow}>
            <ProfileAvatar
              name={form.name || "New user"}
              url={profileFile ? URL.createObjectURL(profileFile) : form.profileImageUrl}
              large
            />
            <Field label="Profile photo *">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!form.id && !form.profileImageUrl}
                onChange={(event) => setProfileFile(event.target.files?.[0] || null)}
              />
            </Field>
          </div>

          <div className={styles.formGrid}>
            <Field label="Full name *">
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Email *">
              <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Phone number *">
              <input required value={form.phone} placeholder="+255..." onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="NIDA number *">
              <input required inputMode="numeric" maxLength={20} value={form.nidaNumber} placeholder="20 digits" onChange={(event) => setForm({ ...form, nidaNumber: event.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="Date of birth *">
              <input required type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
            </Field>
            <Field label="Gender *">
              <select required value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Nationality *">
              <input required value={form.nationality} onChange={(event) => setForm({ ...form, nationality: event.target.value })} />
            </Field>
            <Field label="Physical address *">
              <input required value={form.physicalAddress} onChange={(event) => setForm({ ...form, physicalAddress: event.target.value })} />
            </Field>
            <Field label="Assigned region *">
              <input required value={form.assignedRegion} onChange={(event) => setForm({ ...form, assignedRegion: event.target.value })} />
            </Field>
            <Field label="Role *">
              <select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="COMPANY_ADMIN">Company Admin</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="STAFF">Staff</option>
                <option value="GPS_MANAGER">GPS Manager</option>
              </select>
            </Field>
            <Field label="Branch *">
              <select required value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>
                <option value="">Choose branch</option>
                {safeArray<any>(data.branches).map((branch) => (
                  <option value={branch.id} key={branch.id}>{branch.name}</option>
                ))}
              </select>
            </Field>
            <Field label={form.id ? "New password (optional)" : "Password *"}>
              <input type="password" minLength={8} required={!form.id} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </Field>
            <Field label="Status *">
              <select required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </Field>
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={busy}><Save size={17} />{busy ? "Saving..." : form.id ? "Update user" : "Register user"}</button>
            <button type="button" className={styles.secondaryButton} onClick={() => { setForm(emptyUserForm); setProfileFile(null); }}><X size={17} />Clear</button>
          </div>
        </form>

        <TableCard title="Company users" subtitle={`${users.length} complete user profiles`}>
          <DataTable minWidth={1120}>
            <thead><tr><th>#</th><th>Photo</th><th>User</th><th>NIDA</th><th>Phone</th><th>Role</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><ProfileAvatar name={item.name} url={item.profileImageUrl} /></td>
                  <td><Entity name={safeText(item.name)} sub={safeText(item.email)} /></td>
                  <td>{item.nidaNumber || "N/A"}</td>
                  <td>{item.phone || "N/A"}</td>
                  <td>{formatRole(item.role)}</td>
                  <td>{item.branchName || "No branch"}</td>
                  <td><StatusBadge status={safeText(item.status)} /></td>
                  <td>
                    <div className={styles.tableActions}>
                      <button type="button" title="View full user" onClick={() => setSelectedUser(item)}><Eye size={15} /></button>
                      <button type="button" title="Edit" onClick={() => { setForm(normalizeUserForm(item)); setProfileFile(null); }}><Pencil size={15} /></button>
                      {item.status === "ACTIVE" ? (
                        <button type="button" className={styles.warningAction} onClick={() => changeStatus(item.id, "SUSPENDED")} title="Suspend"><PowerOff size={15} /></button>
                      ) : (
                        <button type="button" className={styles.successAction} onClick={() => changeStatus(item.id, "ACTIVE")} title="Reactivate"><Power size={15} /></button>
                      )}
                      <button type="button" className={styles.dangerAction} onClick={() => removeUser(item.id)} title="Remove"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && <EmptyTable colSpan={9} text="No users found." />}
            </tbody>
          </DataTable>
        </TableCard>
      </div>

      {selectedUser && (
        <DetailModal title="User profile" onClose={() => setSelectedUser(null)}>
          <div className={styles.verticalProfileCard}>
            <ProfileAvatar name={selectedUser.name} url={selectedUser.profileImageUrl} large />
            <h2>{selectedUser.name}</h2>
            <StatusBadge status={selectedUser.status} />
            <Detail label="Email" value={selectedUser.email || "N/A"} />
            <Detail label="Phone" value={selectedUser.phone || "N/A"} />
            <Detail label="NIDA number" value={selectedUser.nidaNumber || "N/A"} />
            <Detail label="Date of birth" value={formatDate(selectedUser.dateOfBirth)} />
            <Detail label="Gender" value={selectedUser.gender || "N/A"} />
            <Detail label="Nationality" value={selectedUser.nationality || "N/A"} />
            <Detail label="Physical address" value={selectedUser.physicalAddress || "N/A"} />
            <Detail label="Assigned region" value={selectedUser.assignedRegion || "N/A"} />
            <Detail label="Role" value={formatRole(selectedUser.role)} />
            <Detail label="Branch" value={selectedUser.branchName || "No branch"} />
            <Detail label="Registered" value={formatDate(selectedUser.createdAt, true)} />
          </div>
        </DetailModal>
      )}
    </PageShell>
  );
}

function BrokersPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const brokers = safeArray<BrokerCustomerItem>(data.brokers);
  const [form, setForm] = useState<BrokerCustomerForm>(emptyBrokerForm);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [attenderSignatureFile, setAttenderSignatureFile] = useState<File | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerCustomerItem | null>(null);
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState("");

  const filteredBrokers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return brokers.filter((broker) => {
      const accounts = safeArray<BrokerAgentAccountItem>(broker.agentAccounts);
      const searchMatches =
        !query ||
        [
          broker.code,
          broker.name,
          broker.businessName,
          broker.phone,
          broker.alternatePhone,
          broker.email,
          broker.identityNumber,
          broker.location,
          ...accounts.flatMap((item) => [item.agentNumber, item.simPhoneNumber, item.network]),
        ].some((value) => safeText(value).toLowerCase().includes(query));
      const networkMatches =
        !networkFilter || accounts.some((item) => item.network === networkFilter);
      const statusMatches = !statusFilter || broker.status === statusFilter;
      return searchMatches && networkMatches && statusMatches;
    });
  }, [brokers, search, networkFilter, statusFilter]);

  function updateAccount(index: number, patch: Partial<BrokerAgentAccountItem>) {
    setForm((current) => ({
      ...current,
      agentAccounts: current.agentAccounts.map((account, rowIndex) =>
        rowIndex === index ? { ...account, ...patch } : account,
      ),
    }));
  }

  function addAccount() {
    setForm((current) => ({
      ...current,
      agentAccounts: [
        ...current.agentAccounts,
        {
          network: "AIRTEL",
          simPhoneNumber: "",
          agentNumber: "",
          accountName: "",
          isPrimary: false,
          status: "ACTIVE",
        },
      ],
    }));
  }

  function removeAccount(index: number) {
    setForm((current) => {
      if (current.agentAccounts.length === 1) return current;
      const rows = current.agentAccounts.filter((_, rowIndex) => rowIndex !== index);
      if (!rows.some((row) => row.isPrimary)) rows[0].isPrimary = true;
      return { ...current, agentAccounts: rows };
    });
  }

  function makePrimary(index: number) {
    setForm((current) => ({
      ...current,
      agentAccounts: current.agentAccounts.map((row, rowIndex) => ({
        ...row,
        isPrimary: rowIndex === index,
      })),
    }));
  }

  async function autofillBrokerFromDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      notify("Broker auto-fill document must be 10 MB or smaller.");
      return;
    }

    setAutofillBusy(true);
    setAutofillMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await requestJson<{
        success: true;
        fields: Partial<BrokerCustomerForm>;
        message?: string;
      }>("/api/company-admin/brokers/autofill", {
        method: "POST",
        body: formData,
      });

      const fields = result.fields || {};
      setForm((current) => ({
        ...current,
        ...fields,
        id: current.id,
        code: safeText(fields.code) || current.code,
        agentAccounts: safeArray<BrokerAgentAccountItem>(fields.agentAccounts).length
          ? safeArray<BrokerAgentAccountItem>(fields.agentAccounts)
          : current.agentAccounts,
      }));
      setAutofillMessage(result.message || "Document values were applied to the broker form.");
      notify("Broker registration document auto-fill completed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Broker document auto-fill failed.";
      setAutofillMessage(message);
      notify(message);
    } finally {
      setAutofillBusy(false);
    }
  }

  async function saveBroker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requiredValues = [
      form.title,
      form.firstName,
      form.surname,
      form.businessName,
      form.tinNumber,
      form.officialAgentNo,
      form.phone,
      form.alternatePhone,
      form.email,
      form.nationality,
      form.dateOfBirth,
      form.gender,
      form.postalAddress,
      form.location,
      form.city,
      form.region,
      form.district,
      form.ward,
      form.country,
      form.identityType,
      form.identityNumber,
      form.identityIssuedBy,
    ];

    if (requiredValues.some((value) => !safeText(value).trim())) {
      notify("Complete every required agent-registration field.");
      return;
    }

    const agentAccounts = form.agentAccounts
      .filter((account) =>
        [
          account.network,
          account.simPhoneNumber,
          account.agentNumber,
          account.accountName,
        ].some((value) => safeText(value).trim()),
      )
      .map((account, index) => ({
        ...account,
        isPrimary: index === 0 ? true : Boolean(account.isPrimary),
      }));

    if (
      agentAccounts.some(
        (account) =>
          !safeText(account.network).trim() ||
          !safeText(account.simPhoneNumber).trim() ||
          !safeText(account.agentNumber).trim(),
      )
    ) {
      notify("Complete network, SIM phone and agent number for any account row you add, or leave the row blank.");
      return;
    }

    if (!form.id && !profileFile && !form.profileImageUrl) {
      notify("A broker profile photo is required.");
      return;
    }

    setBusy(true);
    try {
      let profileImageUrl = form.profileImageUrl;
      let signatureUrl = form.signatureUrl;
      let attendedSignatureUrl = form.attendedSignatureUrl;

      if (profileFile) {
        profileImageUrl = (
          await uploadPortalDocument(profileFile, "PROFILE_IMAGE")
        ).url;
      }
      if (signatureFile) {
        signatureUrl = (
          await uploadPortalDocument(signatureFile, "SIGNATURE")
        ).url;
      }
      if (attenderSignatureFile) {
        attendedSignatureUrl = (
          await uploadPortalDocument(attenderSignatureFile, "SIGNATURE")
        ).url;
      } else if (!attendedSignatureUrl && signatureUrl) {
        attendedSignatureUrl = signatureUrl;
      }

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
            agentAccounts,
            profileImageUrl,
            signatureUrl,
            attendedSignatureUrl,
            latitude: form.latitude === "" ? null : Number(form.latitude),
            longitude: form.longitude === "" ? null : Number(form.longitude),
          }),
        },
      );

      setForm(emptyBrokerForm);
      setProfileFile(null);
      setSignatureFile(null);
      setAttenderSignatureFile(null);
      notify(editing ? "Broker updated successfully." : "Broker registered successfully.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save broker.");
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
      notify(`Broker ${status.toLowerCase()}.`);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update broker.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBroker(id: string) {
    if (!window.confirm("Suspend this broker while preserving all historical services?")) return;
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/brokers/${id}`, { method: "DELETE" });
      notify("Broker suspended and historical data preserved.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not suspend broker.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={UserCheck}
      title="Manage Brokers / Agents"
      subtitle="Capture every field from the agent registration form, profile photographs, identity details and one or many mobile-network agent accounts."
    >
      {data.brokerLoadError && <div className={styles.brokerSetupError}><ShieldCheck size={22} /><div><strong>Broker data warning</strong><p>{data.brokerLoadError}</p></div></div>}

      <section className={styles.brokerMetricGrid}>
        <ColorMetric icon={UserCheck} label="All brokers" value={String(brokers.length)} theme="purple" />
        <ColorMetric icon={CheckCircle2} label="Active" value={String(brokers.filter((item) => item.status === "ACTIVE").length)} theme="green" />
        <ColorMetric icon={Smartphone} label="Agent accounts" value={String(brokers.reduce((sum, item) => sum + safeArray(item.agentAccounts).length, 0))} theme="orange" />
        <ColorMetric icon={MapPin} label="With GPS location" value={String(brokers.filter((item) => item.latitude != null && item.longitude != null).length)} theme="red" />
      </section>

      <div className={styles.brokerFullLayout}>
        <form className={styles.formCard} onSubmit={saveBroker}>
          <SectionHeading icon={form.id ? Pencil : Plus} title={form.id ? "Edit broker / agent" : "Agent registration form"} text="Complete the core identity fields, then optionally add GPS, network accounts, signatures and attendance details." />

          <section className={styles.autofillPanel}>
            <div>
              <FileText size={20} />
              <span>
                <strong>Auto-fill from registration document</strong>
                <small>Upload a text, CSV, JSON, Excel, Word or copyable PDF form to fill matching broker fields.</small>
              </span>
            </div>
            <label>
              <UploadCloud size={17} />
              {autofillBusy ? "Reading..." : "Upload document"}
              <input
                type="file"
                accept=".txt,.csv,.json,.pdf,.docx,.xlsx,.xls"
                disabled={autofillBusy}
                onChange={autofillBrokerFromDocument}
              />
            </label>
            {autofillMessage ? <p>{autofillMessage}</p> : null}
          </section>

          <div className={styles.profileUploadRow}>
            <ProfileAvatar name={`${form.firstName} ${form.surname}`} url={profileFile ? URL.createObjectURL(profileFile) : form.profileImageUrl} large />
            <Field label="Profile photograph *"><input type="file" accept="image/*" required={!form.id && !form.profileImageUrl} onChange={(event) => setProfileFile(event.target.files?.[0] || null)} /></Field>
          </div>

          <h3 className={styles.formSectionTitle}>Agent information</h3>
          <div className={styles.formGrid}>
            <Field label="Title *"><select required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value as BrokerCustomerForm["title"] })}><option value="MR">Mr</option><option value="MRS">Mrs</option><option value="MS">Ms</option></select></Field>
            <Field label="Broker code"><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Auto-generated when blank" /></Field>
            <Field label="First name *"><input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></Field>
            <Field label="Surname *"><input required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></Field>
            <Field label="Registered business name *"><input required value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></Field>
            <Field label="TIN number *"><input required value={form.tinNumber} onChange={(event) => setForm({ ...form, tinNumber: event.target.value })} /></Field>
            <Field label="Official agent number *"><input required value={form.officialAgentNo} onChange={(event) => setForm({ ...form, officialAgentNo: event.target.value })} /></Field>
            <Field label="Nationality *"><input required value={form.nationality} onChange={(event) => setForm({ ...form, nationality: event.target.value })} /></Field>
            <Field label="Primary mobile number *"><input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Alternative mobile number *"><input required value={form.alternatePhone} onChange={(event) => setForm({ ...form, alternatePhone: event.target.value })} /></Field>
            <Field label="Email address *"><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Date of birth *"><input type="date" required value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></Field>
            <Field label="Gender *"><select required value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as BrokerCustomerForm["gender"] })}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></Field>
            <Field label="Postal address *"><input required value={form.postalAddress} onChange={(event) => setForm({ ...form, postalAddress: event.target.value })} /></Field>
            <Field label="Physical business address *"><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
            <Field label="City *"><input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
            <Field label="Region *"><input required value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></Field>
            <Field label="District *"><input required value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></Field>
            <Field label="Ward *"><input required value={form.ward} onChange={(event) => setForm({ ...form, ward: event.target.value })} /></Field>
            <Field label="Country *"><input required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
            <Field label="Latitude"><input type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></Field>
            <Field label="Longitude"><input type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></Field>
          </div>

          <h3 className={styles.formSectionTitle}>Identification</h3>
          <div className={styles.formGrid}>
            <Field label="Identity type *"><select required value={form.identityType} onChange={(event) => setForm({ ...form, identityType: event.target.value })}><option value="NIDA">NIDA</option><option value="PASSPORT">Passport</option><option value="DRIVING_LICENCE">Driving licence</option><option value="WORK_ID">Work ID</option><option value="VOTER_CARD">Voter card</option><option value="LOCAL_GOVERNMENT_LETTER">Local government letter</option><option value="OTHER">Other</option></select></Field>
            <Field label="Identity number *"><input required value={form.identityNumber} onChange={(event) => setForm({ ...form, identityNumber: event.target.value })} /></Field>
            <Field label="Issued by *"><input required value={form.identityIssuedBy} onChange={(event) => setForm({ ...form, identityIssuedBy: event.target.value })} /></Field>
            {form.identityType === "OTHER" && <Field label="Other identity description *"><input required value={form.identityOther} onChange={(event) => setForm({ ...form, identityOther: event.target.value })} /></Field>}
          </div>

          <h3 className={styles.formSectionTitle}>Mobile network agent accounts</h3>
          <div className={styles.agentAccountList}>
            {form.agentAccounts.map((account, index) => (
              <div className={styles.agentAccountRow} key={`${index}-${account.id || "new"}`}>
                <Field label={`Network ${index + 1}`}><select value={account.network} onChange={(event) => updateAccount(index, { network: event.target.value as BrokerAgentAccountItem["network"] })}><option value="VODACOM">Vodacom</option><option value="YAS_MIX">Mix by Yas</option><option value="AIRTEL">Airtel</option><option value="HALOTEL">Halotel</option><option value="OTHER">Other</option></select></Field>
                <Field label="SIM phone number"><input value={account.simPhoneNumber} onChange={(event) => updateAccount(index, { simPhoneNumber: event.target.value })} /></Field>
                <Field label="Agent number"><input value={account.agentNumber} onChange={(event) => updateAccount(index, { agentNumber: event.target.value })} /></Field>
                <Field label="Account name"><input value={safeText(account.accountName)} onChange={(event) => updateAccount(index, { accountName: event.target.value })} /></Field>
                <label className={styles.primaryCheck}><input type="radio" name="primary-agent-account" checked={Boolean(account.isPrimary)} onChange={() => makePrimary(index)} /> Primary account</label>
                <button type="button" className={styles.dangerTextButton} disabled={form.agentAccounts.length === 1} onClick={() => removeAccount(index)}><Trash2 size={15} />Remove</button>
              </div>
            ))}
            <button type="button" className={styles.secondaryButton} onClick={addAccount}><Plus size={16} />Add another network / agent number</button>
          </div>

          <h3 className={styles.formSectionTitle}>Signatures and official attendance</h3>
          <div className={styles.formGrid}>
            <Field label="Agent signature image"><input type="file" accept="image/*" onChange={(event) => setSignatureFile(event.target.files?.[0] || null)} /></Field>
            <Field label="Registration date"><input type="date" value={form.registrationDate} onChange={(event) => setForm({ ...form, registrationDate: event.target.value })} /></Field>
            <Field label="Attended by"><input value={form.attendedBy} onChange={(event) => setForm({ ...form, attendedBy: event.target.value })} /></Field>
            <Field label="Attender signature image"><input type="file" accept="image/*" onChange={(event) => setAttenderSignatureFile(event.target.files?.[0] || null)} /></Field>
            <Field label="Attended date"><input type="date" value={form.attendedDate} onChange={(event) => setForm({ ...form, attendedDate: event.target.value })} /></Field>
            <Field label="Attended location"><input value={form.attendedLocation} onChange={(event) => setForm({ ...form, attendedLocation: event.target.value })} /></Field>
            <Field label="Status *"><select required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BrokerCustomerStatus })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></select></Field>
            <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={busy}><Save size={17} />{busy ? "Saving..." : form.id ? "Update broker" : "Register broker"}</button>
            <button type="button" className={styles.secondaryButton} onClick={() => { setForm(emptyBrokerForm); setProfileFile(null); setSignatureFile(null); setAttenderSignatureFile(null); }}><X size={17} />Clear</button>
          </div>
        </form>

        <TableCard title="Registered brokers / agents" subtitle={`${filteredBrokers.length} of ${brokers.length} records`}>
          <section className={styles.brokerFilterBar}>
            <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search broker, NIDA, phone, SIM or agent number" /></label>
            <label><Smartphone size={17} /><select value={networkFilter} onChange={(event) => setNetworkFilter(event.target.value)}><option value="">All networks</option><option value="VODACOM">Vodacom</option><option value="YAS_MIX">Mix by Yas</option><option value="AIRTEL">Airtel</option><option value="HALOTEL">Halotel</option><option value="OTHER">Other</option></select></label>
            <label><Filter size={17} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></select></label>
          </section>

          <DataTable minWidth={1450}>
            <thead><tr><th>#</th><th>Photo</th><th>Broker</th><th>Business</th><th>Contact</th><th>Networks / agent numbers</th><th>Identity</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredBrokers.map((broker, index) => (
                <tr key={broker.id}>
                  <td>{index + 1}</td>
                  <td><ProfileAvatar name={broker.name} url={broker.profileImageUrl} /></td>
                  <td><Entity name={broker.name} sub={broker.code} /></td>
                  <td>{broker.businessName || "N/A"}</td>
                  <td><strong>{broker.phone}</strong><small className={styles.blockSmall}>{broker.alternatePhone || ""}</small></td>
                  <td>
                    <div className={styles.networkBadgeList}>
                      {safeArray<BrokerAgentAccountItem>(broker.agentAccounts).map((account) => (
                        <span key={`${account.network}-${account.agentNumber}`}><b>{account.network.replace("YAS_MIX", "MIX BY YAS")}</b>{account.agentNumber}<small>{account.simPhoneNumber}</small></span>
                      ))}
                    </div>
                  </td>
                  <td>{broker.identityType || "N/A"}<small className={styles.blockSmall}>{broker.identityNumber || ""}</small></td>
                  <td>{[broker.location, broker.district, broker.region].filter(Boolean).join(" / ")}</td>
                  <td><StatusBadge status={broker.status} /></td>
                  <td>
                    <div className={styles.tableActions}>
                      <button type="button" title="View broker" onClick={() => setSelectedBroker(broker)}><Eye size={15} /></button>
                      <button type="button" title="Edit broker" onClick={() => { setForm(normalizeBrokerForm(broker)); setProfileFile(null); setSignatureFile(null); setAttenderSignatureFile(null); }}><Pencil size={15} /></button>
                      {broker.status === "ACTIVE" ? <button type="button" className={styles.warningAction} onClick={() => changeBrokerStatus(broker.id, "INACTIVE")}><PowerOff size={15} /></button> : <button type="button" className={styles.successAction} onClick={() => changeBrokerStatus(broker.id, "ACTIVE")}><Power size={15} /></button>}
                      <button type="button" className={styles.dangerAction} onClick={() => removeBroker(broker.id)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredBrokers.length && <EmptyTable colSpan={10} text="No broker records match the selected filters." />}
            </tbody>
          </DataTable>
        </TableCard>
      </div>

      {selectedBroker && (
        <DetailModal title="Broker / agent profile" onClose={() => setSelectedBroker(null)} wide>
          <div className={styles.verticalProfileCard}>
            <ProfileAvatar name={selectedBroker.name} url={selectedBroker.profileImageUrl} large />
            <h2>{selectedBroker.title} {selectedBroker.name}</h2>
            <p>{selectedBroker.businessName}</p>
            <StatusBadge status={selectedBroker.status} />
            <Detail label="Broker code" value={selectedBroker.code} />
            <Detail label="TIN number" value={selectedBroker.tinNumber || "N/A"} />
            <Detail label="Official agent number" value={selectedBroker.officialAgentNo || "N/A"} />
            <Detail label="Primary phone" value={selectedBroker.phone} />
            <Detail label="Alternative phone" value={selectedBroker.alternatePhone || "N/A"} />
            <Detail label="Email" value={selectedBroker.email || "N/A"} />
            <Detail label="Nationality" value={selectedBroker.nationality || "N/A"} />
            <Detail label="Date of birth" value={formatDate(selectedBroker.dateOfBirth)} />
            <Detail label="Gender" value={selectedBroker.gender || "N/A"} />
            <Detail label="Postal address" value={selectedBroker.postalAddress || "N/A"} />
            <Detail label="Physical address" value={selectedBroker.location || "N/A"} />
            <Detail label="City / District / Region" value={[selectedBroker.city, selectedBroker.district, selectedBroker.region].filter(Boolean).join(" / ") || "N/A"} />
            <Detail label="Country" value={selectedBroker.country || "N/A"} />
            <Detail label="Identity" value={`${selectedBroker.identityType || "N/A"} — ${selectedBroker.identityNumber || "N/A"}`} />
            <Detail label="Issued by" value={selectedBroker.identityIssuedBy || "N/A"} />
            <Detail label="Coordinates" value={selectedBroker.latitude == null ? "Not set" : `${selectedBroker.latitude}, ${selectedBroker.longitude}`} />
            <Detail label="Registration date" value={formatDate(selectedBroker.registrationDate)} />
            <Detail label="Attended by" value={selectedBroker.attendedBy || "N/A"} />
            <Detail label="Attended date / location" value={`${formatDate(selectedBroker.attendedDate)} — ${selectedBroker.attendedLocation || "N/A"}`} />
            <div className={styles.agentAccountDetails}>
              <h3>Registered network accounts</h3>
              {safeArray<BrokerAgentAccountItem>(selectedBroker.agentAccounts).map((account) => (
                <div key={`${account.network}-${account.agentNumber}`}>
                  <strong>{account.network.replace("YAS_MIX", "MIX BY YAS")}</strong>
                  <span>Agent number: {account.agentNumber}</span>
                  <span>SIM: {account.simPhoneNumber}</span>
                  <span>{account.isPrimary ? "Primary account" : "Secondary account"}</span>
                </div>
              ))}
            </div>
            <div className={styles.documentGrid}>
              <DocumentButton label="Agent signature" url={selectedBroker.signatureUrl || undefined} />
              <DocumentButton label="Attender signature" url={selectedBroker.attendedSignatureUrl || undefined} />
            </div>
          </div>
        </DetailModal>
      )}
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
                <option value="SUSPENDED">Suspended</option>
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
    autoApprove: true,
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
        autoApprove: true,
      });
      setReceipt(null);
      notify("Expense saved and automatically approved because it was created by Company Admin.");
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
              <input type="checkbox" checked readOnly disabled />
              Company Admin-created expenses are automatically approved
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
  const allDocuments = safeArray<any>(data.documents);
  const [selectedId, setSelectedId] = useState(records[0]?.id || "");
  const [message, setMessage] = useState("");
  const [decision, setDecision] = useState("PENDING");
  const [reviewNote, setReviewNote] = useState("");
  const [overrideInsufficientProof, setOverrideInsufficientProof] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  const selected = records.find((item) => item.id === selectedId) ?? records[0] ?? null;

  useEffect(() => {
    if (!selectedId && records[0]?.id) setSelectedId(records[0].id);
  }, [records, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setDecision(selected.status || "PENDING");
    setReviewNote(selected.reviewNote || "");
    setOverrideInsufficientProof(false);
  }, [selected?.id]);

  async function updateRecord(id: string, body: Record<string, unknown>, success: string) {
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

  async function applyDecision() {
    if (!selected) return;
    if (decision !== "PENDING" && reviewNote.trim().length < 5) {
      notify("Write a clear review reason before saving the decision.");
      return;
    }
    await updateRecord(
      selected.id,
      {
        status: decision,
        reviewNote,
        isSeenByAdmin: true,
        overrideInsufficientProof,
      },
      "Bank verification decision saved.",
    );
  }

  async function sendMessage() {
    if (!selected || !message.trim()) return;
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/bank-verifications/${selected.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      setMessage("");
      notify("Review message sent to the uploader.");
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
      title="Bank Verification and Proof Review"
      subtitle="Inspect every SMS screenshot, image, document and PDF before approval. Insufficient proof is flagged when date, time, reference, sender, receiver or amount is unreadable."
      action={
        <button
          type="button"
          onClick={() =>
            window.open(
              "/api/company-admin/reports/bank-bundle",
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          <Download size={17} /> Grand bank proof report
        </button>
      }
    >
      <section className={styles.metricStrip}>
        <ColorMetric icon={Clock3} label="Pending" value={String(records.filter((item) => item.status === "PENDING").length)} theme="orange" />
        <ColorMetric icon={FileCheck2} label="Verified" value={String(records.filter((item) => item.status === "VERIFIED").length)} theme="green" />
        <ColorMetric icon={EyeOff} label="Insufficient proof" value={String(records.filter((item) => item.proofInspectionStatus === "INSUFFICIENT").length)} theme="red" />
        <ColorMetric icon={FileText} label="Uploaded documents" value={String(allDocuments.length)} theme="purple" />
      </section>

      <div className={styles.bankLayout}>
        <TableCard title="Uploaded bank records" subtitle={`${records.length} records awaiting or completing verification`}>
          <DataTable minWidth={1200}>
            <thead><tr><th>#</th><th>Uploader</th><th>Bank</th><th>Account</th><th>Reference</th><th>From</th><th>To</th><th>Date/time</th><th>Amount</th><th>Proof</th><th>Status</th><th>Review</th></tr></thead>
            <tbody>
              {records.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><Entity name={item.uploadedByName} sub={formatRole(item.uploadedByRole)} /></td>
                  <td><strong>{item.bankName || "UNSPECIFIED BANK"}</strong></td>
                  <td><Entity name={item.accountName || item.receiverName || "Account"} sub={item.bankAccount || "N/A"} /></td>
                  <td>{item.referenceNumber}</td>
                  <td>{item.senderName || "N/A"}</td>
                  <td>{item.receiverName || "N/A"}</td>
                  <td>{formatDate(item.transactionDateTime || item.depositDate, true)}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td><StatusBadge status={item.proofInspectionStatus || "MANUAL_REVIEW"} /></td>
                  <td><StatusBadge status={item.status} /></td>
                  <td><button type="button" className={styles.reviewButton} onClick={() => { setSelectedId(item.id); if (!item.isSeenByAdmin) void updateRecord(item.id, { isSeenByAdmin: true }, "Record marked as seen."); }}><Eye size={15} />Open</button></td>
                </tr>
              ))}
              {!records.length && <EmptyTable colSpan={12} text="No bank verification records found." />}
            </tbody>
          </DataTable>
        </TableCard>

        <article className={styles.bankReviewPanel}>
          {selected ? (
            <>
              <SectionHeading icon={Landmark} title={selected.referenceNumber} text={`${selected.uploadedByName} · ${formatRole(selected.uploadedByRole)}`} />

              <div className={styles.detailGrid}>
                <Detail label="Amount" value={formatMoney(selected.amount)} />
                <Detail label="Bank name" value={selected.bankName || "UNSPECIFIED BANK"} />
                <Detail label="Account name" value={selected.accountName || selected.receiverName || "N/A"} />
                <Detail label="Bank account" value={selected.bankAccount || "N/A"} />
                <Detail label="From" value={selected.senderName || "N/A"} />
                <Detail label="To" value={selected.receiverName || "N/A"} />
                <Detail label="Transaction time" value={formatDate(selected.transactionDateTime, true)} />
                <Detail label="Uploaded" value={formatDate(selected.createdAt, true)} />
              </div>

              <div className={`${styles.proofAssessment} ${selected.proofInspectionStatus === "INSUFFICIENT" ? styles.proofAssessmentDanger : ""}`}>
                <ShieldCheck size={22} />
                <div>
                  <strong>Automatic proof check: {selected.proofInspectionStatus || "MANUAL_REVIEW"}</strong>
                  <p>
                    {safeArray<string>(selected.missingProofFields).length
                      ? `Missing or unreadable: ${safeArray<string>(selected.missingProofFields).join(", ")}`
                      : "The proof did not report missing required transaction fields."}
                  </p>
                </div>
              </div>

              <div className={styles.documentPreviewGrid}>
                {safeArray<any>(selected.documents).map((document) => (
                  <button type="button" key={document.id} onClick={() => setPreviewDocument(document)}>
                    <FileText size={19} />
                    <span><strong>{document.originalName}</strong><small>{document.kind} · {Math.round(Number(document.sizeBytes || 0) / 1024)} KB</small></span>
                    <StatusBadge status={document.proofStatus || "PENDING"} />
                  </button>
                ))}
                {!safeArray<any>(selected.documents).length && <EmptyInline text="No linked proof documents." />}
              </div>

              {selected.proofExtractedText && (
                <details className={styles.extractedTextBox}>
                  <summary>View automatically extracted document text</summary>
                  <pre>{selected.proofExtractedText}</pre>
                </details>
              )}

              <div className={styles.decisionCard}>
                <Field label="Verification decision">
                  <select value={decision} disabled={busy} onChange={(event) => setDecision(event.target.value)}>
                    <option value="PENDING">Pending</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="AMOUNT_MISMATCH">Amount mismatch</option>
                    <option value="MISSING_RECEIPT">Missing / insufficient receipt</option>
                    <option value="DUPLICATE_DEPOSIT">Duplicate deposit</option>
                    <option value="MISSING_BANK_RECORD">Missing bank record</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </Field>
                <Field label="Approval / rejection reason *">
                  <textarea rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Explain why the proof is accepted, rejected or held..." />
                </Field>
                {selected.proofInspectionStatus === "INSUFFICIENT" && decision === "VERIFIED" && (
                  <label className={styles.overrideCheck}><input type="checkbox" checked={overrideInsufficientProof} onChange={(event) => setOverrideInsufficientProof(event.target.checked)} /> I manually inspected the document and accept responsibility for overriding the insufficient-proof warning.</label>
                )}
                <button type="button" className={styles.fullButton} disabled={busy} onClick={applyDecision}><Save size={16} />Save decision</button>
              </div>

              <div className={styles.messageTimeline}>
                {safeArray<any>(selected.messages).map((item) => (
                  <div key={item.id}><span><MessageSquareText size={15} /></span><div><strong>{item.senderName} · {formatRole(item.senderRole)}</strong><p>{item.message}</p><small>{formatDate(item.createdAt, true)}</small></div></div>
                ))}
                {!safeArray<any>(selected.messages).length && <EmptyInline text="No review messages yet." />}
              </div>

              <div className={styles.messageComposer}>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask the uploader to send a clearer screenshot, document or reference..." rows={3} />
                <button type="button" onClick={sendMessage} disabled={busy}><MessageSquareText size={16} />Send message</button>
              </div>
            </>
          ) : <EmptyInline text="Select a bank verification record." />}
        </article>
      </div>

      <TableCard title="All uploaded portal documents" subtitle="SMS screenshots, images, PDFs, receipts, statements and service proofs">
        <DataTable minWidth={1100}>
          <thead><tr><th>#</th><th>Document</th><th>Kind</th><th>Uploader</th><th>Size</th><th>Compressed</th><th>Proof check</th><th>Uploaded</th><th>Preview</th></tr></thead>
          <tbody>
            {allDocuments.map((document, index) => (
              <tr key={document.id}><td>{index + 1}</td><td>{document.originalName}</td><td>{document.kind}</td><td><Entity name={document.uploadedBy?.name || document.uploadedById} sub={formatRole(document.uploadedBy?.role || "USER")} /></td><td>{Math.round(Number(document.sizeBytes || 0) / 1024)} KB</td><td>{document.compressed ? "Yes" : "No"}</td><td><StatusBadge status={document.proofStatus || "PENDING"} /></td><td>{formatDate(document.createdAt, true)}</td><td><button type="button" className={styles.reviewButton} onClick={() => setPreviewDocument(document)}><Eye size={15} />Preview</button></td></tr>
            ))}
            {!allDocuments.length && <EmptyTable colSpan={9} text="No uploaded documents found." />}
          </tbody>
        </DataTable>
      </TableCard>

      {previewDocument && <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />}
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
  const users = safeArray<any>(data.users).filter((item) =>
    ["STAFF", "ACCOUNTANT"].includes(safeText(item.role)),
  );
  const records = safeArray<any>(data.attendance);
  const [period, setPeriod] = useState<AttendanceFilterPeriod>("WEEK");
  const [referenceDate, setReferenceDate] = useState(todayInput());
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");

  const range = useMemo(
    () => getAttendancePeriodRange(period, referenceDate),
    [period, referenceDate],
  );
  const columns = useMemo(
    () => buildAttendanceColumns(period, referenceDate),
    [period, referenceDate],
  );

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((item) => {
      const matchesRole = !roleFilter || item.role === roleFilter;
      const matchesSearch =
        !query ||
        [item.name, item.email, item.phone, item.nidaNumber].some((value) =>
          safeText(value).toLowerCase().includes(query),
        );
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, search]);

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
      map.set(`${safeText(item.userId)}:${localDateKey(item.attendanceDate)}`, item);
    });
    return map;
  }, [filteredRecords]);

  async function quickMark(userId: string, date: Date, mark: string) {
    setBusy(true);
    try {
      await requestJson("/api/company-admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          attendanceDate: localDateKey(date),
          mark,
          source: "ADMIN_JOURNAL",
        }),
      });
      notify(`Attendance marked ${mark.toLowerCase()}.`);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Attendance update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function markVisibleToday(mark: "PRESENT" | "ABSENT") {
    if (!visibleUsers.length) return;
    setBusy(true);
    try {
      await requestJson("/api/company-admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: visibleUsers.map((item) => ({
            userId: item.id,
            attendanceDate: referenceDate,
            mark,
            source: "ADMIN_BULK_JOURNAL",
          })),
        }),
      });
      notify(`All visible users marked ${mark.toLowerCase()}.`);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Bulk attendance failed.");
    } finally {
      setBusy(false);
    }
  }

  const selectedUser = users.find((item) => item.id === selectedUserId) || visibleUsers[0];
  const selectedRecords = filteredRecords.filter(
    (item) => item.userId === selectedUser?.id,
  );
  const selectedSummary = summarizeAttendanceRange(selectedRecords);
  const overallSummary = summarizeAttendanceRange(filteredRecords);

  return (
    <PageShell
      icon={CalendarCheck2}
      title="Staff and Accountant Attendance Journal"
      subtitle="Use the small ✓ and ✕ boxes to mark present or absent. Filter the journal by calendar day, week, month or year."
      action={
        <div className={styles.headingActions}>
          <button type="button" disabled={busy} onClick={() => markVisibleToday("PRESENT")}><Check size={16} />Mark visible present</button>
          <button type="button" disabled={busy} onClick={() => markVisibleToday("ABSENT")}><X size={16} />Mark visible absent</button>
        </div>
      }
    >
      <section className={styles.attendanceFilterPanel}>
        <div className={styles.periodTabs}>
          {([[
            "DAY",
            "Day",
          ], ["WEEK", "Week"], ["MONTH", "Month"], ["YEAR", "Year"]] as Array<[AttendanceFilterPeriod, string]>).map(([value, label]) => (
            <button type="button" className={period === value ? styles.activePeriod : ""} onClick={() => setPeriod(value)} key={value}>{label}</button>
          ))}
        </div>
        <div className={styles.attendanceFilterFields}>
          <Field label="Reference date"><input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /></Field>
          <Field label="Role"><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">Staff and accountants</option><option value="STAFF">Staff only</option><option value="ACCOUNTANT">Accountants only</option></select></Field>
          <Field label="Search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone or NIDA" /></Field>
        </div>
        <div className={styles.periodRangeLabel}><CalendarDays size={18} /><span><small>Displaying</small><strong>{formatPeriodRange(range.start, range.end)}</strong></span></div>
      </section>

      <section className={styles.attendanceMetricGrid}>
        <AttendanceMetric icon={Check} label="Present" value={overallSummary.present} theme="green" />
        <AttendanceMetric icon={Clock3} label="Late" value={overallSummary.late} theme="orange" />
        <AttendanceMetric icon={X} label="Absent" value={overallSummary.absent} theme="red" />
        <AttendanceMetric icon={CalendarDays} label="Leave / holiday" value={overallSummary.leave + overallSummary.holiday} theme="purple" />
      </section>

      <TableCard title="Attendance journal" subtitle={`${visibleUsers.length} Staff / Accountant users · click a small box to save immediately`}>
        <DataTable minWidth={Math.max(1000, columns.length * 115 + 430)}>
          <thead>
            <tr><th>#</th><th>Photo</th><th>User</th><th>Role</th>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Rate</th><th>Review</th></tr>
          </thead>
          <tbody>
            {visibleUsers.map((item, index) => {
              const userRecords = filteredRecords.filter((record) => record.userId === item.id);
              const summary = summarizeAttendanceRange(userRecords);
              return (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><ProfileAvatar name={item.name} url={item.profileImageUrl} /></td>
                  <td><Entity name={item.name} sub={item.email} /></td>
                  <td>{formatRole(item.role)}</td>
                  {columns.map((column) => {
                    if (column.mode === "DAY") {
                      const record = dailyIndex.get(`${item.id}:${localDateKey(column.start)}`);
                      const mark = safeText(record?.mark);
                      return (
                        <td key={column.key}>
                          <div className={styles.attendanceQuickCell}>
                            <button type="button" disabled={busy} className={mark === "PRESENT" ? styles.quickPresentActive : ""} title="Present" onClick={() => quickMark(item.id, column.start, "PRESENT")}><Check size={14} /></button>
                            <button type="button" disabled={busy} className={mark === "ABSENT" ? styles.quickAbsentActive : ""} title="Absent" onClick={() => quickMark(item.id, column.start, "ABSENT")}><X size={14} /></button>
                            <button type="button" disabled={busy} className={mark === "LATE" ? styles.quickLateActive : ""} title="Late" onClick={() => quickMark(item.id, column.start, "LATE")}><Clock3 size={13} /></button>
                          </div>
                        </td>
                      );
                    }
                    const periodRecords = userRecords.filter((record) => dateIsInsideRange(record.attendanceDate, column.start, column.end));
                    return <td key={column.key}><AttendanceAggregate records={periodRecords} /></td>;
                  })}
                  <td><AttendanceRate value={summary.rate} attended={summary.present + summary.late} total={summary.workingRecords} /></td>
                  <td><button type="button" className={styles.reviewButton} onClick={() => setSelectedUserId(item.id)}><Eye size={15} />Review</button></td>
                </tr>
              );
            })}
            {!visibleUsers.length && <EmptyTable colSpan={columns.length + 7} text="No Staff or Accountant user matches the filters." />}
          </tbody>
        </DataTable>
      </TableCard>

      <div className={styles.attendanceReview}>
        <div>
          <SectionHeading icon={UserCheck} title={selectedUser?.name || "Select a user"} text={`${formatRole(selectedUser?.role)} · ${formatPeriodRange(range.start, range.end)}`} />
          <div className={styles.reviewStats}>
            <ReviewStat label="Present" value={String(selectedSummary.present)} />
            <ReviewStat label="Late" value={String(selectedSummary.late)} />
            <ReviewStat label="Absent" value={String(selectedSummary.absent)} />
            <ReviewStat label="Attendance rate" value={`${selectedSummary.rate}%`} />
          </div>
        </div>
        <div className={styles.attendanceLegend}><span><Check size={15} />Present</span><span><Clock3 size={15} />Late</span><span><X size={15} />Absent</span><span><CalendarDays size={15} />Leave / holiday</span></div>
      </div>
    </PageShell>
  );
}

function PerformancePage({ data, reload, notify }: CommonPageProps) {
  const rows = safeArray<any>(data.performanceRows);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ success: true; created: number }>("/api/company-admin/performance/check-alerts", { method: "POST" })
      .then(async (result) => {
        if (!cancelled && result.created > 0) {
          notify(`${result.created} staff performance alert(s) were generated.`);
          await reload();
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell
      icon={Trophy}
      title="Staff Performance"
      subtitle="Performance combines float issued and returned, outstanding balances, attendance, service-proof compliance and income generated for the company."
    >
      <section className={styles.performanceGrid}>
        {rows.slice(0, 8).map((item, index) => (
          <article className={`${styles.performanceCard} ${item.needsAlert ? styles.performanceAlertCard : ""}`} key={item.userId}>
            <span className={styles.rankBadge}>#{index + 1}</span>
            <ProfileAvatar name={item.userName} url={item.profileImageUrl} large />
            <h3>{item.userName}</h3>
            <p>{formatRole(item.userRole)}</p>
            <div className={styles.scoreRing} style={{ "--score": `${Math.min(100, Number(item.score || 0))}%` } as any}>
              <strong>{item.score}%</strong>
            </div>
            <StatusBadge status={item.rating} />
            <div className={styles.performanceCardStats}>
              <span><small>Attendance</small><strong>{Number(item.attendanceRate || 0).toFixed(0)}%</strong></span>
              <span><small>Return rate</small><strong>{Number(item.returnRate || 0).toFixed(0)}%</strong></span>
              <span><small>Services</small><strong>{item.completedVisits || 0}</strong></span>
              <span><small>Income</small><strong>{formatMoneyShort(item.companyIncome || 0)}</strong></span>
            </div>
            {item.needsAlert && <small className={styles.performanceWarning}>Below the configured performance target</small>}
          </article>
        ))}
      </section>

      <section className={styles.metricStrip}>
        <ColorMetric icon={Banknote} label="Total float issued" value={formatMoneyShort(rows.reduce((sum, item) => sum + Number(item.totalFloatIssued || 0), 0))} theme="purple" />
        <ColorMetric icon={TrendingUp} label="Float returned" value={formatMoneyShort(rows.reduce((sum, item) => sum + Number(item.totalFloatReturned || 0), 0))} theme="green" />
        <ColorMetric icon={TrendingDown} label="Outstanding" value={formatMoneyShort(rows.reduce((sum, item) => sum + Number(item.outstandingBalance || 0), 0))} theme="red" />
        <ColorMetric icon={BadgeDollarSign} label="Company income" value={formatMoneyShort(rows.reduce((sum, item) => sum + Number(item.companyIncome || 0), 0))} theme="orange" />
      </section>

      <TableCard title="Calculated staff KPI" subtitle="A low score creates a visible warning and is included in the notification and report workflow">
        <DataTable minWidth={1450}>
          <thead><tr><th>#</th><th>Staff</th><th>Attendance</th><th>Float issued</th><th>Returned</th><th>Outstanding</th><th>Return rate</th><th>Visits</th><th>Proof compliance</th><th>Service value</th><th>Company income</th><th>Score</th><th>Rating</th></tr></thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.userId}>
                <td>{index + 1}</td>
                <td><div className={styles.entityWithAvatar}><ProfileAvatar name={item.userName} url={item.profileImageUrl} /><Entity name={item.userName} sub={formatRole(item.userRole)} /></div></td>
                <td>{Number(item.attendanceRate || 0).toFixed(1)}%</td>
                <td>{formatMoney(item.totalFloatIssued)}</td>
                <td>{formatMoney(item.totalFloatReturned)}</td>
                <td>{formatMoney(item.outstandingBalance)}</td>
                <td>{Number(item.returnRate || 0).toFixed(1)}%</td>
                <td>{item.completedVisits}/{item.visits}</td>
                <td>{Number(item.proofComplianceRate || 0).toFixed(1)}%{item.lateProof ? ` · ${item.lateProof} late` : ""}</td>
                <td>{formatMoney(item.serviceValue)}</td>
                <td>{formatMoney(item.companyIncome)}</td>
                <td><strong>{item.score}%</strong></td>
                <td><StatusBadge status={item.rating} /></td>
              </tr>
            ))}
            {!rows.length && <EmptyTable colSpan={13} text="No staff performance data is available yet." />}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function GpsPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const devices = safeArray<any>(data.gpsDevices);
  const brokers = safeArray<BrokerCustomerItem>(data.brokers);
  const visits = safeArray<any>(data.serviceVisits);
  const services = safeArray<any>(data.serviceActivities);
  const [showTokens, setShowTokens] = useState(false);
  const [showDevices, setShowDevices] = useState(true);
  const [showVisits, setShowVisits] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [form, setForm] = useState({ name: "", deviceType: "PHONE", ownerUserId: "", allowMultiple: false });
  const [newToken, setNewToken] = useState("");
  const [lastLiveRefresh, setLastLiveRefresh] = useState(new Date());

  useEffect(() => {
    async function checkOverdue() {
      try {
        const result = await requestJson<{ success: true; overdue: number }>(
          "/api/company-admin/service-visits/check-overdue",
          { method: "POST" },
        );
        if (result.overdue > 0) {
          notify(`${result.overdue} service proof record(s) are overdue.`);
          await reload();
        }
      } catch {
        // The dashboard remains usable when the optional deadline check fails.
      }
    }

    void checkOverdue();
    const timer = window.setInterval(() => void checkOverdue(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let running = false;

    const refreshLivePositions = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        await reload();
        setLastLiveRefresh(new Date());
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => void refreshLivePositions(), 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshLivePositions();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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
      setForm({ name: "", deviceType: "PHONE", ownerUserId: "", allowMultiple: false });
      setShowTokens(true);
      notify("GPS device created. Copy its token now.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Device creation failed.");
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

  const servicedAmountByBroker = useMemo(() => {
    const map = new Map<string, number>();
    services.forEach((service) => {
      const brokerId = safeText(service.brokerCustomerId || service.brokerCustomer?.id || service.brokerId);
      if (brokerId) map.set(brokerId, (map.get(brokerId) || 0) + Number(service.amount || 0));
    });
    return map;
  }, [services]);

  const staffMarkers = devices
    .filter((device) => device.lastLatitude != null && device.lastLongitude != null)
    .map((device) => ({
      type: "STAFF",
      latitude: Number(device.lastLatitude),
      longitude: Number(device.lastLongitude),
      label: device.ownerName || device.name,
      detail: `${device.name} · ${deviceOnlineStatus(device)} · ${formatDate(device.lastSeenAt, true)}`,
    }));

  const brokerMarkers = brokers
    .filter((broker) => broker.latitude != null && broker.longitude != null)
    .map((broker) => ({
      type: "BROKER",
      latitude: Number(broker.latitude),
      longitude: Number(broker.longitude),
      label: broker.name,
      detail: `${broker.businessName || "Broker"} · serviced ${formatMoney(servicedAmountByBroker.get(broker.id) || 0)}`,
    }));

  const mapHtml = createMultiMarkerMapHtml([...staffMarkers, ...brokerMarkers]);

  return (
    <PageShell
      icon={MapPinned}
      title="GPS Tracking and Broker Service Map"
      subtitle="Staff pointers are blue and labelled with staff names. Broker pointers are orange and display broker names plus the amount serviced."
    >
      <section className={styles.gpsToolbar}>
        <span className={styles.liveGpsStatus}>
          <i /> Live movement refresh every 10 seconds · last update {lastLiveRefresh.toLocaleTimeString("en-GB")}
        </span>
        <button type="button" onClick={() => { void reload().then(() => setLastLiveRefresh(new Date())); }}><RefreshCw size={17} />Refresh positions</button>
        <button type="button" onClick={() => setShowTokens((value) => !value)}>{showTokens ? <EyeOff size={17} /> : <Eye size={17} />}{showTokens ? "Hide all device tokens" : "Show all device tokens"}</button>
        <button type="button" onClick={() => setShowDevices((value) => !value)}>{showDevices ? <EyeOff size={17} /> : <Eye size={17} />}{showDevices ? "Hide registered devices" : "Show registered devices"}</button>
        <button type="button" onClick={() => setShowVisits((value) => !value)}>{showVisits ? <EyeOff size={17} /> : <MapPin size={17} />}{showVisits ? "Hide staff-to-broker visits" : "Show staff-to-broker visits"}</button>
        <button type="button" onClick={() => setShowServices((value) => !value)}>{showServices ? <EyeOff size={17} /> : <Activity size={17} />}{showServices ? "Hide all broker services" : "Show all broker services"}</button>
      </section>

      <section className={styles.gpsLayout}>
        <article className={styles.mapPanel}>
          <div className={styles.mapHeader}>
            <div><strong>Live users and broker map</strong><span>{staffMarkers.length} staff devices · {brokerMarkers.length} broker locations</span></div>
            <div className={styles.mapLegend}><span><i className={styles.staffLegendDot} />Staff</span><span><i className={styles.brokerLegendDot} />Broker</span></div>
          </div>
          {staffMarkers.length || brokerMarkers.length ? (
            <iframe className={styles.mapFrame} srcDoc={mapHtml} title="Staff and broker GPS map" loading="lazy" sandbox="allow-scripts allow-same-origin" />
          ) : (
            <div className={styles.mapEmpty}><MapPin size={44} /><strong>No coordinates available</strong><p>Connect staff devices and save broker latitude/longitude to display both pointer types.</p></div>
          )}
          <div className={styles.mapStats}>
            <MapStat icon={Users} label="Tracked staff" value={String(staffMarkers.length)} />
            <MapStat icon={UserCheck} label="Mapped brokers" value={String(brokerMarkers.length)} />
            <MapStat icon={Activity} label="Service visits" value={String(visits.length)} />
            <MapStat icon={Clock3} label="Overdue proofs" value={String(visits.filter((visit) => visit.status === "LATE_PROOF").length)} />
          </div>
        </article>

        <div className={styles.gpsSide}>
          <form className={styles.formCard} onSubmit={createDevice}>
            <SectionHeading icon={Smartphone} title="Register GPS device" text="A secure token is generated and can be copied from the token list." />
            <div className={styles.formGrid}>
              <Field label="Device name *"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Device type *"><select required value={form.deviceType} onChange={(event) => setForm({ ...form, deviceType: event.target.value })}><option value="PHONE">Phone</option><option value="MOTORCYCLE">Motorcycle tracker</option><option value="VEHICLE">Vehicle tracker</option></select></Field>
              <Field label="Assign user *"><select required value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })}><option value="">Choose Staff / Accountant</option>{safeArray<any>(data.users).filter((item) => ["STAFF", "ACCOUNTANT", "GPS_MANAGER"].includes(item.role)).map((item) => <option value={item.id} key={item.id}>{item.name} — {formatRole(item.role)}</option>)}</select></Field>
              <label className={styles.overrideCheck}><input type="checkbox" checked={form.allowMultiple} onChange={(event) => setForm({ ...form, allowMultiple: event.target.checked })} />Allow this user to have more than one active device.</label>
            </div>
            <button className={styles.fullButton} disabled={busy}><Plus size={17} />Create device</button>
          </form>

          {newToken && (
            <div className={styles.tokenCard}><ShieldCheck size={22} /><div><strong>New token</strong><code>{newToken}</code><button type="button" onClick={() => navigator.clipboard.writeText(newToken)}>Copy token</button></div></div>
          )}

          <div className={styles.integrationCard}>
            <SectionHeading icon={Smartphone} title="Tracker integration" text="The staff phone posts location using the generated device token." />
            <ol><li>Open <code>/device-tracker</code> on the assigned phone.</li><li>Paste the token and allow precise GPS permission.</li><li>When the staff reaches a broker, the service update endpoint compares both locations.</li><li>After service is recorded, proof is due within {Number(data.settings?.proofGraceMinutes || 30)} minutes.</li></ol>
          </div>
        </div>
      </section>

      {showTokens && (
        <TableCard title="All generated device tokens" subtitle="Use Copy to configure each registered device">
          <DataTable minWidth={1000}>
            <thead><tr><th>#</th><th>Device</th><th>Owner</th><th>Token</th><th>Created</th><th>Status</th><th>Copy</th></tr></thead>
            <tbody>{devices.map((device, index) => <tr key={device.id}><td>{index + 1}</td><td>{device.name}</td><td>{device.ownerName || "Unassigned"}</td><td><code className={styles.tokenCode}>{device.deviceToken}</code></td><td>{formatDate(device.createdAt, true)}</td><td><StatusBadge status={device.status} /></td><td><button type="button" className={styles.reviewButton} onClick={() => { void navigator.clipboard.writeText(device.deviceToken); notify("Device token copied."); }}>Copy</button></td></tr>)}</tbody>
          </DataTable>
        </TableCard>
      )}

      {showDevices && (
        <TableCard title="Registered and tracked devices" subtitle="Click the toggle button above to hide or show this list">
          <DataTable minWidth={1150}>
            <thead><tr><th>#</th><th>Device</th><th>Owner</th><th>Type</th><th>Latitude / longitude</th><th>Battery</th><th>Last seen</th><th>Tracking</th><th>Control</th></tr></thead>
            <tbody>
              {devices.map((device, index) => (
                <tr key={device.id}><td>{index + 1}</td><td>{device.name}</td><td>{device.ownerName || "Unassigned"}</td><td>{device.deviceType}</td><td>{device.lastLatitude == null ? "Waiting" : `${Number(device.lastLatitude).toFixed(5)}, ${Number(device.lastLongitude).toFixed(5)}`}</td><td>{device.batteryLevel == null ? "N/A" : `${device.batteryLevel}%`}</td><td>{formatDate(device.lastSeenAt, true)}</td><td><StatusBadge status={deviceOnlineStatus(device)} /></td><td>{device.status === "ACTIVE" ? <button type="button" className={styles.dangerTextButton} onClick={() => changeDeviceStatus(device.id, "INACTIVE")}><PowerOff size={15} />Disable</button> : <button type="button" className={styles.successTextButton} onClick={() => changeDeviceStatus(device.id, "ACTIVE")}><Power size={15} />Activate</button>}</td></tr>
              ))}
              {!devices.length && <EmptyTable colSpan={9} text="No GPS devices registered." />}
            </tbody>
          </DataTable>
        </TableCard>
      )}

      {showVisits && (
        <TableCard title="Staff visits to brokers" subtitle="This data is generated when staff start a visit and click the service update action">
          <DataTable minWidth={1500}>
            <thead><tr><th>#</th><th>Staff</th><th>Broker</th><th>Started</th><th>Service time</th><th>Staff location</th><th>Broker location</th><th>Distance</th><th>Same location</th><th>Float</th><th>Cash</th><th>Income</th><th>Proof due</th><th>Status</th></tr></thead>
            <tbody>
              {visits.map((visit, index) => (
                <tr key={visit.id}><td>{index + 1}</td><td>{visit.staff?.name || "N/A"}</td><td>{visit.brokerCustomer?.name || visit.broker?.name || "N/A"}</td><td>{formatDate(visit.startedAt, true)}</td><td>{formatDate(visit.serviceProvidedAt, true)}</td><td>{visit.staffLatitude == null ? "N/A" : `${Number(visit.staffLatitude).toFixed(5)}, ${Number(visit.staffLongitude).toFixed(5)}`}</td><td>{visit.brokerLatitude == null ? "N/A" : `${Number(visit.brokerLatitude).toFixed(5)}, ${Number(visit.brokerLongitude).toFixed(5)}`}</td><td>{visit.distanceMeters == null ? "N/A" : `${Math.round(Number(visit.distanceMeters))} m`}</td><td><StatusBadge status={visit.locationMatched ? "MATCHED" : "NOT_MATCHED"} /></td><td>{formatMoney(visit.floatAmount)}</td><td>{formatMoney(visit.cashAmount)}</td><td>{formatMoney(visit.companyIncome)}</td><td>{formatDate(visit.proofDueAt, true)}</td><td><StatusBadge status={visit.status} /></td></tr>
              ))}
              {!visits.length && <EmptyTable colSpan={14} text="No broker visit updates have been recorded." />}
            </tbody>
          </DataTable>
        </TableCard>
      )}

      {showServices && (
        <TableCard title="All services provided to brokers" subtitle="Staff, broker, communication notes, location, exact date/time and amount">
          <DataTable minWidth={1350}>
            <thead><tr><th>#</th><th>Date/time</th><th>Staff</th><th>Broker</th><th>Network accounts</th><th>Service</th><th>Amount</th><th>Location</th><th>Communication / notes</th><th>Status</th></tr></thead>
            <tbody>
              {services.map((service, index) => {
                const broker = service.brokerCustomer || service.broker;
                return <tr key={service.id}><td>{index + 1}</td><td>{formatDate(service.servedAt, true)}</td><td>{service.staff?.name || "N/A"}</td><td>{broker?.name || service.customer?.name || "N/A"}</td><td>{safeArray<BrokerAgentAccountItem>(broker?.agentAccounts).map((account) => `${account.network}:${account.agentNumber}`).join(", ") || "N/A"}</td><td>{service.serviceType}</td><td>{formatMoney(service.amount)}</td><td>{service.locationName || (service.latitude == null ? "N/A" : `${service.latitude}, ${service.longitude}`)}</td><td>{service.notes || "N/A"}</td><td><StatusBadge status={service.status || "COMPLETED"} /></td></tr>;
              })}
              {!services.length && <EmptyTable colSpan={10} text="No broker services have been recorded." />}
            </tbody>
          </DataTable>
        </TableCard>
      )}
    </PageShell>
  );
}

function AccountingPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return localDateKey(date);
  });
  const [to, setTo] = useState(todayInput());
  const [showPreview, setShowPreview] = useState(true);
  const [balanceForm, setBalanceForm] = useState({
    network: "VODACOM",
    simCardNumber: "",
    accountName: "",
    floatBalance: "",
    cashBalance: "",
  });

  async function saveNetworkBalance(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestJson("/api/company-admin/network-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...balanceForm,
          floatBalance: Number(balanceForm.floatBalance),
          cashBalance: Number(balanceForm.cashBalance),
        }),
      });
      setBalanceForm({ network: "VODACOM", simCardNumber: "", accountName: "", floatBalance: "", cashBalance: "" });
      notify("Network SIM balance saved.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save network balance.");
    } finally {
      setBusy(false);
    }
  }

  const deposits = Number(data.stats.totalDeposits || 0);
  const expenses = Number(data.stats.approvedExpenses || 0);
  const serviceIncome = Number(data.stats.totalCompanyIncome || 0);
  const outstandingFloat = Number(data.stats.outstandingFloat || 0);
  const netPosition = deposits + serviceIncome - expenses - outstandingFloat;
  const statement = safeArray<any>(data.importedBankStatements)[0];

  const exportPdf = () => {
    const query = new URLSearchParams({ kind: "accounting", from, to });
    window.open(`/api/company-admin/reports/export?${query.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <PageShell
      icon={BookOpen}
      title="Accounting Module"
      subtitle="Real Prisma finance data, network balances, imported bank movement and PDF-ready accounting reports."
      action={
        <div className={styles.pageActionGroup}>
          <button type="button" onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? <EyeOff size={17} /> : <Eye size={17} />}
            {showPreview ? "Hide preview" : "Preview report"}
          </button>
          <button type="button" onClick={exportPdf}>
            <Download size={17} /> Export PDF
          </button>
        </div>
      }
    >
      <div className={styles.reportFilters}>
        <Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>

      <section className={styles.metricStrip}>
        <ColorMetric icon={Landmark} label="Verified cash in" value={formatMoneyShort(deposits)} theme="green" />
        <ColorMetric icon={ReceiptText} label="Approved cash out" value={formatMoneyShort(expenses)} theme="red" />
        <ColorMetric icon={BadgeDollarSign} label="Company income" value={formatMoneyShort(serviceIncome)} theme="purple" />
        <ColorMetric icon={WalletCards} label="Outstanding float" value={formatMoneyShort(outstandingFloat)} theme="orange" />
      </section>

      {showPreview && (
        <section className={styles.reportPreviewSheet}>
          <header>
            <div><small>SIMAMIA FLOAT ERP</small><h2>Accounting Statement Preview</h2><p>{formatDate(from)} — {formatDate(to)}</p></div>
            <div><small>Net position</small><strong>{formatMoney(netPosition)}</strong></div>
          </header>
          <div className={styles.previewSummaryGrid}>
            <Detail label="Verified deposits" value={formatMoney(deposits)} />
            <Detail label="Approved expenses" value={formatMoney(expenses)} />
            <Detail label="Service income" value={formatMoney(serviceIncome)} />
            <Detail label="Unreturned float/cash" value={formatMoney(outstandingFloat)} />
            <Detail label="Imported bank account" value={statement?.accountNumber || "No imported statement"} />
            <Detail label="Imported available balance" value={statement ? formatMoney(statement.availableBalance) : "N/A"} />
          </div>
        </section>
      )}

      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={saveNetworkBalance}>
          <SectionHeading icon={Smartphone} title="Update network SIM balance" text="The same network and SIM number is updated instead of duplicated." />
          <div className={styles.formGrid}>
            <Field label="Network *"><select required value={balanceForm.network} onChange={(event) => setBalanceForm({ ...balanceForm, network: event.target.value })}><option value="VODACOM">Vodacom</option><option value="YAS_MIX">Mix by Yas</option><option value="AIRTEL">Airtel</option><option value="HALOTEL">Halotel</option><option value="OTHER">Other</option></select></Field>
            <Field label="SIM card number *"><input required value={balanceForm.simCardNumber} onChange={(event) => setBalanceForm({ ...balanceForm, simCardNumber: event.target.value })} /></Field>
            <Field label="Account name *"><input required value={balanceForm.accountName} onChange={(event) => setBalanceForm({ ...balanceForm, accountName: event.target.value })} /></Field>
            <Field label="Float balance *"><input required min="0" type="number" value={balanceForm.floatBalance} onChange={(event) => setBalanceForm({ ...balanceForm, floatBalance: event.target.value })} /></Field>
            <Field label="Cash balance *"><input required min="0" type="number" value={balanceForm.cashBalance} onChange={(event) => setBalanceForm({ ...balanceForm, cashBalance: event.target.value })} /></Field>
          </div>
          <div className={styles.formActions}><button type="submit" disabled={busy}><Save size={17} />Save balance</button></div>
        </form>

        <article className={styles.reportSummaryCard}>
          <CardHeader icon={Landmark} title="Imported bank statement" subtitle="Latest structured statement in Prisma" />
          <div className={styles.reportLine}><span>Account</span><strong>{statement?.accountNumber || "N/A"}</strong></div>
          <div className={styles.reportLine}><span>Account name</span><strong>{statement?.accountName || "N/A"}</strong></div>
          <div className={styles.reportLine}><span>Total credit</span><strong>{formatMoney(statement?.totalCredit)}</strong></div>
          <div className={styles.reportLine}><span>Total debit</span><strong>{formatMoney(statement?.totalDebit)}</strong></div>
          <div className={styles.reportLine}><span>Available balance</span><strong>{formatMoney(statement?.availableBalance)}</strong></div>
        </article>
      </div>

      <TableCard title="Network SIM balances" subtitle="Current cash and float balance for each registered network SIM card">
        <DataTable minWidth={900}>
          <thead><tr><th>#</th><th>Network</th><th>SIM card</th><th>Account</th><th>Float balance</th><th>Cash balance</th><th>Total</th><th>Updated</th></tr></thead>
          <tbody>
            {safeArray<any>(data.networkBalances).map((item, index) => (
              <tr key={item.id}><td>{index + 1}</td><td><StatusBadge status={item.network} /></td><td>{item.simCardNumber}</td><td>{item.accountName || "N/A"}</td><td>{formatMoney(item.floatBalance)}</td><td>{formatMoney(item.cashBalance)}</td><td>{formatMoney(Number(item.floatBalance || 0) + Number(item.cashBalance || 0))}</td><td>{formatDate(item.updatedAt, true)}</td></tr>
            ))}
            {!safeArray<any>(data.networkBalances).length && <EmptyTable colSpan={8} text="No network balances have been registered." />}
          </tbody>
        </DataTable>
      </TableCard>

      <TableCard title="Daily cash movement" subtitle="Verified cash in, approved cash out and closing position">
        <DataTable>
          <thead><tr><th>Date</th><th>Opening</th><th>Cash in</th><th>Cash out</th><th>Closing</th><th>Status</th></tr></thead>
          <tbody>
            {safeArray<any>(data.financialDays).map((day) => (
              <tr key={day.id}><td>{formatDate(day.date)}</td><td>{formatMoney(day.openingBalance)}</td><td>{formatMoney(day.cashIn)}</td><td>{formatMoney(day.cashOut)}</td><td>{formatMoney(day.closingBalance)}</td><td><StatusBadge status={day.status} /></td></tr>
            ))}
            {!safeArray<any>(data.financialDays).length && <EmptyTable colSpan={6} text="No financial-day records are available." />}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function NotificationsPage({ data, reload, notify }: CommonPageProps) {
  const notifications = safeArray<any>(data.allNotifications?.length ? data.allNotifications : data.notifications);
  const activities = safeArray<any>(data.activities).map((item) => ({
    ...item,
    id: `activity-${item.id}`,
    title: `${item.module}: ${item.action}`,
    message: item.details || `${item.actorName || "A user"} completed a system activity.`,
    type: "ACTIVITY",
    isRead: true,
    source: "AUDIT",
  }));
  const feed = [...notifications.map((item) => ({ ...item, source: "NOTIFICATION" })), ...activities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function readOne(id: string) {
    try {
      await requestJson(`/api/company-admin/notifications/${id}/read`, { method: "PATCH" });
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function readAll() {
    try {
      await requestJson("/api/company-admin/notifications/read-all", { method: "PATCH" });
      notify("All notifications marked as read.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <PageShell
      icon={Bell}
      title="Notification & Activity Center"
      subtitle="Every financial, attendance, GPS, proof, approval and account activity is shown in one chronological feed."
      action={<button type="button" onClick={readAll}><CheckCircle2 size={17} /> Mark notifications read</button>}
    >
      <section className={styles.notificationSummaryStrip}>
        <ColorMetric icon={Bell} label="Notifications" value={String(notifications.length)} theme="purple" />
        <ColorMetric icon={Activity} label="Audit activities" value={String(activities.length)} theme="green" />
        <ColorMetric icon={Clock3} label="Unread" value={String(notifications.filter((item) => !item.isRead).length)} theme="orange" />
        <ColorMetric icon={ShieldCheck} label="Total activity feed" value={String(feed.length)} theme="red" />
      </section>

      <section className={styles.notificationGrid}>
        {feed.map((item) => (
          <article className={`${styles.notificationCard} ${item.isRead ? styles.notificationRead : ""}`} key={item.id}>
            <span className={styles.notificationTypeIcon}>
              {item.type === "BANK" ? <Landmark size={21} /> : item.type === "EXPENSE" ? <ReceiptText size={21} /> : item.type === "ATTENDANCE" ? <CalendarCheck2 size={21} /> : item.type === "GPS" ? <MapPinned size={21} /> : item.type === "ACTIVITY" ? <Activity size={21} /> : <Bell size={21} />}
            </span>
            <div>
              <div className={styles.notificationTitleRow}><strong>{item.title}</strong><StatusBadge status={item.source === "AUDIT" ? "AUDIT" : item.isRead ? "READ" : "UNREAD"} /></div>
              <p>{item.message}</p>
              <small>{item.actorName ? `${item.actorName} · ` : ""}{formatDate(item.createdAt, true)}</small>
            </div>
            {item.source === "NOTIFICATION" && !item.isRead && <button type="button" onClick={() => readOne(item.id)}><Eye size={15} /> Mark read</button>}
          </article>
        ))}
        {!feed.length && <div className={styles.largeEmpty}><Bell size={40} /><h3>No activity</h3><p>New system activities will appear here.</p></div>}
      </section>
    </PageShell>
  );
}

function ReportsPage({ data }: { data: DashboardData }) {
  const [showReportPreview, setShowReportPreview] = useState(true);
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
        <div className={styles.pageActionGroup}>
          <button type="button" onClick={() => setShowReportPreview((value) => !value)}>
            {showReportPreview ? <EyeOff size={17} /> : <Eye size={17} />}
            {showReportPreview ? "Hide preview" : "Preview report"}
          </button>
          <button type="button" onClick={() => {
            const query = new URLSearchParams({ kind: "system", from: localDateKey(range.start), to: localDateKey(range.end) });
            window.open(`/api/company-admin/reports/export?${query.toString()}`, "_blank", "noopener,noreferrer");
          }}>
            <Download size={17} /> Export PDF
          </button>
        </div>
      }
    >
      {showReportPreview && (
        <section className={styles.reportPreviewSheet}>
          <header>
            <div>
              <small>SIMAMIA FLOAT ERP</small>
              <h2>Whole-System Report Preview</h2>
              <p>{formatPeriodRange(range.start, range.end)}</p>
            </div>
            <div>
              <small>Selected service value</small>
              <strong>{formatMoney(serviceRevenue)}</strong>
            </div>
          </header>
          <div className={styles.previewSummaryGrid}>
            <Detail label="Customers served" value={String(uniqueCustomers)} />
            <Detail label="Staff involved" value={String(uniqueStaff)} />
            <Detail label="Services provided" value={String(filteredServices.length)} />
            <Detail label="Attendance rate" value={`${attendanceTotals.rate}%`} />
            <Detail label="Income today" value={formatMoney(data.stats.incomeToday)} />
            <Detail label="Income this week" value={formatMoney(data.stats.incomeThisWeek)} />
            <Detail label="Income this month" value={formatMoney(data.stats.incomeThisMonth)} />
            <Detail label="Income this year" value={formatMoney(data.stats.incomeThisYear)} />
            <Detail label="Company income (all records)" value={formatMoney(data.stats.totalCompanyIncome)} />
            <Detail label="Outstanding float/cash" value={formatMoney(data.stats.outstandingFloat)} />
            <Detail label="Verified bank deposits" value={formatMoney(data.stats.totalDeposits)} />
            <Detail label="Approved expenses" value={formatMoney(data.stats.approvedExpenses)} />
            <Detail label="Insufficient proofs" value={String(data.stats.insufficientProofs || 0)} />
            <Detail label="Low-performing staff" value={String(data.stats.lowPerformingStaff || 0)} />
            <Detail label="Offline GPS devices" value={String(data.stats.offlineGpsDevices || 0)} />
            <Detail label="Network SIM balances" value={formatMoney(safeArray<any>(data.networkBalances).reduce((sum, item) => sum + Number(item.floatBalance || 0) + Number(item.cashBalance || 0), 0))} />
          </div>
        </section>
      )}

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

function ApprovalsPage({ data, currentUser, busy, setBusy, reload, notify }: CommonPageProps) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [proofOverrides, setProofOverrides] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("ALL");

  const expenseItems = safeArray<any>(data.expenses).map((item) => ({ ...item, itemType: "EXPENSE", label: item.category, owner: item.createdByName }));
  const bankItems = safeArray<any>(data.bankVerifications).map((item) => ({ ...item, itemType: "BANK_VERIFICATION", label: item.referenceNumber, owner: item.uploadedByName }));
  const allItems = [...expenseItems, ...bankItems].filter((item) => filter === "ALL" || item.workflowStatus === filter || item.status === filter);

  function decisionsFor(item: any) {
    const rows = safeArray<any>(item.approvalDecisions);
    return {
      accountant: rows.find((decision) => decision.reviewerRole === "ACCOUNTANT"),
      admin: rows.find((decision) => decision.reviewerRole === "COMPANY_ADMIN"),
    };
  }

  async function decide(item: any, decision: "APPROVED" | "REJECTED") {
    const key = `${item.itemType}:${item.id}`;
    const reason = safeText(reasons[key]).trim();
    if (!reason) {
      notify("Write a clear approval or rejection reason first.");
      return;
    }
    setBusy(true);
    try {
      await requestJson(`/api/company-admin/approvals/${item.itemType}/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason,
          overrideInsufficientProof: Boolean(proofOverrides[key]),
        }),
      });
      setReasons((current) => ({ ...current, [key]: "" }));
      setProofOverrides((current) => ({ ...current, [key]: false }));
      notify(`${formatRole(currentUser.role)} decision recorded.`);
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      icon={CheckCircle2}
      title="Dual Approval Center"
      subtitle="Accountant and Company Admin decisions are stored separately, with reasons and automatic conflict detection."
    >
      <div className={styles.approvalToolbar}>
        {['ALL','PENDING','PARTIAL','APPROVED','REJECTED','CONFLICT'].map((value) => <button type="button" key={value} className={filter === value ? styles.activePeriod : ""} onClick={() => setFilter(value)}>{value}</button>)}
      </div>

      <TableCard title="Expense and bank approval register" subtitle={`${allItems.length} workflow records; signed in as ${formatRole(currentUser.role)}`}>
        <DataTable minWidth={1650}>
          <thead><tr><th>#</th><th>Type / record</th><th>Submitted by</th><th>Amount</th><th>Proof</th><th>Accountant decision</th><th>Company Admin decision</th><th>Workflow</th><th>Your reason</th><th>Decision</th></tr></thead>
          <tbody>
            {allItems.map((item, index) => {
              const key = `${item.itemType}:${item.id}`;
              const decisions = decisionsFor(item);
              return (
                <tr key={key}>
                  <td>{index + 1}</td>
                  <td><Entity name={item.itemType === "EXPENSE" ? "Expense" : "Bank verification"} sub={item.label || item.id} /></td>
                  <td>{item.owner || "N/A"}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td><StatusBadge status={item.itemType === "EXPENSE" ? (item.receiptUrl ? "ATTACHED" : "MISSING") : item.proofInspectionStatus || "PENDING"} /></td>
                  <td><ApprovalDecisionView decision={decisions.accountant} /></td>
                  <td><ApprovalDecisionView decision={decisions.admin} /></td>
                  <td><StatusBadge status={item.workflowStatus || item.status || "PENDING"} /></td>
                  <td>
                    <textarea className={styles.approvalReasonInput} value={reasons[key] || ""} onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))} placeholder="Required reason for your decision" />
                    {item.itemType === "BANK_VERIFICATION" && item.proofInspectionStatus === "INSUFFICIENT" && currentUser.role === "COMPANY_ADMIN" && (
                      <label className={styles.approvalOverride}>
                        <input
                          type="checkbox"
                          checked={Boolean(proofOverrides[key])}
                          onChange={(event) => setProofOverrides((current) => ({ ...current, [key]: event.target.checked }))}
                        />
                        Override insufficient proof after manual preview
                      </label>
                    )}
                  </td>
                  <td><div className={styles.approvalActions}><button type="button" disabled={busy} onClick={() => decide(item, "APPROVED")} title="Approve"><Check size={15} /></button><button type="button" disabled={busy} onClick={() => decide(item, "REJECTED")} title="Reject"><X size={15} /></button></div></td>
                </tr>
              );
            })}
            {!allItems.length && <EmptyTable colSpan={10} text="No approval records match the selected workflow filter." />}
          </tbody>
        </DataTable>
      </TableCard>
    </PageShell>
  );
}

function SettingsPage({ data, busy, setBusy, reload, notify }: CommonPageProps) {
  const [settings, setSettings] = useState({
    ...defaultSettings,
    ...(data.settings || {}),
    reportLogoUrl: safeText(data.reportBrand?.logoUrl),
    registrationNumber: safeText(data.reportBrand?.registrationNumber),
    tin: safeText(data.reportBrand?.tin),
    website: safeText(data.reportBrand?.website),
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setSettings({
      ...defaultSettings,
      ...(data.settings || {}),
      reportLogoUrl: safeText(data.reportBrand?.logoUrl),
      registrationNumber: safeText(data.reportBrand?.registrationNumber),
      tin: safeText(data.reportBrand?.tin),
      website: safeText(data.reportBrand?.website),
    });
  }, [data.settings, data.reportBrand]);

  async function saveSettings() {
    setBusy(true);
    try {
      await requestJson("/api/company-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      notify("Company settings and PDF report branding saved.");
      await reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Settings failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadReportLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Company report logo must be a JPG, PNG or WEBP image.");
      return;
    }
    setUploadingLogo(true);
    try {
      const uploaded = await uploadPortalDocument(file, "IMAGE");
      setSettings((current) => ({ ...current, reportLogoUrl: uploaded.url }));
      notify("Company logo uploaded. Save settings to use it on PDF reports.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
    }
  }

  const toggles = [
    ["sms", "SMS notifications", "Send selected financial alerts by SMS.", Smartphone],
    ["email", "Email notifications", "Email reports and workflow alerts.", MessageSquareText],
    ["inApp", "In-app notifications", "Show live alerts inside the portal.", Bell],
    ["gpsAlerts", "GPS alerts", "Notify on offline, overdue proof and geofence events.", MapPinned],
    ["dayClosingLock", "Day closing lock", "Prevent closing when mismatches are unresolved.", ShieldCheck],
    ["attendanceApproval", "Attendance approval", "Require approval for manual attendance changes.", CalendarCheck2],
    ["bankMismatchHold", "Bank mismatch hold", "Hold insufficient or conflicting bank proof.", Landmark],
    ["lowCashAlert", "Low cash alert", "Notify management when network balances are low.", CircleDollarSign],
  ] as const;

  return (
    <PageShell icon={Settings} title="Company Settings" subtitle="Portal alerts, finance controls, GPS distance, proof deadlines, staff performance and registered PDF report branding." action={<button type="button" onClick={saveSettings} disabled={busy || uploadingLogo}><Save size={17} /> Save settings</button>}>
      <section className={styles.settingsHero}>
        <div><span><Settings size={24} /></span><div><h2>{safeText(data.company?.name)}</h2><p>Company ID: {safeText(data.company?.id)} · Status: {safeText(data.company?.status)}</p></div></div>
        <div className={styles.settingsSelects}>
          <Field label="Currency"><select value={safeText(settings.currency) || "TZS"} onChange={(event) => setSettings({ ...settings, currency: event.target.value })}><option value="TZS">TZS</option><option value="USD">USD</option><option value="KES">KES</option></select></Field>
          <Field label="Timezone"><select value={safeText(settings.timezone) || "Africa/Dar_es_Salaam"} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}><option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam</option><option value="UTC">UTC</option></select></Field>
          <Field label="Accent"><select value={safeText(settings.accent) || "TEAL"} onChange={(event) => setSettings({ ...settings, accent: event.target.value })}><option value="TEAL">Teal</option><option value="PURPLE">Purple</option><option value="BLUE">Blue</option></select></Field>
        </div>
      </section>

      <section className={styles.reportBrandingCard}>
        <div className={styles.reportBrandingIntro}>
          <div className={styles.reportLogoPreview}>
            {safeText(settings.reportLogoUrl) ? (
              <img src={safeText(settings.reportLogoUrl)} alt="Registered company logo" />
            ) : (
              <Building2 size={28} />
            )}
          </div>
          <div>
            <small>PDF REPORT IDENTITY</small>
            <h3>Registered company branding</h3>
            <p>The logo and official details below are printed on Accountant, Company Admin and Staff PDF reports.</p>
          </div>
          <label className={styles.reportLogoUpload}>
            <UploadCloud size={17} />
            {uploadingLogo ? "Uploading..." : "Upload company logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploadingLogo || busy}
              onChange={(event) => void uploadReportLogo(event.target.files?.[0] || null)}
            />
          </label>
        </div>
        <div className={styles.reportBrandingFields}>
          <Field label="Registration number"><input value={safeText(settings.registrationNumber)} onChange={(event) => setSettings({ ...settings, registrationNumber: event.target.value })} placeholder="e.g. BRELA registration no." /></Field>
          <Field label="TIN"><input value={safeText(settings.tin)} onChange={(event) => setSettings({ ...settings, tin: event.target.value })} placeholder="Company TIN" /></Field>
          <Field label="Website"><input value={safeText(settings.website)} onChange={(event) => setSettings({ ...settings, website: event.target.value })} placeholder="https://company.example" /></Field>
          <Field label="Logo URL"><input value={safeText(settings.reportLogoUrl)} onChange={(event) => setSettings({ ...settings, reportLogoUrl: event.target.value })} placeholder="/uploads/company-admin/..." /></Field>
        </div>
      </section>

      <section className={styles.thresholdGrid}>
        <Field label="Service proof deadline (minutes)"><input type="number" min="5" max="1440" value={Number(settings.proofGraceMinutes || 30)} onChange={(event) => setSettings({ ...settings, proofGraceMinutes: Number(event.target.value) })} /></Field>
        <Field label="Broker visit matching radius (metres)"><input type="number" min="20" max="5000" value={Number(settings.visitRadiusMeters || 200)} onChange={(event) => setSettings({ ...settings, visitRadiusMeters: Number(event.target.value) })} /></Field>
        <Field label="Minimum performance score"><input type="number" min="0" max="100" value={Number(settings.minimumPerformanceScore || 60)} onChange={(event) => setSettings({ ...settings, minimumPerformanceScore: Number(event.target.value) })} /></Field>
      </section>

      <section className={styles.settingsGrid}>
        {toggles.map(([key, title, description, Icon], index) => {
          const Component = Icon as IconType;
          const enabled = Boolean(settings[key]);
          return <article className={`${styles.settingCard} ${enabled ? styles.settingEnabled : ""}`} key={key} style={{ "--delay": `${index * 45}ms` } as any}><span><Component size={22} /></span><div><h3>{title}</h3><p>{description}</p></div><button type="button" className={enabled ? styles.toggleOn : ""} onClick={() => setSettings({ ...settings, [key]: !enabled })} aria-label={`Toggle ${title}`}><i /></button></article>;
        })}
      </section>
    </PageShell>
  );
}

function ProfileAvatar({ name, url, large = false }: { name: string; url?: string | null; large?: boolean }) {
  const initials = safeText(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  return (
    <span className={`${styles.profileAvatar} ${large ? styles.profileAvatarLarge : ""}`}>
      {url ? <img src={url} alt={name || "Profile"} /> : <b>{initials}</b>}
    </span>
  );
}

function DetailModal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={`${styles.modalCard} ${wide ? styles.modalWide : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.modalHeader}><div><small>Detailed database record</small><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className={styles.modalBody}>{children}</div>
      </section>
    </div>
  );
}

function DocumentPreviewModal({ document, onClose }: { document: any; onClose: () => void }) {
  const mime = safeText(document?.mimeType).toLowerCase();
  const url = safeText(document?.publicUrl || document?.url);
  const title = safeText(document?.originalName) || "Document preview";
  const status = safeText(document?.proofStatus) || "PENDING";
  const sizeKb = Math.max(1, Math.round(Number(document?.sizeBytes || 0) / 1024));
  const isImage = mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(url);
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(url);
  return (
    <DetailModal title={title} onClose={onClose} wide>
      <section className={styles.documentPreviewHero}>
        <div>
          <span><FileText size={24} /></span>
          <div>
            <small>Uploaded proof document</small>
            <strong>{title}</strong>
            <em>{mime || "Unknown file type"} - {sizeKb.toLocaleString()} KB</em>
          </div>
        </div>
        <StatusBadge status={status} />
      </section>
      <section className={styles.documentPreviewMeta}>
        <Detail label="Type" value={mime || "Unknown"} />
        <Detail label="Proof status" value={status} />
        <Detail label="Uploaded" value={formatDate(document?.createdAt, true)} />
        <Detail label="Size" value={`${sizeKb.toLocaleString()} KB`} />
      </section>
      <div className={styles.documentViewer}>
        {!url ? (
          <div className={styles.documentViewerEmpty}>
            <FileText size={36} />
            <strong>Original file link is missing</strong>
            <p>The database record is available, but this upload does not have a readable public URL yet.</p>
          </div>
        ) : isImage ? (
          <img src={url} alt={title} />
        ) : isPdf ? (
          <iframe src={url} title="PDF preview" />
        ) : (
          <iframe src={url} title="Document preview" />
        )}
      </div>
      {document?.extractedText && <section className={styles.extractedTextBox}><strong>Extracted proof text</strong><pre>{safeText(document.extractedText)}</pre></section>}
      <div className={styles.formActions}>
        {url ? <a className={styles.documentOpenLink} href={url} target="_blank" rel="noreferrer"><Eye size={16} /> Open original</a> : <button type="button" disabled><FileText size={16} /> Original unavailable</button>}
      </div>
    </DetailModal>
  );
}

function ApprovalDecisionView({ decision }: { decision?: any }) {
  if (!decision) return <div className={styles.approvalDecisionEmpty}><StatusBadge status="PENDING" /><small>No decision</small></div>;
  return <div className={styles.approvalDecisionView}><StatusBadge status={decision.decision} /><strong>{decision.reviewerName}</strong><p>{decision.reason}</p><small>{formatDate(decision.decidedAt, true)}</small></div>;
}

function createMultiMarkerMapHtml(markers: Array<{ latitude: number; longitude: number; label: string; type: string; detail?: string }>): string {
  const safeMarkers = markers.filter((marker) => Number.isFinite(Number(marker.latitude)) && Number.isFinite(Number(marker.longitude))).map((marker) => ({ latitude: Number(marker.latitude), longitude: Number(marker.longitude), label: safeText(marker.label), type: safeText(marker.type), detail: safeText(marker.detail) }));
  const payload = JSON.stringify(safeMarkers).replaceAll("<", "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;font-family:Arial,sans-serif}.label{background:#fff;border:0;border-radius:9px;padding:3px 7px;box-shadow:0 3px 12px #0003;font-weight:700}.staff{background:#0e9eaa}.broker{background:#f59e0b}.pin{width:20px;height:20px;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px #0005}.pin span{display:block;transform:rotate(45deg);font-size:0}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const rows=${payload};const map=L.map('map');L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);const bounds=[];rows.forEach(r=>{const klass=r.type==='BROKER'?'broker':'staff';const icon=L.divIcon({className:'',html:'<div class="pin '+klass+'"><span>.</span></div>',iconSize:[24,24],iconAnchor:[12,22]});const m=L.marker([r.latitude,r.longitude],{icon}).addTo(map).bindPopup('<b>'+escapeHtml(r.label)+'</b><br>'+escapeHtml(r.detail||r.type)).bindTooltip(r.label,{permanent:true,direction:'top',className:'label'});bounds.push([r.latitude,r.longitude]);});if(bounds.length===1){map.setView(bounds[0],15)}else if(bounds.length){map.fitBounds(bounds,{padding:[35,35]})}else{map.setView([-6.7924,39.2083],11)}function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}</script></body></html>`;
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
