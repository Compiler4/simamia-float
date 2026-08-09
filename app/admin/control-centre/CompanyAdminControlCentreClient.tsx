"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Landmark,
  LayoutDashboard,
  MapPin,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import styles from "./CompanyAdminControlCentre.module.css";

export type ControlCentreModule =
  | "overview"
  | "staff-areas"
  | "finance"
  | "verification"
  | "staff-operations";

type UserProps = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  companyId: string;
  profileImageUrl: string | null;
};

type Props = {
  initialModule: ControlCentreModule;
  dashboardHref: string;
  user: UserProps;
};

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

type WorkArea = {
  id: string;
  companyId: string;
  staffId: string;
  region: string;
  district: string;
  ward: string;
  street: string;
  areaLabel: string;
  notes?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  staff: StaffItem;
  assignedBy?: { id: string; name: string; email: string } | null;
};

type AreaDraft = {
  key: string;
  region: string;
  district: string;
  ward: string;
  street: string;
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
  activeAssignment?: {
    id: string;
    staffId: string;
    staffName: string;
    workAreaId?: string | null;
    assignedArea?: string | null;
    startedAt: string;
  } | null;
};

type CustomerItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  address?: string | null;
};

type CustomerAssignment = {
  id: string;
  staffId: string;
  customerId: string;
  status: string;
  startedAt: string;
  notes?: string | null;
  staff: StaffItem;
  customer: CustomerItem;
};

type LocationTreeItem = {
  region: string;
  districts: Array<{
    district: string;
    wards: string[];
  }>;
};

type BankAccount = {
  id: string;
  bankName: string;
  bankCode?: string | null;
  accountName: string;
  accountNumber: string;
  branchName?: string | null;
  swiftCode?: string | null;
  currency: string;
  status: string;
  notes?: string | null;
  createdAt: string;
};

type VerificationPacket = {
  id: string;
  title?: string | null;
  category?: string | null;
  targetType: string;
  targetId: string;
  assignedAccountantId?: string | null;
  sentByAdminName: string;
  message: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: string;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

type ControlData = {
  success: true;
  company: { id: string; name: string; code: string };
  summary: {
    staff: number;
    activeAreas: number;
    brokers: number;
    assignedBrokers: number;
    customers: number;
    bankAccounts: number;
    pendingVerification: number;
    importedStatements: number;
  };
  staff: StaffItem[];
  accountants: Array<{ id: string; name: string; email: string }>;
  locationTree: LocationTreeItem[];
  workAreas: WorkArea[];
  brokers: BrokerItem[];
  customers: CustomerItem[];
  customerAssignments: CustomerAssignment[];
  bankAccounts: BankAccount[];
  importedStatements: any[];
  bankVerifications: any[];
  verificationPackets: VerificationPacket[];
  staffOperations: {
    floatTransactions: any[];
    collections: any[];
    visits: any[];
  };
};

type ModuleItem = {
  key: ControlCentreModule;
  label: string;
  note: string;
  icon: typeof LayoutDashboard;
};

const MODULES: ModuleItem[] = [
  {
    key: "overview",
    label: "Control Overview",
    note: "Company operations summary",
    icon: LayoutDashboard,
  },
  {
    key: "staff-areas",
    label: "Staff Areas",
    note: "Regions, districts, wards and brokers",
    icon: MapPinned,
  },
  {
    key: "finance",
    label: "Finance & Banks",
    note: "Multiple banks and imported statements",
    icon: Landmark,
  },
  {
    key: "verification",
    label: "Accountant Verification",
    note: "Send documents and messages",
    icon: FileCheck2,
  },
  {
    key: "staff-operations",
    label: "Staff Operations",
    note: "Float, collections and visits",
    icon: BriefcaseBusiness,
  },
];

const BANKS = [
  "CRDB Bank",
  "NMB Bank",
  "Diamond Trust Bank (DTB)",
  "National Bank of Commerce (NBC)",
  "Absa Bank Tanzania",
  "Stanbic Bank Tanzania",
  "Exim Bank Tanzania",
  "KCB Bank Tanzania",
  "Equity Bank Tanzania",
  "Bank of Africa Tanzania",
  "I&M Bank Tanzania",
  "NCBA Bank Tanzania",
  "Access Bank Tanzania",
  "Amana Bank",
  "People's Bank of Zanzibar (PBZ)",
  "Tanzania Commercial Bank (TCB)",
  "Other",
];

const SIDEBAR_STORAGE_KEY = "simamia_unified_control_centre_sidebar";

function safeText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function normalize(value: unknown): string {
  return safeText(value)
    .toLocaleLowerCase("en")
    .replace(/[.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areaLabel(area: {
  region: string;
  district?: string;
  ward?: string;
  street?: string;
}): string {
  return [area.region, area.district, area.ward, area.street]
    .map(safeText)
    .filter(Boolean)
    .join(" / ");
}

function brokerMatchesArea(broker: BrokerItem, area: Partial<WorkArea>): boolean {
  const region = normalize(area.region);
  const district = normalize(area.district);
  const ward = normalize(area.ward);
  const street = normalize(area.street);

  const brokerRegionValues = [broker.region, broker.city, broker.location]
    .map(normalize)
    .filter(Boolean);
  const brokerDistrictValues = [broker.district, broker.location, broker.address]
    .map(normalize)
    .filter(Boolean);
  const brokerWardValues = [
    broker.ward,
    broker.location,
    broker.address,
    broker.attendedLocation,
  ]
    .map(normalize)
    .filter(Boolean);

  const contains = (values: string[], target: string) =>
    !target ||
    values.some(
      (value) => value === target || value.includes(target) || target.includes(value),
    );

  return (
    contains(brokerRegionValues, region) &&
    contains(brokerDistrictValues, district) &&
    contains(brokerWardValues, ward) &&
    contains(brokerWardValues, street)
  );
}

function formatDate(value: unknown, withTime = true): string {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

function money(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
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
      [result.message, result.details, result.error].filter(Boolean).join(" ") ||
        `Request failed (${response.status}).`,
    );
  }

  return result as T;
}

function StatusBadge({ status }: { status: unknown }) {
  const value = safeText(status).toUpperCase() || "UNKNOWN";
  const positive = ["ACTIVE", "VERIFIED", "APPROVED", "MATCHED", "COMPLETED"].includes(
    value,
  );
  const warning = ["PENDING", "ISSUED", "CONFIRMED", "REVIEW_REQUIRED"].includes(
    value,
  );

  return (
    <span
      className={`${styles.statusBadge} ${
        positive
          ? styles.statusPositive
          : warning
            ? styles.statusWarning
            : styles.statusNegative
      }`}
    >
      <i />
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Panel({
  title,
  text,
  icon,
  children,
  actions,
}: {
  title: string;
  text: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className={styles.panel}>
      <header className={styles.panelHeader}>
        <span>{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        {actions ? <div className={styles.panelActions}>{actions}</div> : null}
      </header>
      {children}
    </article>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <FileText size={27} />
      <p>{children}</p>
    </div>
  );
}

type TableFilter<T> = {
  value: string;
  label: string;
  matches: (row: T) => boolean;
};

function PaginatedDataTable<T>({
  rows,
  columns,
  renderRow,
  rowKey,
  searchFields,
  searchPlaceholder = "Search table data...",
  filters = [],
  filterLabel = "All records",
  emptyText,
  minWidth = 940,
  defaultPageSize = 10,
}: {
  rows: T[];
  columns: ReactNode;
  renderRow: (row: T) => ReactNode;
  rowKey: (row: T, index: number) => string;
  searchFields: (row: T) => unknown[];
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  filterLabel?: string;
  emptyText: string;
  minWidth?: number;
  defaultPageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalize(query);
    const selectedFilter = filters.find((item) => item.value === filter);

    return rows.filter((row) => {
      if (selectedFilter && !selectedFilter.matches(row)) return false;
      if (!normalizedQuery) return true;

      return searchFields(row)
        .map(normalize)
        .some((value) => value.includes(normalizedQuery));
    });
  }, [filter, filters, query, rows, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const firstVisible = filteredRows.length ? startIndex + 1 : 0;
  const lastVisible = Math.min(startIndex + pageSize, filteredRows.length);

  useEffect(() => {
    setPage(1);
  }, [query, filter, pageSize, rows.length]);

  return (
    <section className={styles.tableFrame}>
      <div className={styles.tableToolbar}>
        <div className={styles.tableSearch}>
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} title="Clear search">
              <X size={15} />
            </button>
          ) : null}
        </div>

        {filters.length ? (
          <label className={styles.tableSelect}>
            <span>Filter</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">{filterLabel}</option>
              {filters.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={styles.tableSelect}>
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {[5, 10, 25, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>

        <div className={styles.tableCount}>
          <strong>{filteredRows.length}</strong>
          <span>record{filteredRows.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.dataTable} style={{ minWidth }}>
          <thead><tr>{columns}</tr></thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={rowKey(row, startIndex + index)}>{renderRow(row)}</tr>
            ))}
            {!visibleRows.length ? (
              <tr>
                <td colSpan={100}>
                  <Empty>{emptyText}</Empty>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className={styles.tablePagination}>
        <span>Showing {firstVisible}–{lastVisible} of {filteredRows.length}</span>
        <div>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <strong>Page {currentPage} of {totalPages}</strong>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </section>
  );
}

export default function CompanyAdminControlCentreClient({
  initialModule,
  dashboardHref,
  user,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeModule, setActiveModule] =
    useState<ControlCentreModule>(initialModule);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<ControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [staffId, setStaffId] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedWards, setSelectedWards] = useState<Record<string, string[]>>({});
  const [customStreet, setCustomStreet] = useState("");
  const [areaNotes, setAreaNotes] = useState("");
  const [areaDrafts, setAreaDrafts] = useState<AreaDraft[]>([]);
  const [selectedWorkAreaIds, setSelectedWorkAreaIds] = useState<string[]>([]);
  const [selectedBrokerIds, setSelectedBrokerIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [bankForm, setBankForm] = useState({
    bankName: "CRDB Bank",
    customBankName: "",
    bankCode: "CRDB",
    accountName: "",
    accountNumber: "",
    branchName: "",
    swiftCode: "",
    currency: "TZS",
    notes: "",
  });

  const [verificationForm, setVerificationForm] = useState({
    title: "",
    category: "OTHER",
    targetType: "OTHER",
    targetId: "",
    accountantId: "",
    message: "",
    attachmentUrl: "",
    attachmentName: "",
  });
  const [verificationFile, setVerificationFile] = useState<File | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "collapsed") setCollapsed(true);
    void load();
  }, []);

  useEffect(() => {
    setActiveModule(initialModule);
  }, [initialModule]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function load(showLoader = true) {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const result = await requestJson<ControlData>(
        "/api/admin/unified-control-centre",
      );
      setData(result);
      setStaffId((current) =>
        result.staff.some((item) => item.id === current)
          ? current
          : result.staff[0]?.id || "",
      );
      setVerificationForm((current) => ({
        ...current,
        accountantId:
          current.accountantId || result.accountants[0]?.id || "",
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The unified control centre could not load.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function action<T = { success: true; message: string }>(
    payload: Record<string, unknown>,
  ): Promise<T | null> {
    setBusy(true);
    setToast("");

    try {
      const result = await requestJson<T & { message?: string }>(
        "/api/admin/unified-control-centre",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setToast(result.message || "Action completed successfully.");
      await load(false);
      return result;
    } catch (actionError) {
      setToast(
        actionError instanceof Error ? actionError.message : "The action failed.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  function changeModule(next: ControlCentreModule) {
    setActiveModule(next);
    setMobileOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("module", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSidebar() {
    if (window.innerWidth <= 980) {
      setMobileOpen((current) => !current);
      return;
    }

    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        next ? "collapsed" : "expanded",
      );
      return next;
    });
  }

  const activeItem = useMemo(
    () => MODULES.find((item) => item.key === activeModule) ?? MODULES[0],
    [activeModule],
  );

  const ActiveModuleIcon = activeItem.icon;

  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CA";

  const selectedStaff = useMemo(
    () => data?.staff.find((item) => item.id === staffId) ?? null,
    [data?.staff, staffId],
  );

  const selectedLocation = useMemo(
    () =>
      data?.locationTree.find(
        (item) => normalize(item.region) === normalize(selectedRegion),
      ) ?? null,
    [data?.locationTree, selectedRegion],
  );

  const staffAreas = useMemo(
    () =>
      safeArray<WorkArea>(data?.workAreas).filter(
        (area) => area.staffId === staffId && area.status === "ACTIVE",
      ),
    [data?.workAreas, staffId],
  );

  useEffect(() => {
    setSelectedWorkAreaIds(staffAreas.map((area) => area.id));
    setSelectedBrokerIds([]);
  }, [staffId, data?.workAreas]);

  const selectedAreas = useMemo(
    () =>
      staffAreas.filter((area) => selectedWorkAreaIds.includes(area.id)),
    [selectedWorkAreaIds, staffAreas],
  );

  const filteredBrokers = useMemo(() => {
    if (!selectedAreas.length) return [];

    return safeArray<BrokerItem>(data?.brokers).filter((broker) =>
      selectedAreas.some((area) => brokerMatchesArea(broker, area)),
    );
  }, [data?.brokers, selectedAreas]);

  const availableBrokers = useMemo(
    () =>
      filteredBrokers.filter(
        (broker) =>
          !broker.activeAssignment || broker.activeAssignment.staffId === staffId,
      ),
    [filteredBrokers, staffId],
  );

  const selectedStaffCustomers = useMemo(
    () =>
      safeArray<CustomerAssignment>(data?.customerAssignments).filter(
        (row) => row.staffId === staffId && row.status === "ACTIVE",
      ),
    [data?.customerAssignments, staffId],
  );

  function toggleString(
    value: string,
    list: string[],
    setter: (next: string[]) => void,
  ) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function toggleWard(district: string, ward: string) {
    setSelectedWards((current) => {
      const existing = current[district] ?? [];
      const next = existing.includes(ward)
        ? existing.filter((item) => item !== ward)
        : [...existing, ward];
      return { ...current, [district]: next };
    });
  }

  function addAreaDrafts() {
    if (!selectedRegion) {
      setToast("Choose a region first.");
      return;
    }

    const nextDrafts: AreaDraft[] = [];
    const districts = selectedDistricts.length ? selectedDistricts : [""];

    for (const district of districts) {
      const wards = selectedWards[district] ?? [];
      const wardValues = wards.length ? wards : [""];
      for (const ward of wardValues) {
        const storedDistrict = district === "All districts" ? "" : district;
        const draft: AreaDraft = {
          key: `${normalize(selectedRegion)}|${normalize(storedDistrict)}|${normalize(ward)}|${normalize(customStreet)}`,
          region: selectedRegion,
          district: storedDistrict,
          ward,
          street: customStreet.trim(),
        };
        nextDrafts.push(draft);
      }
    }

    setAreaDrafts((current) => {
      const map = new Map(current.map((item) => [item.key, item]));
      nextDrafts.forEach((item) => map.set(item.key, item));
      return Array.from(map.values());
    });
    setToast(`${nextDrafts.length} area selection(s) added to the assignment draft.`);
  }

  async function saveAreas(event: FormEvent) {
    event.preventDefault();
    if (!staffId) {
      setToast("Choose a STAFF user.");
      return;
    }
    if (!areaDrafts.length) {
      setToast("Add at least one region, district or ward to the draft.");
      return;
    }

    const result = await action<{ success: true; message: string; areaIds: string[] }>({
      action: "ASSIGN_AREAS",
      staffId,
      notes: areaNotes,
      areas: areaDrafts.map(({ region, district, ward, street }) => ({
        region,
        district,
        ward,
        street,
      })),
    });

    if (result) {
      setAreaDrafts([]);
      setSelectedDistricts([]);
      setSelectedWards({});
      setCustomStreet("");
      setAreaNotes("");
      setSelectedWorkAreaIds(result.areaIds);
    }
  }

  async function removeArea(area: WorkArea) {
    const release = window.confirm(
      `Remove “${area.areaLabel}” and release brokers assigned through this area?`,
    );
    if (!release) return;

    await action({
      action: "UNASSIGN_AREA",
      areaId: area.id,
      releaseBrokers: true,
    });
  }

  async function assignSelectedBrokers() {
    if (!staffId || !selectedWorkAreaIds.length) {
      setToast("Choose a staff user and at least one active work area.");
      return;
    }
    if (!selectedBrokerIds.length) {
      setToast("Select at least one available broker.");
      return;
    }

    const result = await action({
      action: "ASSIGN_BROKERS",
      staffId,
      workAreaIds: selectedWorkAreaIds,
      brokerIds: selectedBrokerIds,
      notes: areaNotes,
    });
    if (result) setSelectedBrokerIds([]);
  }

  async function assignAllAvailableBrokers() {
    if (!availableBrokers.length) {
      setToast("There are no available brokers in the selected areas.");
      return;
    }

    const result = await action({
      action: "ASSIGN_BROKERS",
      staffId,
      workAreaIds: selectedWorkAreaIds,
      brokerIds: availableBrokers.map((broker) => broker.id),
      notes: areaNotes,
    });
    if (result) setSelectedBrokerIds([]);
  }

  async function assignCustomer(event: FormEvent) {
    event.preventDefault();
    if (!staffId || !customerId) {
      setToast("Choose both a staff user and customer.");
      return;
    }
    const result = await action({
      action: "ASSIGN_CUSTOMER",
      staffId,
      customerId,
      notes: customerNotes,
    });
    if (result) {
      setCustomerId("");
      setCustomerNotes("");
    }
  }

  async function saveBank(event: FormEvent) {
    event.preventDefault();
    const bankName =
      bankForm.bankName === "Other"
        ? bankForm.customBankName.trim()
        : bankForm.bankName;
    if (!bankName || !bankForm.accountName || !bankForm.accountNumber) {
      setToast("Bank name, account name and account number are required.");
      return;
    }

    const result = await action({
      action: "CREATE_BANK_ACCOUNT",
      ...bankForm,
      bankName,
    });
    if (result) {
      setBankForm({
        bankName: "CRDB Bank",
        customBankName: "",
        bankCode: "CRDB",
        accountName: "",
        accountNumber: "",
        branchName: "",
        swiftCode: "",
        currency: "TZS",
        notes: "",
      });
    }
  }

  async function uploadVerificationFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setVerificationFile(file);
  }

  async function sendVerification(event: FormEvent) {
    event.preventDefault();
    if (!verificationForm.title.trim()) {
      setToast("Enter a document title.");
      return;
    }
    if (!verificationForm.message.trim() && !verificationFile) {
      setToast("Add a message or attach a document.");
      return;
    }

    setBusy(true);
    try {
      let attachmentUrl = verificationForm.attachmentUrl;
      let attachmentName = verificationForm.attachmentName;

      if (verificationFile) {
        const formData = new FormData();
        formData.append("file", verificationFile);
        const upload = await requestJson<{
          success: true;
          url: string;
          originalName: string;
        }>("/api/admin/unified-control-centre/upload", {
          method: "POST",
          body: formData,
        });
        attachmentUrl = upload.url;
        attachmentName = upload.originalName;
      }

      const result = await requestJson<{ success: true; message: string }>(
        "/api/admin/unified-control-centre",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CREATE_VERIFICATION_PACKET",
            ...verificationForm,
            attachmentUrl,
            attachmentName,
          }),
        },
      );
      setToast(result.message);
      setVerificationForm((current) => ({
        ...current,
        title: "",
        category: "OTHER",
        targetType: "OTHER",
        targetId: "",
        message: "",
        attachmentUrl: "",
        attachmentName: "",
      }));
      setVerificationFile(null);
      await load(false);
    } catch (sendError) {
      setToast(sendError instanceof Error ? sendError.message : "Document sending failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <main className={styles.statePage}>
        <RefreshCw className={styles.spin} size={34} />
        <h1>Loading unified control centre</h1>
        <p>Preparing staff areas, finance, verification and operations.</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={styles.statePage}>
        <ShieldCheck size={38} />
        <h1>Control centre could not load</h1>
        <p>{error || "No control-centre data was returned."}</p>
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={18} /> Try again
        </button>
      </main>
    );
  }

  return (
    <main className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <button
        type="button"
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropOpen : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
      />

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ""}`}
      >
        <div className={styles.brand}>
          <span>
            <ShieldCheck size={25} />
          </span>
          <div>
            <strong>Simamia Float</strong>
            <small>Unified Company Control</small>
          </div>
          <button
            type="button"
            className={styles.mobileClose}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          className={styles.collapseButton}
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <nav className={styles.navigation} aria-label="Control centre modules">
          <small>Integrated Modules</small>
          {MODULES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={activeModule === item.key ? styles.activeNav : ""}
                onClick={() => changeModule(item.key)}
                title={`${item.label} — ${item.note}`}
              >
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </div>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <span>{initials}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.mobileMenu}
            onClick={toggleSidebar}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className={styles.moduleHeading}>
            <span>
              <ActiveModuleIcon size={20} />
            </span>
            <div>
              <small>{data.company.name}</small>
              <strong>{activeItem.label}</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <button type="button" onClick={() => void load(false)} title="Refresh">
              <RefreshCw size={17} />
            </button>
            <Link href={dashboardHref}>
              <ArrowLeft size={17} /> Dashboard
            </Link>
            <div className={styles.userBadge}>
              {user.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImageUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
              <div>
                <strong>{user.name}</strong>
                <small>{user.roleLabel}</small>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.pageBody}>
          {activeModule === "overview" ? (
            <>
              <section className={styles.hero}>
                <div>
                  <small>COMPANY ADMIN UNIFIED WORKSPACE</small>
                  <h1>One page for staff areas, finance, verification and operations.</h1>
                  <p>
                    Assign more than one location to each staff officer, connect matching
                    brokers, manage many bank accounts and send documents directly to the
                    accountant.
                  </p>
                  <div className={styles.heroActions}>
                    <button type="button" onClick={() => changeModule("staff-areas")}>
                      <MapPinned size={18} /> Assign staff areas
                    </button>
                    <button type="button" onClick={() => changeModule("verification")}>
                      <Send size={18} /> Send verification file
                    </button>
                  </div>
                </div>
                <span>
                  <LayoutDashboard size={54} />
                </span>
              </section>

              <section className={styles.metricGrid}>
                <Metric icon={<Users />} label="Active staff" value={data.summary.staff} tone="green" />
                <Metric icon={<MapPin />} label="Work areas" value={data.summary.activeAreas} tone="purple" />
                <Metric icon={<UserCheck />} label="Assigned brokers" value={data.summary.assignedBrokers} tone="blue" />
                <Metric icon={<Landmark />} label="Bank accounts" value={data.summary.bankAccounts} tone="gold" />
                <Metric icon={<FileCheck2 />} label="Pending verification" value={data.summary.pendingVerification} tone="red" />
                <Metric icon={<FileText />} label="Imported statements" value={data.summary.importedStatements} tone="teal" />
              </section>

              <section className={styles.overviewGrid}>
                <Panel
                  title="Staff area coverage"
                  text="Every active area grouped by staff officer."
                  icon={<MapPinned size={21} />}
                >
                  <div className={styles.compactRows}>
                    {data.staff.map((staff) => {
                      const areas = data.workAreas.filter(
                        (area) => area.staffId === staff.id && area.status === "ACTIVE",
                      );
                      return (
                        <button
                          type="button"
                          key={staff.id}
                          onClick={() => {
                            setStaffId(staff.id);
                            changeModule("staff-areas");
                          }}
                        >
                          <span>{staff.name.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <strong>{staff.name}</strong>
                            <small>{areas.map((area) => area.areaLabel).join(", ") || "No area assigned"}</small>
                          </div>
                          <b>{areas.length}</b>
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title="Verification queue"
                  text="Newest files and messages sent to accountants."
                  icon={<FileCheck2 size={21} />}
                >
                  <div className={styles.compactRows}>
                    {data.verificationPackets.slice(0, 8).map((packet) => (
                      <button
                        type="button"
                        key={packet.id}
                        onClick={() => changeModule("verification")}
                      >
                        <span><FileText size={17} /></span>
                        <div>
                          <strong>{packet.title || packet.targetType}</strong>
                          <small>{packet.message}</small>
                        </div>
                        <StatusBadge status={packet.status} />
                      </button>
                    ))}
                    {!data.verificationPackets.length ? <Empty>No verification packets have been sent.</Empty> : null}
                  </div>
                </Panel>
              </section>
            </>
          ) : null}

          {activeModule === "staff-areas" ? (
            <>
              <section className={styles.metricGrid}>
                <Metric icon={<Users />} label="Staff" value={data.summary.staff} tone="green" />
                <Metric icon={<MapPinned />} label="Active areas" value={data.summary.activeAreas} tone="purple" />
                <Metric icon={<UserCheck />} label="All brokers" value={data.summary.brokers} tone="blue" />
                <Metric icon={<CheckCircle2 />} label="Assigned brokers" value={data.summary.assignedBrokers} tone="gold" />
              </section>

              <div className={styles.twoColumn}>
                <Panel
                  title="Assign multiple staff areas"
                  text="Select a region, then tick one or more districts and wards/streets. Add more regions before saving."
                  icon={<MapPinned size={21} />}
                >
                  <form className={styles.form} onSubmit={saveAreas}>
                    <label>
                      <span>Staff officer</span>
                      <select value={staffId} onChange={(event) => setStaffId(event.target.value)} required>
                        <option value="">Choose STAFF user</option>
                        {data.staff.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} — {staff.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Region</span>
                      <select
                        value={selectedRegion}
                        onChange={(event) => {
                          setSelectedRegion(event.target.value);
                          setSelectedDistricts([]);
                          setSelectedWards({});
                        }}
                      >
                        <option value="">Choose region</option>
                        {data.locationTree.map((item) => (
                          <option key={item.region} value={item.region}>{item.region}</option>
                        ))}
                      </select>
                    </label>

                    {selectedLocation ? (
                      <div className={styles.locationSelector}>
                        <header>
                          <Building2 size={18} />
                          <div>
                            <strong>Districts in {selectedLocation.region}</strong>
                            <small>Tick one or more districts.</small>
                          </div>
                        </header>
                        <div className={styles.checkboxGrid}>
                          {selectedLocation.districts.map((item) => (
                            <label key={item.district} className={styles.checkboxCard}>
                              <input
                                type="checkbox"
                                checked={selectedDistricts.includes(item.district)}
                                onChange={() =>
                                  toggleString(item.district, selectedDistricts, setSelectedDistricts)
                                }
                              />
                              <span><Check size={13} /></span>
                              <div>
                                <strong>{item.district}</strong>
                                <small>{item.wards.length} ward/street record(s)</small>
                              </div>
                            </label>
                          ))}
                        </div>

                        {selectedDistricts.map((district) => {
                          const districtItem = selectedLocation.districts.find(
                            (item) => item.district === district,
                          );
                          return (
                            <section key={district} className={styles.wardSection}>
                              <h3>Wards / streets in {district}</h3>
                              <div className={styles.checkboxGrid}>
                                {safeArray<string>(districtItem?.wards).map((ward) => (
                                  <label key={ward} className={styles.checkboxCard}>
                                    <input
                                      type="checkbox"
                                      checked={(selectedWards[district] ?? []).includes(ward)}
                                      onChange={() => toggleWard(district, ward)}
                                    />
                                    <span><Check size={13} /></span>
                                    <div><strong>{ward}</strong></div>
                                  </label>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : null}

                    <label>
                      <span>Additional street / local area</span>
                      <input
                        value={customStreet}
                        onChange={(event) => setCustomStreet(event.target.value)}
                        placeholder="Optional street, village or service zone"
                      />
                    </label>

                    <label>
                      <span>Assignment notes</span>
                      <textarea
                        value={areaNotes}
                        onChange={(event) => setAreaNotes(event.target.value)}
                        placeholder="Operational instructions for this staff officer"
                      />
                    </label>

                    <button type="button" className={styles.secondaryButton} onClick={addAreaDrafts}>
                      <MapPin size={17} /> Add selected areas to draft
                    </button>

                    <div className={styles.draftList}>
                      {areaDrafts.map((draft) => (
                        <div key={draft.key}>
                          <span><MapPin size={15} /></span>
                          <strong>{areaLabel(draft)}</strong>
                          <button
                            type="button"
                            onClick={() => setAreaDrafts((current) => current.filter((item) => item.key !== draft.key))}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                      {!areaDrafts.length ? <small>No new areas in the draft.</small> : null}
                    </div>

                    <button disabled={busy || !areaDrafts.length}>
                      <CheckCircle2 size={17} /> Save all drafted areas
                    </button>
                  </form>
                </Panel>

                <Panel
                  title="Active areas for selected staff"
                  text="Tick the areas that should be used when filtering and assigning brokers."
                  icon={<MapPin size={21} />}
                >
                  {selectedStaff ? (
                    <div className={styles.selectedStaffCard}>
                      <span>{selectedStaff.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{selectedStaff.name}</strong>
                        <small>{selectedStaff.email}</small>
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.areaCards}>
                    {staffAreas.map((area) => (
                      <article key={area.id} className={styles.areaCard}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedWorkAreaIds.includes(area.id)}
                            onChange={() =>
                              toggleString(area.id, selectedWorkAreaIds, setSelectedWorkAreaIds)
                            }
                          />
                          <span><Check size={13} /></span>
                        </label>
                        <div>
                          <strong>{area.areaLabel}</strong>
                          <small>Assigned {formatDate(area.startedAt)}</small>
                        </div>
                        <button type="button" onClick={() => void removeArea(area)} disabled={busy}>
                          <Trash2 size={16} />
                        </button>
                      </article>
                    ))}
                    {!staffAreas.length ? <Empty>This staff officer has no active areas.</Empty> : null}
                  </div>
                </Panel>
              </div>

              <Panel
                title="Brokers available in selected areas"
                text="Only brokers whose region, district, ward, location or address matches the selected staff areas are displayed."
                icon={<UserCheck size={21} />}
                actions={
                  <div className={styles.inlineActions}>
                    <button type="button" onClick={() => void assignAllAvailableBrokers()} disabled={busy || !availableBrokers.length}>
                      Assign all available
                    </button>
                    <button type="button" onClick={() => void assignSelectedBrokers()} disabled={busy || !selectedBrokerIds.length}>
                      Assign selected ({selectedBrokerIds.length})
                    </button>
                  </div>
                }
              >
                <PaginatedDataTable<any>
                  rows={filteredBrokers}
                  rowKey={(broker) => broker.id}
                  searchPlaceholder="Search broker name, phone, code or location"
                  searchFields={(broker) => [
                    broker.code,
                    broker.name,
                    broker.businessName,
                    broker.phone,
                    broker.email,
                    broker.region,
                    broker.district,
                    broker.ward,
                    broker.location,
                    broker.activeAssignment?.staffName,
                  ]}
                  filters={[
                    { value: "AVAILABLE", label: "Available brokers", matches: (broker) => !broker.activeAssignment },
                    { value: "CURRENT", label: "Assigned to selected staff", matches: (broker) => broker.activeAssignment?.staffId === staffId },
                    { value: "OTHER", label: "Assigned to other staff", matches: (broker) => Boolean(broker.activeAssignment && broker.activeAssignment.staffId !== staffId) },
                  ]}
                  filterLabel="All assignment states"
                  minWidth={1020}
                  emptyText="Select one or more active areas, or change the table search and filter."
                  columns={<>
                    <th>Select</th>
                    <th>Broker</th>
                    <th>Region</th>
                    <th>District</th>
                    <th>Ward / location</th>
                    <th>Current owner</th>
                    <th>Action</th>
                  </>}
                  renderRow={(broker) => {
                    const unavailable =
                      broker.activeAssignment && broker.activeAssignment.staffId !== staffId;

                    return <>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedBrokerIds.includes(broker.id)}
                          disabled={Boolean(unavailable)}
                          onChange={() =>
                            toggleString(broker.id, selectedBrokerIds, setSelectedBrokerIds)
                          }
                        />
                      </td>
                      <td>
                        <strong>{broker.name}</strong>
                        <small>{broker.code} · {broker.phone}</small>
                      </td>
                      <td>{broker.region || broker.city || "—"}</td>
                      <td>{broker.district || "—"}</td>
                      <td>{broker.ward || broker.location || broker.address || "—"}</td>
                      <td>
                        {broker.activeAssignment ? (
                          <span>{broker.activeAssignment.staffName}</span>
                        ) : (
                          <StatusBadge status="AVAILABLE" />
                        )}
                      </td>
                      <td>
                        {broker.activeAssignment?.staffId === staffId ? (
                          <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={busy}
                            onClick={() =>
                              void action({
                                action: "UNASSIGN_BROKER",
                                assignmentId: broker.activeAssignment?.id,
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : unavailable ? (
                          <small>Assigned to another staff</small>
                        ) : (
                          <small>Available</small>
                        )}
                      </td>
                    </>;
                  }}
                />
              </Panel>

              <div className={styles.twoColumn}>
                <Panel
                  title="Assign customer"
                  text="Keep customer ownership together with staff area assignments."
                  icon={<Users size={21} />}
                >
                  <form className={styles.form} onSubmit={assignCustomer}>
                    <label>
                      <span>Customer</span>
                      <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                        <option value="">Choose customer</option>
                        {data.customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} — {customer.region || customer.address || "No location"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Notes</span>
                      <textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} />
                    </label>
                    <button disabled={busy || !staffId || !customerId}>
                      <UserCheck size={17} /> Assign customer
                    </button>
                  </form>
                </Panel>

                <Panel
                  title="Customers assigned to selected staff"
                  text="Active customer assignments only."
                  icon={<CheckCircle2 size={21} />}
                >
                  <PaginatedDataTable<any>
                    rows={selectedStaffCustomers}
                    rowKey={(row) => row.id}
                    searchPlaceholder="Search assigned customer, phone, email or region"
                    searchFields={(row) => [
                      row.customer.name,
                      row.customer.phone,
                      row.customer.email,
                      row.customer.region,
                      row.customer.address,
                      row.notes,
                    ]}
                    minWidth={720}
                    defaultPageSize={5}
                    emptyText="No customers are assigned to this staff officer."
                    columns={<>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Region / address</th>
                      <th>Assigned</th>
                      <th>Action</th>
                    </>}
                    renderRow={(row) => <>
                      <td><strong>{row.customer.name}</strong><small>{row.customer.id}</small></td>
                      <td>{row.customer.phone || "—"}<small>{row.customer.email || "No email"}</small></td>
                      <td>{row.customer.region || row.customer.address || "—"}</td>
                      <td>{formatDate(row.startedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={busy}
                          onClick={() => void action({ action: "UNASSIGN_CUSTOMER", assignmentId: row.id })}
                        >
                          Remove
                        </button>
                      </td>
                    </>}
                  />
                </Panel>
              </div>
            </>
          ) : null}

          {activeModule === "finance" ? (
            <>
              <section className={styles.metricGrid}>
                <Metric icon={<Landmark />} label="Configured banks" value={data.bankAccounts.length} tone="green" />
                <Metric icon={<FileText />} label="Imported statements" value={data.importedStatements.length} tone="blue" />
                <Metric icon={<FileCheck2 />} label="Bank proofs" value={data.bankVerifications.length} tone="purple" />
                <Metric
                  icon={<CircleDollarSign />}
                  label="Statement balance"
                  value={money(data.importedStatements.reduce((sum, item) => sum + Number(item.availableBalance || 0), 0))}
                  tone="gold"
                />
              </section>

              <div className={styles.twoColumn}>
                <Panel
                  title="Add company bank account"
                  text="Register CRDB, NMB, DTB, NBC and any other bank. More than one account is allowed."
                  icon={<Banknote size={21} />}
                >
                  <form className={styles.form} onSubmit={saveBank}>
                    <div className={styles.formGrid}>
                      <label>
                        <span>Bank</span>
                        <select
                          value={bankForm.bankName}
                          onChange={(event) => setBankForm({ ...bankForm, bankName: event.target.value })}
                        >
                          {BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                        </select>
                      </label>
                      {bankForm.bankName === "Other" ? (
                        <label>
                          <span>Other bank name</span>
                          <input
                            value={bankForm.customBankName}
                            onChange={(event) => setBankForm({ ...bankForm, customBankName: event.target.value })}
                            required
                          />
                        </label>
                      ) : null}
                      <label>
                        <span>Bank code</span>
                        <input value={bankForm.bankCode} onChange={(event) => setBankForm({ ...bankForm, bankCode: event.target.value })} />
                      </label>
                      <label>
                        <span>Account name</span>
                        <input value={bankForm.accountName} onChange={(event) => setBankForm({ ...bankForm, accountName: event.target.value })} required />
                      </label>
                      <label>
                        <span>Account number</span>
                        <input value={bankForm.accountNumber} onChange={(event) => setBankForm({ ...bankForm, accountNumber: event.target.value })} required />
                      </label>
                      <label>
                        <span>Branch</span>
                        <input value={bankForm.branchName} onChange={(event) => setBankForm({ ...bankForm, branchName: event.target.value })} />
                      </label>
                      <label>
                        <span>SWIFT / BIC</span>
                        <input value={bankForm.swiftCode} onChange={(event) => setBankForm({ ...bankForm, swiftCode: event.target.value })} />
                      </label>
                      <label>
                        <span>Currency</span>
                        <select value={bankForm.currency} onChange={(event) => setBankForm({ ...bankForm, currency: event.target.value })}>
                          <option value="TZS">TZS</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      <span>Notes</span>
                      <textarea value={bankForm.notes} onChange={(event) => setBankForm({ ...bankForm, notes: event.target.value })} />
                    </label>
                    <button disabled={busy}><Landmark size={17} /> Save bank account</button>
                  </form>
                </Panel>

                <Panel
                  title="Configured company banks"
                  text="All accounts are kept separately and may be activated or suspended."
                  icon={<WalletCards size={21} />}
                >
                    <PaginatedDataTable<any>
                    rows={data.bankAccounts}
                    rowKey={(account) => account.id}
                    searchPlaceholder="Search bank, account number, branch or SWIFT code"
                    searchFields={(account) => [
                      account.bankName,
                      account.bankCode,
                      account.accountName,
                      account.accountNumber,
                      account.branchName,
                      account.swiftCode,
                      account.currency,
                      account.status,
                    ]}
                    filters={[
                      { value: "ACTIVE", label: "Active accounts", matches: (account) => account.status === "ACTIVE" },
                      { value: "INACTIVE", label: "Inactive accounts", matches: (account) => account.status !== "ACTIVE" },
                    ]}
                    filterLabel="All account statuses"
                    minWidth={820}
                    defaultPageSize={5}
                    emptyText="No company bank account is configured."
                    columns={<>
                      <th>Bank</th>
                      <th>Account name</th>
                      <th>Account number</th>
                      <th>Branch / SWIFT</th>
                      <th>Currency</th>
                      <th>Status</th>
                      <th>Action</th>
                    </>}
                    renderRow={(account) => <>
                      <td><strong>{account.bankName}</strong><small>{account.bankCode || "—"}</small></td>
                      <td>{account.accountName}</td>
                      <td><strong>{account.accountNumber}</strong></td>
                      <td>{account.branchName || "—"}<small>{account.swiftCode || "No SWIFT code"}</small></td>
                      <td>{account.currency}</td>
                      <td><StatusBadge status={account.status} /></td>
                      <td>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void action({
                              action: "SET_BANK_STATUS",
                              bankAccountId: account.id,
                              status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                        >
                          {account.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                      </td>
                    </>}
                  />
                </Panel>
              </div>

              <Panel
                title="Imported bank statements"
                text="Statements from CRDB, NMB, DTB, NBC and other banks remain separate for reconciliation."
                icon={<FileText size={21} />}
              >
                    <PaginatedDataTable<any>
                  rows={data.importedStatements}
                  rowKey={(statement) => statement.id}
                  searchPlaceholder="Search bank statement, account, source file or period"
                  searchFields={(statement) => [
                    statement.bankName,
                    statement.branchName,
                    statement.sourceFileName,
                    statement.accountName,
                    statement.accountNumber,
                    statement.periodStart,
                    statement.periodEnd,
                    statement.availableBalance,
                  ]}
                  filters={Array.from(new Set(data.importedStatements.map((statement) => safeText(statement.bankName)).filter(Boolean))).map((bankName) => ({
                    value: bankName,
                    label: bankName,
                    matches: (statement) => safeText(statement.bankName) === bankName,
                  }))}
                  filterLabel="All banks"
                  minWidth={980}
                  emptyText="No imported bank statements were found."
                  columns={<>
                    <th>Bank</th><th>Account</th><th>Period</th><th>Credit</th><th>Debit</th><th>Available balance</th><th>Imported</th>
                  </>}
                  renderRow={(statement) => <>
                    <td><strong>{statement.bankName}</strong><small>{statement.branchName || statement.sourceFileName}</small></td>
                    <td>{statement.accountName}<small>{statement.accountNumber}</small></td>
                    <td>{formatDate(statement.periodStart, false)} – {formatDate(statement.periodEnd, false)}</td>
                    <td>{money(statement.totalCredit)}</td>
                    <td>{money(statement.totalDebit)}</td>
                    <td><strong>{money(statement.availableBalance)}</strong></td>
                    <td>{formatDate(statement.importedAt)}</td>
                  </>}
                />
              </Panel>
            </>
          ) : null}

          {activeModule === "verification" ? (
            <>
              <div className={styles.twoColumn}>
                <Panel
                  title="Send document or message to Accountant"
                  text="Upload any supporting file and send it with a clear verification request."
                  icon={<Send size={21} />}
                >
                  <form className={styles.form} onSubmit={sendVerification}>
                    <label>
                      <span>Title</span>
                      <input
                        value={verificationForm.title}
                        onChange={(event) => setVerificationForm({ ...verificationForm, title: event.target.value })}
                        placeholder="Example: Verify supplier agreement"
                        required
                      />
                    </label>
                    <div className={styles.formGrid}>
                      <label>
                        <span>Document category</span>
                        <select
                          value={verificationForm.category}
                          onChange={(event) => setVerificationForm({ ...verificationForm, category: event.target.value })}
                        >
                          <option value="OTHER">Other document</option>
                          <option value="BANK">Bank document</option>
                          <option value="EXPENSE">Expense document</option>
                          <option value="CONTRACT">Contract / agreement</option>
                          <option value="INVOICE">Invoice</option>
                          <option value="REPORT">Report</option>
                          <option value="STAFF_PROOF">Staff proof</option>
                        </select>
                      </label>
                      <label>
                        <span>Verification target</span>
                        <select
                          value={verificationForm.targetType}
                          onChange={(event) => setVerificationForm({ ...verificationForm, targetType: event.target.value })}
                        >
                          <option value="OTHER">Other</option>
                          <option value="STAFF_PROOF">Staff proof</option>
                          <option value="BANK_DEPOSIT">Bank deposit</option>
                          <option value="EXPENSE">Expense</option>
                        </select>
                      </label>
                      <label>
                        <span>Record/reference ID</span>
                        <input
                          value={verificationForm.targetId}
                          onChange={(event) => setVerificationForm({ ...verificationForm, targetId: event.target.value })}
                          placeholder="Optional; generated automatically"
                        />
                      </label>
                      <label>
                        <span>Send to Accountant</span>
                        <select
                          value={verificationForm.accountantId}
                          onChange={(event) => setVerificationForm({ ...verificationForm, accountantId: event.target.value })}
                        >
                          <option value="">All company accountants</option>
                          {data.accountants.map((accountant) => (
                            <option key={accountant.id} value={accountant.id}>{accountant.name} — {accountant.email}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      <span>Message to Accountant</span>
                      <textarea
                        value={verificationForm.message}
                        onChange={(event) => setVerificationForm({ ...verificationForm, message: event.target.value })}
                        placeholder="Explain what must be checked and the expected decision."
                      />
                    </label>
                    <label className={styles.uploadBox}>
                      <UploadCloud size={28} />
                      <strong>{verificationFile ? verificationFile.name : "Choose document or image"}</strong>
                      <small>PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX, CSV or TXT · maximum 15 MB</small>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        onChange={uploadVerificationFile}
                      />
                    </label>
                    <button disabled={busy}><Send size={17} /> Upload and send to Accountant</button>
                  </form>
                </Panel>

                <Panel
                  title="Verification status summary"
                  text="Track accountant decisions and review comments."
                  icon={<FileCheck2 size={21} />}
                >
                  <section className={styles.verificationSummary}>
                    <div><span>Pending</span><strong>{data.verificationPackets.filter((item) => item.status === "PENDING").length}</strong></div>
                    <div><span>Verified</span><strong>{data.verificationPackets.filter((item) => item.status === "VERIFIED").length}</strong></div>
                    <div><span>Rejected</span><strong>{data.verificationPackets.filter((item) => item.status === "REJECTED").length}</strong></div>
                  </section>
                  <div className={styles.infoCard}>
                    <ShieldCheck size={21} />
                    <div>
                      <strong>Accountant access is company-scoped</strong>
                      <p>Only accountants from this company can open and review these packets.</p>
                    </div>
                  </div>
                </Panel>
              </div>

              <Panel
                title="Documents sent for verification"
                text="Messages, attachments, assigned accountant and final decision."
                icon={<FileText size={21} />}
              >
                <PaginatedDataTable<any>
                  rows={data.verificationPackets}
                  rowKey={(packet) => packet.id}
                  searchPlaceholder="Search document, message, reference, attachment or review"
                  searchFields={(packet) => [
                    packet.title,
                    packet.targetId,
                    packet.category,
                    packet.targetType,
                    packet.message,
                    packet.attachmentName,
                    packet.status,
                    packet.reviewReason,
                    packet.sentByAdminName,
                  ]}
                  filters={[
                    { value: "PENDING", label: "Pending", matches: (packet) => packet.status === "PENDING" },
                    { value: "VERIFIED", label: "Verified", matches: (packet) => packet.status === "VERIFIED" },
                    { value: "REJECTED", label: "Rejected", matches: (packet) => packet.status === "REJECTED" },
                  ]}
                  filterLabel="All verification statuses"
                  minWidth={1100}
                  emptyText="No documents match the selected search or filter."
                  columns={<>
                    <th>Document</th><th>Type</th><th>Message</th><th>Attachment</th><th>Status</th><th>Review</th><th>Sent</th>
                  </>}
                  renderRow={(packet) => <>
                    <td><strong>{packet.title || packet.targetId}</strong><small>{packet.targetId}</small></td>
                    <td>{packet.category || packet.targetType}</td>
                    <td>{packet.message}</td>
                    <td>
                      {packet.attachmentUrl ? (
                        <a href={packet.attachmentUrl} target="_blank" rel="noreferrer">{packet.attachmentName || "Open file"}</a>
                      ) : "Message only"}
                    </td>
                    <td><StatusBadge status={packet.status} /></td>
                    <td>{packet.reviewReason || "—"}<small>{packet.reviewedAt ? formatDate(packet.reviewedAt) : ""}</small></td>
                    <td>{formatDate(packet.createdAt)}</td>
                  </>}
                />
              </Panel>
            </>
          ) : null}

          {activeModule === "staff-operations" ? (
            <>
              <section className={styles.metricGrid}>
                <Metric icon={<CircleDollarSign />} label="Float transactions" value={data.staffOperations.floatTransactions.length} tone="green" />
                <Metric icon={<WalletCards />} label="Collections" value={data.staffOperations.collections.length} tone="blue" />
                <Metric icon={<MapPinned />} label="Broker visits" value={data.staffOperations.visits.length} tone="purple" />
                <Metric
                  icon={<Banknote />}
                  label="Float value"
                  value={money(data.staffOperations.floatTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                  tone="gold"
                />
              </section>

              <Panel
                title="Recent staff float operations"
                text="Accountant-to-staff and staff-to-broker transactions."
                icon={<CircleDollarSign size={21} />}
              >
                <PaginatedDataTable<any>
                  rows={data.staffOperations.floatTransactions}
                  rowKey={(row) => row.id}
                  searchPlaceholder="Search reference, staff, broker, type, amount or status"
                  searchFields={(row) => [
                    row.referenceNo,
                    row.fromUser?.name,
                    row.toUser?.name,
                    row.brokerCustomer?.name,
                    row.transactionType,
                    row.amount,
                    row.status,
                    row.createdAt,
                  ]}
                  filters={Array.from(new Set(data.staffOperations.floatTransactions.map((row) => safeText(row.status)).filter(Boolean))).map((status) => ({
                    value: status,
                    label: status.replaceAll("_", " "),
                    matches: (row) => safeText(row.status) === status,
                  }))}
                  filterLabel="All transaction statuses"
                  minWidth={1080}
                  emptyText="No float transactions match the selected search or filter."
                  columns={<>
                    <th>Reference</th><th>From</th><th>To</th><th>Broker</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th>
                  </>}
                  renderRow={(row) => <>
                    <td><strong>{row.referenceNo}</strong></td>
                    <td>{row.fromUser?.name || "System"}</td>
                    <td>{row.toUser?.name || "—"}</td>
                    <td>{row.brokerCustomer?.name || "—"}</td>
                    <td>{safeText(row.transactionType).replaceAll("_", " ")}</td>
                    <td>{money(row.amount)}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>{formatDate(row.createdAt)}</td>
                  </>}
                />
              </Panel>

              <div className={styles.twoColumn}>
                <Panel
                  title="Recent collections"
                  text="Money collected by staff from brokers."
                  icon={<WalletCards size={21} />}
                >
                  <PaginatedDataTable<any>
                    rows={data.staffOperations.collections}
                    rowKey={(row) => row.id}
                    searchPlaceholder="Search staff collection, broker, reference or amount"
                    searchFields={(row) => [
                      row.staff?.name,
                      row.brokerCustomer?.name,
                      row.referenceNo,
                      row.amount,
                      row.status,
                      row.createdAt,
                    ]}
                    filters={Array.from(new Set(data.staffOperations.collections.map((row) => safeText(row.status)).filter(Boolean))).map((status) => ({
                      value: status,
                      label: status.replaceAll("_", " "),
                      matches: (row) => safeText(row.status) === status,
                    }))}
                    filterLabel="All collection statuses"
                    minWidth={760}
                    defaultPageSize={5}
                    emptyText="No staff collections match the selected search or filter."
                    columns={<>
                      <th>Staff</th><th>Broker</th><th>Reference</th><th>Amount</th><th>Status</th><th>Date</th>
                    </>}
                    renderRow={(row) => <>
                      <td><strong>{row.staff?.name || "Staff"}</strong></td>
                      <td>{row.brokerCustomer?.name || "—"}</td>
                      <td>{row.referenceNo || "—"}</td>
                      <td><strong>{money(row.amount)}</strong></td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>{formatDate(row.createdAt)}</td>
                    </>}
                  />
                </Panel>

                <Panel
                  title="Recent broker visits"
                  text="Staff movement and service activity."
                  icon={<MapPinned size={21} />}
                >
                  <PaginatedDataTable<any>
                    rows={data.staffOperations.visits}
                    rowKey={(row) => row.id}
                    searchPlaceholder="Search staff, broker, service type, status or date"
                    searchFields={(row) => [
                      row.staff?.name,
                      row.broker?.name,
                      row.serviceType,
                      row.status,
                      row.startedAt,
                      row.completedAt,
                    ]}
                    filters={Array.from(new Set(data.staffOperations.visits.map((row) => safeText(row.status)).filter(Boolean))).map((status) => ({
                      value: status,
                      label: status.replaceAll("_", " "),
                      matches: (row) => safeText(row.status) === status,
                    }))}
                    filterLabel="All visit statuses"
                    minWidth={760}
                    defaultPageSize={5}
                    emptyText="No broker visits match the selected search or filter."
                    columns={<>
                      <th>Staff</th><th>Broker</th><th>Service</th><th>Status</th><th>Started</th><th>Completed</th>
                    </>}
                    renderRow={(row) => <>
                      <td><strong>{row.staff?.name || "Staff"}</strong></td>
                      <td>{row.broker?.name || "Broker"}</td>
                      <td>{row.serviceType || "—"}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>{formatDate(row.startedAt)}</td>
                      <td>{row.completedAt ? formatDate(row.completedAt) : "—"}</td>
                    </>}
                  />
                </Panel>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
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
  value: ReactNode;
  tone: "green" | "purple" | "blue" | "gold" | "red" | "teal";
}) {
  return (
    <article className={`${styles.metric} ${styles[`metric_${tone}`]}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
