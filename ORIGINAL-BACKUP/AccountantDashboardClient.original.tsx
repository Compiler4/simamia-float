"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import styles from "./AccountantDashboard.module.css";

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleLabel: string;
    companyId: string | null;
  };
};

type PageKey =
  | "Dashboard"
  | "Open Financial Day"
  | "Close Financial Day"
  | "Opening Balances"
  | "Closing Balances"
  | "Cash Book"
  | "Manual Cashflow"
  | "Expenses"
  | "General Ledger"
  | "Trial Balance"
  | "Balance Sheet"
  | "Profit & Loss"
  | "Cash Flow Statement"
  | "Bank Reconciliation"
  | "Expense Approval"
  | "Float Verification"
  | "Financial Reports"
  | "Lock Accounting Periods"
  | "Attendance Management"
  | "Notifications"
  | "Profile";

type DashboardData = {
  success: boolean;
  accountant: Record<string, any>;
  company: Record<string, any>;
  stats: Record<string, number>;
  currentDay: any | null;
  financialDays: any[];
  users: any[];
  branches: any[];
  expenses: any[];
  deposits: any[];
  floats: any[];
  attendance: any[];
  notifications: any[];
  serviceActivities: any[];
  periods: any[];
  auditLogs: any[];
  monthlySeries: any[];
  spendingBreakdown: any[];
  cashBook: any[];
  manualReceipts: any[];
  chartOfAccounts: any[];
  openingBalances: any[];
  ledger: any[];
  trialBalance: {
    rows: any[];
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
  };
  statements: Record<string, any>;
  features?: {
    accountingPeriods?: boolean;
  };
  recentTransactions: any[];
  financialHolds: any[];
  settings: Record<string, string>;
};

type GlyphName =
  | "dashboard"
  | "open"
  | "close"
  | "opening"
  | "closing"
  | "cash"
  | "manual"
  | "receipt"
  | "plus"
  | "profile"
  | "ledger"
  | "trial"
  | "balance"
  | "profit"
  | "income"
  | "flow"
  | "bank"
  | "expense"
  | "float"
  | "report"
  | "lock"
  | "attendance"
  | "bell"
  | "search"
  | "menu"
  | "logout"
  | "refresh"
  | "check"
  | "x"
  | "upload"
  | "eye"
  | "download"
  | "print"
  | "warning"
  | "user"
  | "calendar"
  | "arrow";

const navigation: Array<{
  page: PageKey;
  glyph: GlyphName;
  group: string;
}> = [
  { page: "Dashboard", glyph: "dashboard", group: "Overview" },
  { page: "Open Financial Day", glyph: "open", group: "Financial Day" },
  { page: "Close Financial Day", glyph: "close", group: "Financial Day" },
  { page: "Opening Balances", glyph: "opening", group: "Financial Day" },
  { page: "Closing Balances", glyph: "closing", group: "Financial Day" },
  { page: "Cash Book", glyph: "cash", group: "Accounting Books" },
  { page: "Manual Cashflow", glyph: "manual", group: "Accounting Books" },
  { page: "General Ledger", glyph: "ledger", group: "Accounting Books" },
  { page: "Trial Balance", glyph: "trial", group: "Accounting Books" },
  { page: "Balance Sheet", glyph: "balance", group: "Statements" },
  { page: "Profit & Loss", glyph: "profit", group: "Statements" },
  { page: "Cash Flow Statement", glyph: "flow", group: "Statements" },
  { page: "Bank Reconciliation", glyph: "bank", group: "Controls" },
  { page: "Expenses", glyph: "expense", group: "Expenses" },
  { page: "Expense Approval", glyph: "expense", group: "Controls" },
  { page: "Float Verification", glyph: "float", group: "Controls" },
  { page: "Financial Reports", glyph: "report", group: "Reports" },
  { page: "Lock Accounting Periods", glyph: "lock", group: "Reports" },
  { page: "Attendance Management", glyph: "attendance", group: "Operations" },
  { page: "Notifications", glyph: "bell", group: "Operations" },
  { page: "Profile", glyph: "profile", group: "Account" },
];

const glyphs: Record<GlyphName, string> = {
  dashboard: "▦",
  open: "◉",
  close: "◌",
  opening: "↗",
  closing: "↘",
  cash: "▤",
  manual: "+",
  receipt: "▧",
  plus: "+",
  profile: "●",
  ledger: "≡",
  trial: "⚖",
  balance: "◫",
  profit: "⌁",
  income: "∑",
  flow: "⇄",
  bank: "▣",
  expense: "▧",
  float: "↔",
  report: "▥",
  lock: "⌑",
  attendance: "✓",
  bell: "",
  search: "⌕",
  menu: "☰",
  logout: "↪",
  refresh: "↻",
  check: "✓",
  x: "×",
  upload: "⇧",
  eye: "◉",
  download: "⇩",
  print: "▣",
  warning: "!",
  user: "●",
  calendar: "▦",
  arrow: "›",
};

function safeText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function moneyShort(value: unknown) {
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

function formatDate(value: unknown, time = false) {
  if (!value) return "N/A";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(time
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

function dateInput(value: unknown = new Date()) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function monthInput(value: unknown = new Date()) {
  return dateInput(value).slice(0, 7);
}

function roleLabel(value: unknown) {
  return safeText(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    const details = [result.message, result.details, result.error]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .filter((item, index, rows) => rows.indexOf(item) === index)
      .join(" ");

    throw new Error(
      details || `The accounting request failed (${response.status}).`,
    );
  }

  return result as T;
}

function Glyph({
  name,
  className = "",
}: {
  name: GlyphName;
  className?: string;
}) {
  if (name === "bell") {
    return (
      <span className={`${styles.glyph} ${className}`} aria-hidden="true">
        <svg className={styles.bellSvg} viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 21h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${styles.glyph} ${className}`} aria-hidden="true">
      {glyphs[name]}
    </span>
  );
}

export default function AccountantDashboardClient({ user }: Props) {
  const router = useRouter();
  const [activePage, setActivePage] = useState<PageKey>("Dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [search, setSearch] = useState("");

  const unread = safeArray<any>(data?.notifications).filter(
    (item) => !item.isRead,
  ).length;

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function loadDashboard(showLoader = true) {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const result = await requestJson<DashboardData>(
        "/api/accountant/dashboard",
      );
      setData(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The accountant dashboard could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    action: string,
    payload: Record<string, unknown> = {},
  ) {
    setBusy(true);

    try {
      const endpoint =
        action === "ASSIGN_STAFF_FLOAT"
          ? "/api/accountant/manual-float"
          : "/api/accountant/actions";

      const result = await requestJson<{
        success: true;
        message: string;
      }>(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      });

      setToast(result.message);
      await loadDashboard(false);
      return true;
    } catch (requestError) {
      setToast(
        requestError instanceof Error
          ? requestError.message
          : "The action failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const result = await requestJson<{
      success: true;
      url: string;
    }>("/api/accountant/upload", {
      method: "POST",
      body: formData,
    });

    return result.url;
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
  }

  function openPage(page: PageKey) {
    setActivePage(page);
    setMobileOpen(false);
    setNoticeOpen(false);
  }

  function runSearch() {
    const query = search.trim().toLowerCase();
    if (!query) return;

    const match = navigation.find((item) =>
      item.page.toLowerCase().includes(query),
    );

    if (!match) {
      setToast(`No accountant section matched “${search}”.`);
      return;
    }

    openPage(match.page);
    setSearch("");
  }

  return (
    <main
      className={`${styles.page} ${collapsed ? styles.sidebarCollapsed : ""}`}
    >
      <button
        type="button"
        className={`${styles.mobileBackdrop} ${
          mobileOpen ? styles.mobileBackdropShow : ""
        }`}
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
      />

      <aside
        className={`${styles.sidebar} ${
          mobileOpen ? styles.sidebarMobileOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <span className={styles.brandOrb}></span>
          <div>
            <strong>Simamia Finance</strong>
            <small>Accountant Portal</small>
          </div>
          <em className={styles.brandBadge}>LIVE</em>
        </div>

        <button
          type="button"
          className={styles.collapseControl}
          onClick={() => {
            if (window.matchMedia("(max-width: 920px)").matches) {
              setMobileOpen(false);
              return;
            }

            setCollapsed((current) => !current);
          }}
          aria-label={
            collapsed
              ? "Expand accountant sidebar"
              : "Collapse accountant sidebar"
          }
          aria-expanded={!collapsed}
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
        >
          <Glyph name="menu" />
          <span>{collapsed ? "Expand Menu" : "Collapse Menu"}</span>
          <b aria-hidden="true">{collapsed ? "›" : "‹"}</b>
        </button>

        <nav className={styles.navigation}>
          {Array.from(new Set(navigation.map((item) => item.group))).map(
            (group) => (
              <section className={styles.navGroup} key={group}>
                <small>{group}</small>
                {navigation
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.page}
                      className={
                        item.page === activePage ? styles.activeNav : ""
                      }
                      onClick={() => openPage(item.page)}
                      title={item.page}
                    >
                      <Glyph name={item.glyph} />
                      <span>{item.page}</span>
                      {item.page === "Notifications" && unread > 0 && (
                        <em>{unread}</em>
                      )}
                    </button>
                  ))}
              </section>
            ),
          )}
        </nav>

        <button
          type="button"
          className={styles.sidebarLogout}
          onClick={logout}
          title="Logout"
        >
          <Glyph name="logout" />
          <span>Logout</span>
        </button>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.mobileMenu}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Glyph name="menu" />
          </button>

          <div className={styles.heading}>
            <small>
              {safeText(data?.company?.name) || "Finance workspace"}
            </small>
            <h1>{activePage}</h1>
          </div>

          <div className={styles.searchBox}>
            <Glyph name="search" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              placeholder="Search accounting section..."
            />
          </div>

          <button
            type="button"
            className={styles.topIconButton}
            onClick={() => void loadDashboard(false)}
            title="Refresh database data"
          >
            <Glyph name="refresh" />
          </button>

          <button
            type="button"
            className={styles.topIconButton}
            onClick={() => setNoticeOpen((current) => !current)}
            title="Notifications"
          >
            <Glyph name="bell" />
            {unread > 0 && <span>{unread}</span>}
          </button>

          <button
            type="button"
            className={styles.profile}
            onClick={() => openPage("Profile")}
            title="Open profile"
          >
            <div className={styles.profileAvatar}>
              {data?.accountant?.profileImageUrl ? (
                <img
                  src={safeText(data.accountant.profileImageUrl)}
                  alt={user.name}
                />
              ) : (
                user.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <span>
              <strong>{user.name}</strong>
              <small>{user.roleLabel}</small>
            </span>
          </button>

          {noticeOpen && data && (
            <NotificationPopup
              notifications={data.notifications}
              unread={unread}
              runAction={runAction}
              openAll={() => openPage("Notifications")}
            />
          )}
        </header>

        {toast && <div className={styles.toast}>{toast}</div>}

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} retry={() => void loadDashboard()} />
        ) : data ? (
          <div className={styles.pageReveal} key={activePage}>
            <PageContent
              page={activePage}
              data={data}
              busy={busy}
              runAction={runAction}
              uploadFile={uploadFile}
              openPage={openPage}
              notify={setToast}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function PageContent({
  page,
  data,
  busy,
  runAction,
  uploadFile,
  openPage,
  notify,
}: {
  page: PageKey;
  data: DashboardData;
  busy: boolean;
  runAction: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<boolean>;
  uploadFile: (file: File) => Promise<string>;
  openPage: (page: PageKey) => void;
  notify: (message: string) => void;
}) {
  const common = {
    data,
    busy,
    runAction,
    uploadFile,
    notify,
  };

  if (page === "Open Financial Day") {
    return <FinancialDayPage mode="OPEN" {...common} />;
  }

  if (page === "Close Financial Day") {
    return <FinancialDayPage mode="CLOSE" {...common} />;
  }

  if (page === "Opening Balances") {
    return <OpeningBalancesPage {...common} />;
  }

  if (page === "Closing Balances") {
    return <BalanceHistoryPage type="CLOSING" data={data} />;
  }

  if (page === "Cash Book") return <CashBookPage data={data} />;

  if (page === "Manual Cashflow") {
    return <ManualCashflowPage {...common} />;
  }

  if (page === "Expenses") {
    return <ExpensesPage {...common} />;
  }

  if (page === "General Ledger") return <LedgerPage data={data} />;
  if (page === "Trial Balance") return <TrialBalancePage data={data} />;

  if (page === "Balance Sheet") {
    return <StatementPage type="BALANCE_SHEET" data={data} />;
  }

  if (page === "Profit & Loss") {
    return <StatementPage type="PROFIT_LOSS" data={data} />;
  }

  if (page === "Cash Flow Statement") {
    return <StatementPage type="CASH_FLOW" data={data} />;
  }

  if (page === "Bank Reconciliation") {
    return <BankReconciliationPage {...common} />;
  }

  if (page === "Expense Approval") {
    return <ExpenseApprovalPage {...common} />;
  }

  if (page === "Float Verification") {
    return <FloatVerificationPage {...common} />;
  }

  if (page === "Financial Reports") {
    return <ReportsPage data={data} />;
  }

  if (page === "Lock Accounting Periods") {
    return <PeriodsPage {...common} />;
  }

  if (page === "Attendance Management") {
    return <AttendancePage {...common} />;
  }

  if (page === "Notifications") {
    return <NotificationsPage {...common} />;
  }

  if (page === "Profile") {
    return <ProfilePage {...common} />;
  }

  return <DashboardHome data={data} openPage={openPage} />;
}

function DashboardHome({
  data,
  openPage,
}: {
  data: DashboardData;
  openPage: (page: PageKey) => void;
}) {
  return (
    <section className={styles.dashboard}>
      <div className={styles.metricGrid}>
        <MetricCard
          label="Total Balance"
          value={money(data.stats.totalBalance)}
          theme="peach"
          note={
            data.currentDay
              ? `${safeText(data.currentDay.status)} financial day`
              : "No financial day open"
          }
        />
        <MetricCard
          label="Today Income"
          value={money(data.stats.dailyIncome)}
          theme="blue"
          note="Posted revenue for today"
        />
        <MetricCard
          label="Today Expenses"
          value={money(data.stats.dailyExpenses)}
          theme="orange"
          note={`${data.stats.pendingExpenses || 0} awaiting approval`}
        />
        <MetricCard
          label="Net Profit"
          value={money(data.stats.dailyNetProfit)}
          theme="yellow"
          note="Today income less today expenses"
        />
      </div>

      <div className={styles.chartGrid}>
        <GlassCard title="Today Cash Movement" subtitle="Three-hour intervals">
          <EarningsChart rows={data.monthlySeries} />
        </GlassCard>

        <GlassCard title="Today Breakdown" subtitle="Cash in and cash out">
          <BreakdownChart rows={data.monthlySeries} />
        </GlassCard>
      </div>

      <div className={styles.bottomGrid}>
        <GlassCard title="Today Spending" subtitle="Approved categories">
          <SpendingDonut rows={data.spendingBreakdown} />
        </GlassCard>

        <GlassCard title="Quick Actions" subtitle="Common accounting work">
          <div className={styles.quickActions}>
            {[
              ["Open Day", "Open Financial Day", "open"],
              ["Verify Bank", "Bank Reconciliation", "bank"],
              ["Approve Expense", "Expense Approval", "expense"],
              ["Export Report", "Financial Reports", "report"],
            ].map(([label, page, glyph]) => (
              <button
                type="button"
                key={label}
                onClick={() => openPage(page as PageKey)}
              >
                <Glyph name={glyph as GlyphName} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className={styles.controlSummary}>
            <SummaryLine
              label="Bank mismatches"
              value={String(data.stats.unresolvedMismatches || 0)}
              warning={Boolean(data.stats.unresolvedMismatches)}
            />
            <SummaryLine
              label="Pending float"
              value={String(data.stats.pendingFloats || 0)}
            />
            <SummaryLine
              label="Outstanding float"
              value={moneyShort(data.stats.outstandingFloat)}
            />
          </div>
        </GlassCard>

        <GlassCard title="Today Recent Transactions" subtitle="Posted today">
          <div className={styles.recentList}>
            {safeArray<any>(data.recentTransactions)
              .slice(0, 5)
              .map((item) => (
                <article key={item.id}>
                  <span className={styles.transactionAvatar}>
                    {item.user?.profileImageUrl ? (
                      <img
                        src={item.user.profileImageUrl}
                        alt={item.user.name || "User"}
                      />
                    ) : (
                      safeText(item.user?.name || item.user?.email || "U")
                        .slice(0, 1)
                        .toUpperCase()
                    )}
                  </span>
                  <div>
                    <strong>
                      {item.user?.name ||
                        item.user?.email ||
                        "System transaction"}
                    </strong>
                    <small>{item.user?.email || item.description}</small>
                    <small>
                      {formatDate(item.date, true)} · {item.description}
                    </small>
                  </div>
                  <b
                    className={
                      item.debit > 0
                        ? styles.positiveAmount
                        : styles.negativeAmount
                    }
                  >
                    {item.debit > 0
                      ? `+${moneyShort(item.debit)}`
                      : `-${moneyShort(item.credit)}`}
                  </b>
                </article>
              ))}
            {!safeArray<any>(data.recentTransactions).length && (
              <Empty text="No financial transactions yet." />
            )}
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

function FinancialDayPage({
  mode,
  data,
  busy,
  runAction,
}: {
  mode: "OPEN" | "CLOSE";
  data: DashboardData;
  busy: boolean;
  runAction: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    date: dateInput(),
    openingBalance: safeText(
      data.currentDay?.openingBalance ??
        data.financialDays?.[0]?.closingBalance ??
        0,
    ),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();

    await runAction(mode === "OPEN" ? "OPEN_DAY" : "CLOSE_DAY", {
      date: form.date,
      openingBalance: form.openingBalance,
      financialDayId: data.currentDay?.id,
    });
  }

  const day = data.currentDay;

  return (
    <SectionPage
      title={mode === "OPEN" ? "Open Financial Day" : "Close Financial Day"}
      subtitle={
        mode === "OPEN"
          ? "Start the accounting day with a controlled opening balance."
          : "Closing is blocked automatically while bank mismatches remain unresolved."
      }
      glyph={mode === "OPEN" ? "open" : "close"}
    >
      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={submit}>
          <CardHeading
            title={mode === "OPEN" ? "Day opening form" : "Day closing control"}
            text={
              mode === "OPEN"
                ? "The previous closed balance is used by default."
                : "Cash in and cash out are recalculated from verified and approved records."
            }
          />

          <Field label="Financial date">
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
              disabled={mode === "CLOSE"}
            />
          </Field>

          {mode === "OPEN" && (
            <Field label="Opening balance">
              <input
                type="number"
                min="0"
                value={form.openingBalance}
                onChange={(event) =>
                  setForm({
                    ...form,
                    openingBalance: event.target.value,
                  })
                }
              />
            </Field>
          )}

          {mode === "CLOSE" && (
            <div className={styles.daySummary}>
              <SummaryLine
                label="Opening balance"
                value={money(day?.openingBalance)}
              />
              <SummaryLine label="Cash in" value={money(day?.cashIn)} />
              <SummaryLine label="Cash out" value={money(day?.cashOut)} />
              <SummaryLine
                label="Expected closing"
                value={money(
                  Number(day?.openingBalance || 0) +
                    Number(day?.cashIn || 0) -
                    Number(day?.cashOut || 0),
                )}
              />
            </div>
          )}

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={
              busy ||
              (mode === "OPEN" && Boolean(data.currentDay)) ||
              (mode === "CLOSE" && !data.currentDay)
            }
          >
            <Glyph name={mode === "OPEN" ? "open" : "close"} />
            {busy
              ? "Processing..."
              : mode === "OPEN"
                ? "Open financial day"
                : "Close financial day"}
          </button>
        </form>

        <article className={styles.statusPanel}>
          <CardHeading
            title="Current financial day"
            text="Live control status from the database."
          />

          {day ? (
            <>
              <StatusHero
                status={day.status}
                label={formatDate(day.date)}
                value={money(day.closingBalance)}
              />

              <div className={styles.detailGrid}>
                <Detail label="Opened by" value={safeText(day.openedById)} />
                <Detail
                  label="Opened at"
                  value={formatDate(day.openedAt, true)}
                />
                <Detail
                  label="Closed at"
                  value={formatDate(day.closedAt, true)}
                />
                <Detail
                  label="Blocked reason"
                  value={safeText(day.blockedReason) || "No restriction"}
                />
              </div>
            </>
          ) : (
            <Empty text="No financial day has been opened for today." />
          )}
        </article>
      </div>

      <TableCard
        title="Recent financial days"
        subtitle="Opening, movement and closing records"
      >
        <DataTable minWidth={1000}>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Opening</th>
              <th>Cash in</th>
              <th>Cash out</th>
              <th>Closing</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.financialDays)
              .slice(0, 20)
              .map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{money(item.openingBalance)}</td>
                  <td>{money(item.cashIn)}</td>
                  <td>{money(item.cashOut)}</td>
                  <td>{money(item.closingBalance)}</td>
                  <td>
                    <Status status={item.status} />
                  </td>
                  <td>{formatDate(item.openedAt, true)}</td>
                  <td>{formatDate(item.closedAt, true)}</td>
                </tr>
              ))}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function OpeningBalancesPage({ data, busy, runAction }: CommonPageProps) {
  const accounts = safeArray<any>(data.chartOfAccounts);
  const first = accounts[0] ?? {
    code: "1000",
    name: "Cash on Hand",
    type: "ASSET",
    normalBalance: "DEBIT",
  };
  const [form, setForm] = useState({
    accountCode: safeText(first.code),
    accountName: safeText(first.name),
    accountType: safeText(first.type || "ASSET"),
    side: safeText(first.normalBalance || "DEBIT"),
    amount: "",
    asOfDate: dateInput(),
  });

  function selectAccount(code: string) {
    const account = accounts.find((item) => safeText(item.code) === code);
    setForm((current) => ({
      ...current,
      accountCode: code,
      accountName: safeText(account?.name),
      accountType: safeText(account?.type || "ASSET"),
      side: safeText(account?.normalBalance || "DEBIT"),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await runAction("SAVE_OPENING_BALANCE", form);
    if (saved) setForm((current) => ({ ...current, amount: "" }));
  }

  return (
    <SectionPage
      title="Opening Balances"
      subtitle="Post opening account balances through a balanced journal entry. Cash and bank balances also update the cash book."
      glyph="opening"
    >
      <div className={styles.splitWorkspace}>
        <form className={styles.formCard} onSubmit={submit}>
          <CardHeading
            title="Add opening balance"
            text="The opposite side is posted automatically to Opening Balance Equity."
          />
          <Field label="Ledger account">
            <select
              value={form.accountCode}
              onChange={(event) => selectAccount(event.target.value)}
              required
            >
              {accounts.map((item) => (
                <option key={item.id || item.code} value={item.code}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles.formGrid}>
            <Field label="Account type">
              <input value={roleLabel(form.accountType)} readOnly />
            </Field>
            <Field label="Normal side">
              <select
                value={form.side}
                onChange={(event) =>
                  setForm({ ...form, side: event.target.value })
                }
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                required
              />
            </Field>
            <Field label="As-of date">
              <input
                type="date"
                value={form.asOfDate}
                onChange={(event) =>
                  setForm({ ...form, asOfDate: event.target.value })
                }
                required
              />
            </Field>
          </div>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={busy || !form.accountCode || !form.amount}
          >
            <Glyph name="check" />{" "}
            {busy ? "Posting..." : "Post opening balance"}
          </button>
        </form>

        <TableCard
          title="Opening Balance Register"
          subtitle={`${safeArray<any>(data.openingBalances).length} posted balances`}
        >
          <DataTable minWidth={760}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Code</th>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Posted by</th>
              </tr>
            </thead>
            <tbody>
              {safeArray<any>(data.openingBalances).map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{formatDate(item.asOfDate)}</td>
                  <td>{item.account?.code}</td>
                  <td>{item.account?.name}</td>
                  <td>{Number(item.debit) > 0 ? money(item.debit) : "—"}</td>
                  <td>{Number(item.credit) > 0 ? money(item.credit) : "—"}</td>
                  <td>
                    {item.postedBy?.name || item.postedBy?.email || "N/A"}
                  </td>
                </tr>
              ))}
              {!safeArray<any>(data.openingBalances).length && (
                <EmptyRow
                  colSpan={7}
                  text="No opening balances have been posted."
                />
              )}
            </tbody>
          </DataTable>
        </TableCard>
      </div>
    </SectionPage>
  );
}

function BalanceHistoryPage({
  type,
  data,
}: {
  type: "OPENING" | "CLOSING";
  data: DashboardData;
}) {
  const field = type === "OPENING" ? "openingBalance" : "closingBalance";

  return (
    <SectionPage
      title={type === "OPENING" ? "Opening Balances" : "Closing Balances"}
      subtitle="Historical balances by financial day."
      glyph={type === "OPENING" ? "opening" : "closing"}
    >
      <div className={styles.metricGrid}>
        <MetricCard
          label="Latest Balance"
          value={money(data.financialDays?.[0]?.[field])}
          theme="blue"
          note={formatDate(data.financialDays?.[0]?.date)}
        />
        <MetricCard
          label="Highest Balance"
          value={money(
            Math.max(
              0,
              ...safeArray<any>(data.financialDays).map((item) =>
                Number(item[field] || 0),
              ),
            ),
          )}
          theme="peach"
          note="Across available records"
        />
        <MetricCard
          label="Average Balance"
          value={money(
            safeArray<any>(data.financialDays).length
              ? safeArray<any>(data.financialDays).reduce(
                  (sum, item) => sum + Number(item[field] || 0),
                  0,
                ) / safeArray<any>(data.financialDays).length
              : 0,
          )}
          theme="yellow"
          note="Historical average"
        />
        <MetricCard
          label="Closed Days"
          value={String(
            safeArray<any>(data.financialDays).filter(
              (item) => item.status === "CLOSED",
            ).length,
          )}
          theme="orange"
          note="Completed accounting days"
        />
      </div>

      <TableCard
        title={`${type === "OPENING" ? "Opening" : "Closing"} balance register`}
        subtitle="Real FinancialDay records"
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Balance</th>
              <th>Cash in</th>
              <th>Cash out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.financialDays).map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{formatDate(item.date)}</td>
                <td>{money(item[field])}</td>
                <td>{money(item.cashIn)}</td>
                <td>{money(item.cashOut)}</td>
                <td>
                  <Status status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function ManualCashflowPage({
  data,
  busy,
  runAction,
  uploadFile,
  notify,
}: CommonPageProps) {
  const staffUsers = useMemo(
    () =>
      safeArray<any>(data.users)
        .filter(
          (item) =>
            safeText(item.role).toUpperCase() === "STAFF" &&
            safeText(item.status || "ACTIVE").toUpperCase() === "ACTIVE",
        )
        .sort((left, right) =>
          safeText(left.name).localeCompare(safeText(right.name)),
        ),
    [data.users],
  );

  const manualFloatRows = useMemo(
    () =>
      safeArray<any>(data.floats)
        .filter(
          (item) =>
            safeText(item.transactionType).toUpperCase() ===
              "ACCOUNTANT_TO_STAFF" &&
            (safeText(item.fromUserId) === safeText(data.accountant?.id) ||
              safeText(item.fromUser?.id) === safeText(data.accountant?.id)),
        )
        .sort(
          (left, right) =>
            new Date(right.issuedAt || right.createdAt || 0).getTime() -
            new Date(left.issuedAt || left.createdAt || 0).getTime(),
        ),
    [data.floats, data.accountant?.id],
  );

  const firstStaffId = staffUsers[0]?.id || "";

  const [floatForm, setFloatForm] = useState({
    staffUserId: firstStaffId,
    issueDate: dateInput(),
    amount: "",
    referenceNo: "",
    purpose: "Morning operational float",
    notes: "",
    receiptUrl: "",
  });

  const [receiptForm, setReceiptForm] = useState({
    sourceUserId: firstStaffId,
    transactionDate: dateInput(),
    amount: "",
    classification: "STAFF_RETURN",
    description: "",
    referenceNo: "",
    receiptUrl: "",
  });

  useEffect(() => {
    if (!floatForm.staffUserId && firstStaffId) {
      setFloatForm((current) => ({
        ...current,
        staffUserId: firstStaffId,
      }));
    }

    if (!receiptForm.sourceUserId && firstStaffId) {
      setReceiptForm((current) => ({
        ...current,
        sourceUserId: firstStaffId,
      }));
    }
  }, [firstStaffId, floatForm.staffUserId, receiptForm.sourceUserId]);

  const currentDayOpen =
    Boolean(data.currentDay) &&
    safeText(data.currentDay?.status).toUpperCase() === "OPEN";

  const assignedTotal = manualFloatRows.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const waitingConfirmation = manualFloatRows.filter((item) =>
    ["PENDING", "ISSUED"].includes(safeText(item.status).toUpperCase()),
  ).length;

  const confirmedCount = manualFloatRows.filter((item) =>
    ["CONFIRMED", "APPROVED", "RETURNED", "DEPOSITED"].includes(
      safeText(item.status).toUpperCase(),
    ),
  ).length;

  async function handleFloatProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const url = await uploadFile(file);

      setFloatForm((current) => ({
        ...current,
        receiptUrl: url,
      }));

      notify("Float assignment proof uploaded.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Float proof upload failed.",
      );
    }
  }

  async function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const url = await uploadFile(file);

      setReceiptForm((current) => ({
        ...current,
        receiptUrl: url,
      }));

      notify("Manual receipt document uploaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Receipt upload failed.");
    }
  }

  async function submitFloat(event: FormEvent) {
    event.preventDefault();

    const saved = await runAction("ASSIGN_STAFF_FLOAT", floatForm);

    if (saved) {
      setFloatForm((current) => ({
        ...current,
        amount: "",
        referenceNo: "",
        notes: "",
        receiptUrl: "",
      }));
    }
  }

  async function submitReceipt(event: FormEvent) {
    event.preventDefault();

    const saved = await runAction("CREATE_MANUAL_RECEIPT", receiptForm);

    if (saved) {
      setReceiptForm((current) => ({
        ...current,
        amount: "",
        description: "",
        referenceNo: "",
        receiptUrl: "",
      }));
    }
  }

  return (
    <SectionPage
      title="Manual Cashflow"
      subtitle="Assign operational float to active staff officers and record money received manually. Both registers are displayed on the same database-backed page."
      glyph="manual"
    >
      {!staffUsers.length && (
        <div className={styles.featureWarning}>
          <Glyph name="warning" />

          <div>
            <strong>No active staff users were found</strong>
            <p>
              A Company Admin must register an active user with the STAFF role
              before the accountant can assign operational float.
            </p>
          </div>
        </div>
      )}

      {!currentDayOpen && (
        <div className={styles.manualCashflowWarning}>
          <Glyph name="warning" />

          <div>
            <strong>Open the financial day first</strong>
            <p>
              Manual staff-float assignment is disabled until today&apos;s
              financial day has status OPEN.
            </p>
          </div>
        </div>
      )}

      <div className={styles.manualCashflowMetrics}>
        <MetricCard
          label="Active Staff"
          value={String(staffUsers.length)}
          theme="blue"
          note="Available in the assignment dropdown"
        />

        <MetricCard
          label="Float Assigned"
          value={moneyShort(assignedTotal)}
          theme="peach"
          note={`${manualFloatRows.length} manual assignment records`}
        />

        <MetricCard
          label="Waiting Confirmation"
          value={String(waitingConfirmation)}
          theme="orange"
          note="Pending or issued to staff"
        />

        <MetricCard
          label="Confirmed"
          value={String(confirmedCount)}
          theme="yellow"
          note="Confirmed, approved, returned or deposited"
        />
      </div>

      <div className={styles.manualCashflowWorkspace}>
        <form
          className={`${styles.formCard} ${styles.manualFloatCard}`}
          onSubmit={submitFloat}
        >
          <div className={styles.cashflowCardLabel}>
            <Glyph name="float" />
            <span>Cash Out</span>
          </div>

          <CardHeading
            title="Assign float to staff"
            text="Select an active STAFF user and record the amount physically or electronically issued."
          />

          <Field label="Staff officer">
            <select
              value={floatForm.staffUserId}
              onChange={(event) =>
                setFloatForm({
                  ...floatForm,
                  staffUserId: event.target.value,
                })
              }
              required
            >
              {!staffUsers.length && (
                <option value="">No active STAFF users</option>
              )}

              {staffUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.email} —{" "}
                  {item.branch?.name || "No branch"}
                </option>
              ))}
            </select>
          </Field>

          <div className={styles.formGrid}>
            <Field label="Issue date">
              <input
                type="date"
                value={floatForm.issueDate}
                onChange={(event) =>
                  setFloatForm({
                    ...floatForm,
                    issueDate: event.target.value,
                  })
                }
                required
              />
            </Field>

            <Field label="Amount">
              <input
                type="number"
                min="1"
                step="0.01"
                value={floatForm.amount}
                onChange={(event) =>
                  setFloatForm({
                    ...floatForm,
                    amount: event.target.value,
                  })
                }
                placeholder="Example: 500000"
                required
              />
            </Field>

            <Field label="Reference number">
              <input
                value={floatForm.referenceNo}
                onChange={(event) =>
                  setFloatForm({
                    ...floatForm,
                    referenceNo: event.target.value,
                  })
                }
                placeholder="Leave blank to auto-generate"
              />
            </Field>

            <Field label="Purpose">
              <input
                value={floatForm.purpose}
                onChange={(event) =>
                  setFloatForm({
                    ...floatForm,
                    purpose: event.target.value,
                  })
                }
                placeholder="Morning operational float"
                required
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={floatForm.notes}
              onChange={(event) =>
                setFloatForm({
                  ...floatForm,
                  notes: event.target.value,
                })
              }
              placeholder="Cash handover details, denomination notes or transfer information..."
            />
          </Field>

          <label className={styles.fileBox}>
            <Glyph name="upload" />

            <span>
              {floatForm.receiptUrl
                ? "Float assignment proof uploaded"
                : "Optional: upload cash handover or transfer proof"}
            </span>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFloatProof}
            />
          </label>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={
              busy ||
              !currentDayOpen ||
              !floatForm.staffUserId ||
              !floatForm.amount
            }
          >
            <Glyph name="float" />

            {busy ? "Assigning float..." : "Assign float to staff"}
          </button>
        </form>

        <form
          className={`${styles.formCard} ${styles.manualReceiptCard}`}
          onSubmit={submitReceipt}
        >
          <div className={styles.cashflowCardLabel}>
            <Glyph name="receipt" />
            <span>Cash In</span>
          </div>

          <CardHeading
            title="Receive money manually"
            text="Record cash returned by a staff officer before it reaches a bank account."
          />

          <Field label="Received from staff">
            <select
              value={receiptForm.sourceUserId}
              onChange={(event) =>
                setReceiptForm({
                  ...receiptForm,
                  sourceUserId: event.target.value,
                })
              }
              required
            >
              {!staffUsers.length && (
                <option value="">No active STAFF users</option>
              )}

              {staffUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.email}
                </option>
              ))}
            </select>
          </Field>

          <div className={styles.formGrid}>
            <Field label="Transaction date">
              <input
                type="date"
                value={receiptForm.transactionDate}
                onChange={(event) =>
                  setReceiptForm({
                    ...receiptForm,
                    transactionDate: event.target.value,
                  })
                }
                required
              />
            </Field>

            <Field label="Amount">
              <input
                type="number"
                min="1"
                step="0.01"
                value={receiptForm.amount}
                onChange={(event) =>
                  setReceiptForm({
                    ...receiptForm,
                    amount: event.target.value,
                  })
                }
                required
              />
            </Field>

            <Field label="Accounting classification">
              <select
                value={receiptForm.classification}
                onChange={(event) =>
                  setReceiptForm({
                    ...receiptForm,
                    classification: event.target.value,
                  })
                }
              >
                <option value="STAFF_RETURN">Staff float return</option>
                <option value="REVENUE">Verified service revenue</option>
                <option value="OTHER_RECEIPT">Other cash receipt</option>
              </select>
            </Field>

            <Field label="Reference number">
              <input
                value={receiptForm.referenceNo}
                onChange={(event) =>
                  setReceiptForm({
                    ...receiptForm,
                    referenceNo: event.target.value,
                  })
                }
                placeholder="RCPT-2026-0001"
                required
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={receiptForm.description}
              onChange={(event) =>
                setReceiptForm({
                  ...receiptForm,
                  description: event.target.value,
                })
              }
              placeholder="Reason for received money"
              required
            />
          </Field>

          <label className={styles.fileBox}>
            <Glyph name="upload" />

            <span>
              {receiptForm.receiptUrl
                ? "Receipt uploaded"
                : "Upload receipt or supporting document"}
            </span>

            <input type="file" accept="image/*,.pdf" onChange={handleReceipt} />
          </label>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={
              busy || !receiptForm.sourceUserId || !receiptForm.receiptUrl
            }
          >
            <Glyph name="check" />

            {busy ? "Posting receipt..." : "Post cash receipt"}
          </button>
        </form>
      </div>

      <TableCard
        title="Manual Staff Float Register"
        subtitle={`${manualFloatRows.length} float assignment records entered by this accountant`}
      >
        <DataTable minWidth={1450}>
          <thead>
            <tr>
              <th>#</th>
              <th>Staff Officer</th>
              <th>Email</th>
              <th>Branch</th>
              <th>Issue Date</th>
              <th>Reference</th>
              <th>Purpose</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Proof</th>
              <th>Confirmed</th>
              <th>Assigned By</th>
            </tr>
          </thead>

          <tbody>
            {manualFloatRows.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>

                <td>
                  <Entity
                    name={item.toUser?.name || "Staff officer"}
                    sub={roleLabel(item.toUser?.role || "STAFF")}
                  />
                </td>

                <td>{item.toUser?.email || "N/A"}</td>

                <td>
                  {item.toUser?.branch?.name ||
                    item.toUser?.branchId ||
                    "No branch"}
                </td>

                <td>{formatDate(item.issuedAt || item.createdAt, true)}</td>

                <td>{item.referenceNo || "Auto generated"}</td>

                <td className={styles.wrapCell}>
                  {item.purpose || "Operational float"}
                </td>

                <td>{money(item.amount)}</td>

                <td>
                  <Status status={item.status} />
                </td>

                <td>
                  {item.receiptUrl ? (
                    <a
                      className={styles.documentLink}
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Glyph name="eye" />
                      View
                    </a>
                  ) : (
                    "Optional"
                  )}
                </td>

                <td>
                  {item.confirmedAt
                    ? formatDate(item.confirmedAt, true)
                    : "Waiting for staff"}
                </td>

                <td>
                  {item.fromUser?.name || data.accountant?.name || "Accountant"}
                </td>
              </tr>
            ))}

            {!manualFloatRows.length && (
              <EmptyRow
                colSpan={12}
                text="No manual staff-float assignments have been entered."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>

      <TableCard
        title="Manual Receipt Register"
        subtitle="Direct staff receipts stored in the database"
      >
        <DataTable minWidth={1150}>
          <thead>
            <tr>
              <th>#</th>
              <th>Received From</th>
              <th>Email</th>
              <th>Role</th>
              <th>Date</th>
              <th>Reference</th>
              <th>Classification</th>
              <th>Amount</th>
              <th>Document</th>
              <th>Posted By</th>
            </tr>
          </thead>

          <tbody>
            {safeArray<any>(data.manualReceipts).map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.sourceUser?.name || "Staff"}</td>
                <td>{item.sourceUser?.email || "N/A"}</td>
                <td>{roleLabel(item.sourceUser?.role)}</td>
                <td>{formatDate(item.transactionDate)}</td>
                <td>{item.referenceNo}</td>
                <td>
                  <Status status={item.classification} />
                </td>
                <td>{money(item.amount)}</td>
                <td>
                  {item.receiptUrl ? (
                    <a
                      className={styles.documentLink}
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Glyph name="eye" />
                      View
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>{item.postedBy?.name || "Accountant"}</td>
              </tr>
            ))}

            {!safeArray<any>(data.manualReceipts).length && (
              <EmptyRow colSpan={10} text="No manual cash receipts recorded." />
            )}
          </tbody>
        </DataTable>
      </TableCard>

      <article className={styles.manualCashflowRules}>
        <CardHeading
          title="Accounting and control rules"
          text="The portal separates float assignment from revenue and return postings."
        />

        <ul className={styles.ruleList}>
          <li>
            Float assigned to staff creates an ACCOUNTANT_TO_STAFF transaction
            with status ISSUED.
          </li>
          <li>
            The selected staff officer confirms the assigned float from the
            Staff Portal.
          </li>
          <li>
            Staff float return: Debit Cash, Credit Staff Float Receivable.
          </li>
          <li>Verified revenue: Debit Cash, Credit Service Revenue.</li>
          <li>
            Duplicate references are changed automatically to a unique company
            reference.
          </li>
          <li>
            Locked accounting periods and closed financial days reject new
            manual assignments.
          </li>
        </ul>
      </article>
    </SectionPage>
  );
}

function ExpensesPage({
  data,
  busy,
  runAction,
  uploadFile,
  notify,
}: CommonPageProps) {
  const [form, setForm] = useState({
    employeeId: data.users?.[0]?.id || "",
    category: "FUEL",
    description: "",
    amount: "",
    expenseDate: dateInput(),
    receiptUrl: "",
  });
  const [period, setPeriod] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR">(
    "DAY",
  );
  const [reference, setReference] = useState(dateInput());
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const range = useMemo(
    () => clientPeriodRange(period, reference),
    [period, reference],
  );
  const rows = useMemo(
    () =>
      safeArray<any>(data.expenses).filter((item) => {
        const time = new Date(item.expenseDate || item.createdAt).getTime();
        const owner = item.employee || {};
        const haystack =
          `${owner.name || ""} ${owner.username || ""} ${owner.email || ""} ${item.category || ""} ${item.description || ""}`.toLowerCase();
        return (
          time >= range.start.getTime() &&
          time <= range.end.getTime() &&
          (role === "ALL" || owner.role === role) &&
          (status === "ALL" || item.status === status) &&
          (!query.trim() || haystack.includes(query.trim().toLowerCase()))
        );
      }),
    [data.expenses, range, query, role, status],
  );
  const roles = Array.from(
    new Set(
      safeArray<any>(data.users)
        .map((item) => item.role)
        .filter(Boolean),
    ),
  );

  async function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      setForm((current) => ({ ...current, receiptUrl: url }));
      notify("Expense receipt uploaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await runAction("CREATE_EXPENSE", form);
    if (saved) {
      setForm((current) => ({
        ...current,
        description: "",
        amount: "",
        receiptUrl: "",
      }));
    }
  }

  return (
    <SectionPage
      title="Expenses"
      subtitle="Create an expense on the left and review automatically filtered database records on the right."
      glyph="expense"
      action={<ReportButtons filename="expense-register" rows={rows} />}
    >
      <div className={styles.expenseWorkspace}>
        <form className={styles.formCard} onSubmit={submit}>
          <CardHeading
            title="Add expense"
            text="A receipt is required. Posting happens only after approval."
          />
          <Field label="Expense owner">
            <select
              value={form.employeeId}
              onChange={(event) =>
                setForm({ ...form, employeeId: event.target.value })
              }
              required
            >
              {safeArray<any>(data.users).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.email} — {roleLabel(item.role)}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles.formGrid}>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {[
                  "FUEL",
                  "TRANSPORT",
                  "AIRTIME",
                  "ACCOMMODATION",
                  "REPAIRS",
                  "STATIONERY",
                  "MEALS",
                  "OFFICE",
                  "EMERGENCY",
                  "OTHER",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="1"
                step="0.01"
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
          </div>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              required
            />
          </Field>
          <label className={styles.fileBox}>
            <Glyph name="upload" />
            <span>
              {form.receiptUrl ? "Receipt uploaded" : "Upload receipt"}
            </span>
            <input type="file" accept="image/*,.pdf" onChange={handleReceipt} />
          </label>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={busy || !form.receiptUrl || !form.employeeId}
          >
            <Glyph name="check" /> {busy ? "Saving..." : "Submit expense"}
          </button>
        </form>

        <article className={styles.expenseTablePanel}>
          <div className={styles.autoFilterBar}>
            <Field label="Period">
              <select
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value as typeof period)
                }
              >
                <option value="DAY">Day</option>
                <option value="WEEK">Week</option>
                <option value="MONTH">Month</option>
                <option value="YEAR">Year</option>
              </select>
            </Field>
            <Field label="Reference date">
              <input
                type="date"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="ALL">All roles</option>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabel(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </Field>
            <Field label="Search">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, username, email..."
              />
            </Field>
          </div>
          <TableCard
            title="Expense Register"
            subtitle={`${rows.length} records · filters apply immediately`}
          >
            <DataTable minWidth={1250}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      {item.employee?.name || item.employee?.username || "N/A"}
                    </td>
                    <td>{item.employee?.email || "N/A"}</td>
                    <td>{roleLabel(item.employee?.role)}</td>
                    <td>{formatDate(item.expenseDate || item.createdAt)}</td>
                    <td>{item.category}</td>
                    <td className={styles.wrapCell}>{item.description}</td>
                    <td>{money(item.amount)}</td>
                    <td>
                      {item.receiptUrl ? (
                        <a
                          className={styles.documentLink}
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      ) : (
                        "Missing"
                      )}
                    </td>
                    <td>
                      <Status status={item.status} />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <EmptyRow
                    colSpan={10}
                    text="No expenses match the current automatic filters."
                  />
                )}
              </tbody>
            </DataTable>
          </TableCard>
        </article>
      </div>
    </SectionPage>
  );
}

function ExpenseEntryPage({
  data,
  busy,
  runAction,
  uploadFile,
  notify,
}: CommonPageProps) {
  const [form, setForm] = useState({
    employeeId: data.accountant?.id || data.users?.[0]?.id || "",
    category: "FUEL",
    description: "",
    amount: "",
    expenseDate: dateInput(),
    receiptUrl: "",
  });

  async function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      setForm((current) => ({ ...current, receiptUrl: url }));
      notify("Expense receipt uploaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await runAction("CREATE_EXPENSE", form);
    if (saved) {
      setForm((current) => ({
        ...current,
        description: "",
        amount: "",
        receiptUrl: "",
      }));
    }
  }

  return (
    <SectionPage
      title="Expense Entry"
      subtitle="Enter receipt-backed expenses for staff, brokers, branches or the accountant. Self-created expenses remain pending for another authorized approver."
      glyph="plus"
    >
      <div className={styles.twoColumn}>
        <form className={styles.formCard} onSubmit={submit}>
          <CardHeading
            title="New expense request"
            text="The expense does not affect the ledger until it is approved."
          />
          <div className={styles.formGrid}>
            <Field label="Expense owner">
              <select
                value={form.employeeId}
                onChange={(event) =>
                  setForm({ ...form, employeeId: event.target.value })
                }
                required
              >
                {safeArray<any>(data.users).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.email} — {roleLabel(item.role)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {[
                  "FUEL",
                  "TRANSPORT",
                  "AIRTIME",
                  "ACCOMMODATION",
                  "REPAIRS",
                  "STATIONERY",
                  "MEALS",
                  "OFFICE",
                  "EMERGENCY",
                  "OTHER",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="1"
                step="0.01"
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
          </div>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Describe what was purchased and why"
              required
            />
          </Field>
          <label className={styles.fileBox}>
            <Glyph name="upload" />
            <span>
              {form.receiptUrl ? "Receipt uploaded" : "Upload expense receipt"}
            </span>
            <input type="file" accept="image/*,.pdf" onChange={handleReceipt} />
          </label>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={busy || !form.receiptUrl}
          >
            <Glyph name="check" /> Submit expense
          </button>
        </form>

        <article className={styles.statusPanel}>
          <CardHeading
            title="Expense controls"
            text="These rules are enforced in the API, not only in the interface."
          />
          <ul className={styles.ruleList}>
            <li>A receipt is required.</li>
            <li>An accountant cannot approve their own request.</li>
            <li>Approval above the accountant limit is blocked.</li>
            <li>Approved expenses post to the cash book and general ledger.</li>
            <li>Locked periods reject new or changed expense postings.</li>
          </ul>
        </article>
      </div>
    </SectionPage>
  );
}

function ExpenseRegisterPage({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR">(
    "MONTH",
  );
  const [reference, setReference] = useState(dateInput());
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const range = useMemo(
    () => clientPeriodRange(period, reference),
    [period, reference],
  );
  const rows = useMemo(
    () =>
      safeArray<any>(data.expenses).filter((item) => {
        const time = new Date(item.expenseDate || item.createdAt).getTime();
        const owner = item.employee || {};
        const haystack =
          `${owner.name || ""} ${owner.email || ""} ${item.category || ""} ${item.description || ""}`.toLowerCase();
        return (
          time >= range.start.getTime() &&
          time <= range.end.getTime() &&
          (role === "ALL" || owner.role === role) &&
          (status === "ALL" || item.status === status) &&
          (!query.trim() || haystack.includes(query.trim().toLowerCase()))
        );
      }),
    [data.expenses, period, reference, query, role, status, range],
  );

  const roles = Array.from(
    new Set(
      safeArray<any>(data.users)
        .map((item) => item.role)
        .filter(Boolean),
    ),
  );

  return (
    <SectionPage
      title="Expense Register"
      subtitle="View expenses by employee name, username/email, role, status, day, week, month or year."
      glyph="receipt"
      action={<ReportButtons filename="expense-register" rows={rows} />}
    >
      <article className={styles.reportFilter}>
        <div className={styles.filterGrid}>
          <Field label="Period">
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as typeof period)
              }
            >
              <option value="DAY">Day</option>
              <option value="WEEK">Week</option>
              <option value="MONTH">Month</option>
              <option value="YEAR">Year</option>
            </select>
          </Field>
          <Field label="Reference date">
            <input
              type="date"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="ALL">All roles</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {roleLabel(item)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </Field>
          <Field label="Search name, email or description">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
            />
          </Field>
        </div>
      </article>

      <TableCard
        title="All Expenses"
        subtitle={`${rows.length} matching records`}
      >
        <DataTable minWidth={1300}>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Status</th>
              <th>Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.employee?.name || "N/A"}</td>
                <td>{item.employee?.email || "N/A"}</td>
                <td>{roleLabel(item.employee?.role)}</td>
                <td>{formatDate(item.expenseDate || item.createdAt)}</td>
                <td>{item.category}</td>
                <td className={styles.wrapCell}>{item.description}</td>
                <td>{money(item.amount)}</td>
                <td>
                  {item.receiptUrl ? (
                    <a
                      className={styles.documentLink}
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  ) : (
                    "Missing"
                  )}
                </td>
                <td>
                  <Status status={item.status} />
                </td>
                <td>{item.reviewedBy?.name || "Pending"}</td>
              </tr>
            ))}
            {!rows.length && (
              <EmptyRow
                colSpan={11}
                text="No expenses match the selected filters."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function CashBookPage({ data }: { data: DashboardData }) {
  return (
    <SectionPage
      title="Cash Book"
      subtitle="Verified deposits and approved expenses with a running balance."
      glyph="cash"
      action={<ReportButtons filename="cash-book" rows={data.cashBook} />}
    >
      <TableCard
        title="Cash Book Entries"
        subtitle={`${data.cashBook.length} posted transactions`}
      >
        <DataTable minWidth={1100}>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Running balance</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.cashBook).map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{formatDate(item.date, true)}</td>
                <td>{item.reference}</td>
                <td>{item.description}</td>
                <td>{item.account}</td>
                <td className={styles.debit}>
                  {item.debit ? money(item.debit) : "—"}
                </td>
                <td className={styles.credit}>
                  {item.credit ? money(item.credit) : "—"}
                </td>
                <td>{money(item.balance)}</td>
              </tr>
            ))}
            {!data.cashBook.length && (
              <EmptyRow colSpan={8} text="No posted cash-book transactions." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function LedgerPage({ data }: { data: DashboardData }) {
  return (
    <SectionPage
      title="General Ledger"
      subtitle="Account balances generated from completed services and approved expenses."
      glyph="ledger"
      action={<ReportButtons filename="general-ledger" rows={data.ledger} />}
    >
      <div className={styles.ledgerGrid}>
        {safeArray<any>(data.ledger).map((item) => (
          <article key={item.account} className={styles.ledgerCard}>
            <span>{item.account.slice(0, 2).toUpperCase()}</span>
            <div>
              <small>{item.account}</small>
              <strong>{money(Math.abs(item.balance))}</strong>
            </div>
            <Status status={item.balance >= 0 ? "DEBIT" : "CREDIT"} />
          </article>
        ))}
      </div>

      <TableCard
        title="Ledger Summary"
        subtitle="Debit and credit account positions"
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
              <th>Side</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.ledger).map((item, index) => (
              <tr key={item.account}>
                <td>{index + 1}</td>
                <td>{item.account}</td>
                <td>{money(item.debit)}</td>
                <td>{money(item.credit)}</td>
                <td>{money(Math.abs(item.balance))}</td>
                <td>
                  <Status status={item.balance >= 0 ? "DEBIT" : "CREDIT"} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function TrialBalancePage({ data }: { data: DashboardData }) {
  return (
    <SectionPage
      title="Trial Balance"
      subtitle="Debit and credit totals generated from the general ledger."
      glyph="trial"
    >
      <div className={styles.balanceBanner}>
        <div>
          <small>Total Debit</small>
          <strong>{money(data.trialBalance.totalDebit)}</strong>
        </div>
        <span
          className={
            data.trialBalance.balanced ? styles.balanceOkay : styles.balanceBad
          }
        >
          {data.trialBalance.balanced ? "BALANCED" : "OUT OF BALANCE"}
        </span>
        <div>
          <small>Total Credit</small>
          <strong>{money(data.trialBalance.totalCredit)}</strong>
        </div>
      </div>

      <TableCard
        title="Trial Balance Accounts"
        subtitle="Accounting equation control"
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>Account</th>
              <th>Debit balance</th>
              <th>Credit balance</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.trialBalance.rows).map((item, index) => (
              <tr key={item.account}>
                <td>{index + 1}</td>
                <td>{item.account}</td>
                <td>{item.balance >= 0 ? money(item.balance) : "—"}</td>
                <td>
                  {item.balance < 0 ? money(Math.abs(item.balance)) : "—"}
                </td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <td colSpan={2}>TOTAL</td>
              <td>{money(data.trialBalance.totalDebit)}</td>
              <td>{money(data.trialBalance.totalCredit)}</td>
            </tr>
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function StatementPage({
  type,
  data,
}: {
  type: "BALANCE_SHEET" | "PROFIT_LOSS" | "CASH_FLOW";
  data: DashboardData;
}) {
  const statements = data.statements;

  if (type === "BALANCE_SHEET") {
    const statement = statements.balanceSheet || {};
    const assets = safeArray<any>(statement.assets);
    const liabilities = safeArray<any>(statement.liabilities);
    const equity = safeArray<any>(statement.equity);
    const reportRows = [
      ...assets.map((row) => ({ section: "Asset", ...row })),
      ...liabilities.map((row) => ({ section: "Liability", ...row })),
      ...equity.map((row) => ({ section: "Equity", ...row })),
    ];

    return (
      <SectionPage
        title="Balance Sheet"
        subtitle={`Statement of financial position as of ${formatDate(statement.asOf || new Date())}.`}
        glyph="balance"
        action={<ReportButtons filename="balance-sheet" rows={reportRows} />}
      >
        <div className={styles.balanceSheetControl}>
          <div>
            <small>Total Assets</small>
            <strong>{money(statement.totalAssets)}</strong>
          </div>
          <span
            className={
              statement.balanced ? styles.balanceOkay : styles.balanceBad
            }
          >
            {statement.balanced
              ? "ACCOUNTING EQUATION BALANCED"
              : `DIFFERENCE ${money(statement.difference)}`}
          </span>
          <div>
            <small>Liabilities + Equity</small>
            <strong>{money(statement.liabilitiesAndEquity)}</strong>
          </div>
        </div>

        <div className={styles.statementGrid}>
          <StatementColumn
            title="Assets"
            rows={assets.map((row) => [
              `${row.code} · ${row.name}`,
              Number(row.amount),
            ])}
            total={Number(statement.totalAssets || 0)}
          />
          <div className={styles.statementStack}>
            <StatementColumn
              title="Liabilities"
              rows={liabilities.map((row) => [
                `${row.code} · ${row.name}`,
                Number(row.amount),
              ])}
              total={Number(statement.totalLiabilities || 0)}
            />
            <StatementColumn
              title="Equity"
              rows={equity.map((row) => [
                `${row.code} · ${row.name}`,
                Number(row.amount),
              ])}
              total={Number(statement.totalEquity || 0)}
            />
          </div>
        </div>

        <TableCard
          title="Balance Sheet Account Detail"
          subtitle="Balances generated from posted double-entry journal lines"
        >
          <DataTable minWidth={900}>
            <thead>
              <tr>
                <th>#</th>
                <th>Section</th>
                <th>Code</th>
                <th>Account</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row, index) => (
                <tr key={`${row.section}-${row.code}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{row.section}</td>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{money(row.amount)}</td>
                </tr>
              ))}
              {!reportRows.length && (
                <EmptyRow
                  colSpan={5}
                  text="No posted ledger balances are available."
                />
              )}
            </tbody>
          </DataTable>
        </TableCard>
      </SectionPage>
    );
  }

  if (type === "CASH_FLOW") {
    const statement = statements.cashFlow || {};
    const rows = safeArray<any>(statement.rows);
    return (
      <SectionPage
        title="Cash Flow Statement"
        subtitle="Cash received, cash paid, net movement and closing cash from the cash book."
        glyph="flow"
        action={<ReportButtons filename="cash-flow-statement" rows={rows} />}
      >
        <div className={styles.metricGrid}>
          <MetricCard
            label="Opening Cash"
            value={money(statement.openingCash)}
            theme="peach"
            note="Beginning balance"
          />
          <MetricCard
            label="Cash Inflow"
            value={money(statement.operatingInflow)}
            theme="blue"
            note="Total cash received"
          />
          <MetricCard
            label="Cash Outflow"
            value={money(statement.operatingOutflow)}
            theme="orange"
            note="Total cash paid"
          />
          <MetricCard
            label="Closing Cash"
            value={money(statement.closingCash)}
            theme="yellow"
            note={`Net movement ${money(statement.netCashFlow)}`}
          />
        </div>
        <GlassCard
          title="Cash Flow Movement"
          subtitle="Last 30 days of inflow, outflow and net movement"
        >
          <CashFlowChart rows={safeArray<any>(statement.series)} />
        </GlassCard>
        <TableCard
          title="Cash Flow Transactions"
          subtitle={`${rows.length} cash-book movements`}
        >
          <DataTable minWidth={1150}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Cash In</th>
                <th>Cash Out</th>
                <th>Net</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{formatDate(item.date, true)}</td>
                  <td>{item.reference}</td>
                  <td>{item.description}</td>
                  <td className={styles.debit}>
                    {item.inflow ? money(item.inflow) : "—"}
                  </td>
                  <td className={styles.credit}>
                    {item.outflow ? money(item.outflow) : "—"}
                  </td>
                  <td>{money(item.net)}</td>
                  <td>{money(item.balance)}</td>
                </tr>
              ))}
              {!rows.length && (
                <EmptyRow
                  colSpan={8}
                  text="No cash flow transactions have been posted."
                />
              )}
            </tbody>
          </DataTable>
        </TableCard>
      </SectionPage>
    );
  }

  const statement = statements.profitAndLoss || {};
  const rows = safeArray<any>(statement.transactions);
  return (
    <SectionPage
      title="Profit & Loss"
      subtitle="Complete posted revenue and expense activity from the general ledger."
      glyph="profit"
      action={<ReportButtons filename="profit-and-loss" rows={rows} />}
    >
      <div className={styles.metricGrid}>
        <MetricCard
          label="Total Revenue"
          value={money(statement.revenue)}
          theme="blue"
          note="Credit balances in revenue accounts"
        />
        <MetricCard
          label="Total Expenses"
          value={money(statement.expenses)}
          theme="orange"
          note="Debit balances in expense accounts"
        />
        <MetricCard
          label="Net Profit"
          value={money(statement.netProfit)}
          theme="yellow"
          note="Revenue less expenses"
        />
        <MetricCard
          label="Transactions"
          value={String(rows.length)}
          theme="peach"
          note="Posted P&L journal entries"
        />
      </div>
      <div className={styles.statementHero}>
        <small>Net Profit / Loss</small>
        <strong>{money(statement.netProfit)}</strong>
        <span>
          {Number(statement.netProfit) >= 0
            ? "Profit for the selected accounting records"
            : "Loss: expenses exceed revenue"}
        </span>
      </div>
      <TableCard
        title="Profit & Loss Transaction Detail"
        subtitle="Every posted transaction that affected revenue or expense"
      >
        <DataTable minWidth={1250}>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Source</th>
              <th>Revenue</th>
              <th>Expense</th>
              <th>Net Effect</th>
              <th>Posted By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{formatDate(item.date, true)}</td>
                <td>{item.reference}</td>
                <td className={styles.wrapCell}>{item.description}</td>
                <td>{roleLabel(item.sourceType)}</td>
                <td className={styles.debit}>
                  {item.revenue ? money(item.revenue) : "—"}
                </td>
                <td className={styles.credit}>
                  {item.expense ? money(item.expense) : "—"}
                </td>
                <td>{money(item.net)}</td>
                <td>
                  {item.postedBy?.name || item.postedBy?.email || "System"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <EmptyRow
                colSpan={9}
                text="No revenue or expense journal entries are available."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function BankReconciliationPage({
  data,
  busy,
  runAction,
  uploadFile,
  notify,
}: CommonPageProps) {
  const deposits = safeArray<any>(data.deposits);
  const [selectedId, setSelectedId] = useState(deposits[0]?.id || "");
  const [form, setForm] = useState({
    statementAmount: "",
    statementReference: "",
    statementDate: "",
    statementBankAccount: "",
    bankStatementUrl: "",
    investigationNote: "",
  });

  const selected =
    deposits.find((item) => item.id === selectedId) ?? deposits[0] ?? null;

  useEffect(() => {
    if (!selectedId && deposits[0]?.id) {
      setSelectedId(deposits[0].id);
    }
  }, [selectedId, deposits]);

  async function handleStatement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file);
      setForm((current) => ({
        ...current,
        bankStatementUrl: url,
      }));
      notify("Bank statement uploaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function review() {
    if (!selected) return;

    await runAction("REVIEW_DEPOSIT", {
      depositId: selected.id,
      ...form,
    });
  }

  async function clearHold() {
    if (!selected) return;

    await runAction("CLEAR_FINANCIAL_HOLD", {
      depositId: selected.id,
      investigationNote: form.investigationNote,
    });
  }

  return (
    <SectionPage
      title="Bank Reconciliation"
      subtitle="Compare staff deposits against bank statements and enforce financial holds."
      glyph="bank"
    >
      <div className={styles.metricGrid}>
        <MetricCard
          label="Pending"
          value={String(data.stats.pendingDeposits || 0)}
          theme="blue"
          note="Waiting for statement review"
        />
        <MetricCard
          label="Verified"
          value={String(
            deposits.filter((item) => item.status === "VERIFIED").length,
          )}
          theme="yellow"
          note="Posted to cash records"
        />
        <MetricCard
          label="Mismatches"
          value={String(data.stats.unresolvedMismatches || 0)}
          theme="orange"
          note="Day closing blocked"
        />
        <MetricCard
          label="Financial Holds"
          value={String(data.financialHolds.length)}
          theme="peach"
          note="Staff cannot submit another deposit"
        />
      </div>

      <div className={styles.bankLayout}>
        <TableCard
          title="Staff Bank Deposits"
          subtitle="Select a deposit to investigate"
        >
          <DataTable minWidth={1100}>
            <thead>
              <tr>
                <th>#</th>
                <th>Staff</th>
                <th>Reference</th>
                <th>Deposit date</th>
                <th>Bank account</th>
                <th>Amount</th>
                <th>Documents</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Entity
                      name={item.staff?.name || "Staff"}
                      sub={roleLabel(item.staff?.role)}
                    />
                  </td>
                  <td>{item.referenceNo || "N/A"}</td>
                  <td>{formatDate(item.depositDate)}</td>
                  <td>{item.bankAccount || "N/A"}</td>
                  <td>{money(item.amount)}</td>
                  <td>
                    <DocumentLinks
                      documents={[
                        ["Slip", item.depositSlipUrl],
                        ["Receipt", item.bankReceiptUrl],
                        ["Statement", item.bankStatementUrl],
                      ]}
                    />
                  </td>
                  <td>
                    <Status status={item.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.miniButton}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <Glyph name="eye" /> Open
                    </button>
                  </td>
                </tr>
              ))}
              {!deposits.length && (
                <EmptyRow colSpan={9} text="No staff deposits found." />
              )}
            </tbody>
          </DataTable>
        </TableCard>

        <article className={styles.reviewPanel}>
          <CardHeading
            title={
              selected
                ? `Review ${selected.referenceNo || selected.id}`
                : "Select a deposit"
            }
            text={
              selected
                ? `${selected.staff?.name || "Staff"} · ${money(selected.amount)}`
                : "Choose a deposit from the table."
            }
          />

          {selected && (
            <>
              <div className={styles.detailGrid}>
                <Detail label="Staff amount" value={money(selected.amount)} />
                <Detail
                  label="Deposit date"
                  value={formatDate(selected.depositDate)}
                />
                <Detail
                  label="Bank account"
                  value={selected.bankAccount || "N/A"}
                />
                <Detail
                  label="Current status"
                  value={safeText(selected.status)}
                />
              </div>

              <label className={styles.fileBox}>
                <Glyph name="upload" />
                <span>
                  {form.bankStatementUrl
                    ? "Bank statement uploaded"
                    : "Upload PDF, Excel or CSV statement"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.csv,.xls,.xlsx"
                  onChange={handleStatement}
                />
              </label>

              <div className={styles.formGrid}>
                <Field label="Statement amount">
                  <input
                    type="number"
                    value={form.statementAmount}
                    onChange={(event) =>
                      setForm({ ...form, statementAmount: event.target.value })
                    }
                    placeholder={safeText(selected.amount)}
                  />
                </Field>
                <Field label="Statement reference">
                  <input
                    value={form.statementReference}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        statementReference: event.target.value,
                      })
                    }
                    placeholder={selected.referenceNo || ""}
                  />
                </Field>
                <Field label="Statement date">
                  <input
                    type="date"
                    value={form.statementDate}
                    onChange={(event) =>
                      setForm({ ...form, statementDate: event.target.value })
                    }
                  />
                </Field>
                <Field label="Statement bank account">
                  <input
                    value={form.statementBankAccount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        statementBankAccount: event.target.value,
                      })
                    }
                    placeholder={selected.bankAccount || ""}
                  />
                </Field>
              </div>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={review}
                disabled={busy}
              >
                <Glyph name="check" /> Compare and verify
              </button>

              {[
                "AMOUNT_MISMATCH",
                "MISSING_RECEIPT",
                "DUPLICATE_DEPOSIT",
                "MISSING_BANK_RECORD",
              ].includes(selected.status) && (
                <div className={styles.holdBox}>
                  <Glyph name="warning" />
                  <div>
                    <strong>Financial Hold Active</strong>
                    <p>
                      {selected.mismatchReason ||
                        "This deposit requires investigation."}
                    </p>
                    <textarea
                      value={form.investigationNote}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          investigationNote: event.target.value,
                        })
                      }
                      placeholder="Investigation findings required before clearing..."
                    />
                    <button type="button" onClick={clearHold} disabled={busy}>
                      Clear hold after investigation
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </SectionPage>
  );
}

function ExpenseApprovalPage({ data, busy, runAction }: CommonPageProps) {
  const [note, setNote] = useState("");
  const expenses = safeArray<any>(data.expenses);

  return (
    <SectionPage
      title="Expense Approval"
      subtitle="No expense affects accounting until approved by the Accountant."
      glyph="expense"
    >
      <ExpenseWorkflow />

      <div className={styles.metricGrid}>
        <MetricCard
          label="Pending Requests"
          value={String(
            expenses.filter((item) => item.status === "PENDING").length,
          )}
          theme="blue"
          note="Awaiting accountant review"
        />
        <MetricCard
          label="Approved"
          value={moneyShort(
            expenses
              .filter((item) => item.status === "APPROVED")
              .reduce((sum, item) => sum + Number(item.amount), 0),
          )}
          theme="yellow"
          note="Posted to financial records"
        />
        <MetricCard
          label="Rejected"
          value={String(
            expenses.filter((item) => item.status === "REJECTED").length,
          )}
          theme="orange"
          note="Not posted to accounts"
        />
        <MetricCard
          label="Categories"
          value={String(new Set(expenses.map((item) => item.category)).size)}
          theme="peach"
          note="Fuel, transport, airtime and more"
        />
      </div>

      <article className={styles.noteCard}>
        <Field label="Review note">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Approval reason, correction or rejection explanation..."
          />
        </Field>
      </article>

      <TableCard
        title="Employee Expense Requests"
        subtitle="Receipt-backed expense workflow"
      >
        <DataTable minWidth={1250}>
          <thead>
            <tr>
              <th>#</th>
              <th>Employee</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Submitted</th>
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
                    name={item.employee?.name || "Employee"}
                    sub={`${item.employee?.email || ""} · ${roleLabel(item.employee?.role)}`}
                  />
                </td>
                <td>{item.category}</td>
                <td className={styles.wrapCell}>{item.description || "N/A"}</td>
                <td>{money(item.amount)}</td>
                <td>
                  {item.receiptUrl ? (
                    <a
                      className={styles.documentLink}
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Glyph name="eye" /> Receipt
                    </a>
                  ) : (
                    <Status status="MISSING" />
                  )}
                </td>
                <td>{formatDate(item.createdAt, true)}</td>
                <td>
                  <Status status={item.status} />
                </td>
                <td>{item.reviewedBy?.name || "Pending"}</td>
                <td>
                  {item.status === "PENDING" ? (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.approveButton}
                        disabled={
                          busy ||
                          item.employeeId === data.accountant?.id ||
                          item.createdById === data.accountant?.id
                        }
                        title={
                          item.employeeId === data.accountant?.id ||
                          item.createdById === data.accountant?.id
                            ? "You cannot approve your own expense"
                            : "Approve expense"
                        }
                        onClick={() =>
                          void runAction("APPROVE_EXPENSE", {
                            expenseId: item.id,
                            reviewNote: note,
                          })
                        }
                      >
                        <Glyph name="check" /> Approve
                      </button>
                      <button
                        type="button"
                        className={styles.rejectButton}
                        disabled={
                          busy ||
                          item.employeeId === data.accountant?.id ||
                          item.createdById === data.accountant?.id
                        }
                        title={
                          item.employeeId === data.accountant?.id ||
                          item.createdById === data.accountant?.id
                            ? "Another authorized reviewer must decide this expense"
                            : "Reject expense"
                        }
                        onClick={() =>
                          void runAction("REJECT_EXPENSE", {
                            expenseId: item.id,
                            reviewNote: note,
                          })
                        }
                      >
                        <Glyph name="x" /> Reject
                      </button>
                    </div>
                  ) : (
                    <small>{item.reviewNote || "Reviewed"}</small>
                  )}
                </td>
              </tr>
            ))}
            {!expenses.length && (
              <EmptyRow colSpan={10} text="No expense requests found." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function FloatVerificationPage({ data, busy, runAction }: CommonPageProps) {
  const rows = safeArray<any>(data.floats);

  return (
    <SectionPage
      title="Float Verification"
      subtitle="Staff must upload a receipt or return document. A float settlement increases cash and reduces float receivable; it increases income only when the accountant explicitly classifies verified earned revenue."
      glyph="float"
    >
      <div className={styles.metricGrid}>
        <MetricCard
          label="Outstanding Float"
          value={moneyShort(data.stats.outstandingFloat)}
          theme="peach"
          note="Pending, issued or confirmed"
        />
        <MetricCard
          label="Pending Review"
          value={String(data.stats.pendingFloats || 0)}
          theme="blue"
          note="Receipt-backed verification required"
        />
        <MetricCard
          label="Approved"
          value={String(
            rows.filter((item) => item.status === "APPROVED").length,
          )}
          theme="yellow"
          note="Posted transactions"
        />
        <MetricCard
          label="Returned"
          value={String(
            rows.filter((item) => item.status === "RETURNED").length,
          )}
          theme="orange"
          note="Collections returned"
        />
      </div>

      <TableCard
        title="Float Transactions"
        subtitle="Receipt-backed float verification"
      >
        <DataTable minWidth={1350}>
          <thead>
            <tr>
              <th>#</th>
              <th>From</th>
              <th>To</th>
              <th>Email</th>
              <th>Purpose</th>
              <th>Issued</th>
              <th>Returned</th>
              <th>Receipt</th>
              <th>Status</th>
              <th>Created</th>
              <th>Confirmed</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.fromUser?.name || "Company"}</td>
                <td>{item.toUser?.name || "Company"}</td>
                <td>{item.toUser?.email || item.fromUser?.email || "N/A"}</td>
                <td className={styles.wrapCell}>
                  {item.purpose || "Operational float"}
                </td>
                <td>{money(item.amount)}</td>
                <td>{money(item.returnedAmount || item.amount)}</td>
                <td>
                  {item.receiptUrl ? (
                    <a
                      className={styles.documentLink}
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Glyph name="eye" /> Receipt
                    </a>
                  ) : (
                    <Status status="MISSING_RECEIPT" />
                  )}
                </td>
                <td>
                  <Status status={item.status} />
                </td>
                <td>{formatDate(item.createdAt, true)}</td>
                <td>{formatDate(item.confirmedAt, true)}</td>
                <td>
                  {["PENDING", "ISSUED", "CONFIRMED", "RETURNED"].includes(
                    item.status,
                  ) ? (
                    <FloatDecision
                      item={item}
                      busy={busy}
                      runAction={runAction}
                    />
                  ) : (
                    "Completed"
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <EmptyRow colSpan={12} text="No float transactions found." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function FloatDecision({
  item,
  busy,
  runAction,
}: {
  item: any;
  busy: boolean;
  runAction: CommonPageProps["runAction"];
}) {
  const [classification, setClassification] = useState("FLOAT_SETTLEMENT");

  return (
    <div className={styles.floatDecision}>
      <select
        value={classification}
        onChange={(event) => setClassification(event.target.value)}
      >
        <option value="FLOAT_SETTLEMENT">Float settlement</option>
        <option value="REVENUE">Earned revenue</option>
      </select>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.approveButton}
          disabled={busy || !item.receiptUrl}
          onClick={() =>
            void runAction("APPROVE_FLOAT", {
              floatId: item.id,
              classification,
            })
          }
        >
          <Glyph name="check" /> Verify
        </button>
        <button
          type="button"
          className={styles.rejectButton}
          disabled={busy}
          onClick={() => void runAction("REJECT_FLOAT", { floatId: item.id })}
        >
          <Glyph name="x" /> Reject
        </button>
      </div>
    </div>
  );
}

function ReportsPage({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR">(
    "MONTH",
  );
  const [reference, setReference] = useState(dateInput());
  const range = useMemo(
    () => clientPeriodRange(period, reference),
    [period, reference],
  );

  function inside(value: unknown) {
    const time = new Date(String(value)).getTime();
    return time >= range.start.getTime() && time <= range.end.getTime();
  }

  const filteredDays = useMemo(
    () =>
      safeArray<any>(data.financialDays).filter((item) => inside(item.date)),
    [data.financialDays, range],
  );
  const filteredExpenses = useMemo(
    () =>
      safeArray<any>(data.expenses).filter((item) =>
        inside(item.expenseDate || item.createdAt),
      ),
    [data.expenses, range],
  );
  const filteredDeposits = useMemo(
    () =>
      safeArray<any>(data.deposits).filter((item) => inside(item.depositDate)),
    [data.deposits, range],
  );

  const reportRows = [
    ...filteredDays,
    ...filteredExpenses,
    ...filteredDeposits,
  ];
  const label = `${formatDate(range.start)} — ${formatDate(range.end)}`;
  const reportTrend = useMemo(() => {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    const width = Math.max(1, endMs - startMs + 1);
    const buckets = Array.from({ length: 8 }, (_, index) => {
      const bucketStart = new Date(startMs + (width * index) / 8);
      const bucketEnd = new Date(startMs + (width * (index + 1)) / 8 - 1);
      return {
        key: `${bucketStart.toISOString()}-${index}`,
        label:
          period === "DAY"
            ? bucketStart.toLocaleTimeString("en-TZ", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : bucketStart.toLocaleDateString("en-TZ", {
                day: "2-digit",
                month: "short",
              }),
        start: bucketStart.getTime(),
        end: bucketEnd.getTime(),
        income: 0,
        expense: 0,
        deposit: 0,
      };
    });

    for (const item of safeArray<any>(data.cashBook)) {
      const time = new Date(item.date).getTime();
      const bucket = buckets.find(
        (entry) => time >= entry.start && time <= entry.end,
      );
      if (!bucket) continue;
      bucket.income += Number(item.debit || 0);
      bucket.expense += Number(item.credit || 0);
      if (item.type === "BANK_DEPOSIT")
        bucket.deposit += Number(item.debit || 0);
    }

    return buckets.map(({ start, end, ...item }) => item);
  }, [data.cashBook, range, period]);

  return (
    <SectionPage
      title="Financial Reports"
      subtitle="Filter, print and export real accounting data by day, week, month or year."
      glyph="report"
      action={<PrintButton />}
    >
      <article className={styles.reportFilter}>
        <div className={styles.filterGrid}>
          <Field label="Period">
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as typeof period)
              }
            >
              <option value="DAY">Day</option>
              <option value="WEEK">Week</option>
              <option value="MONTH">Month</option>
              <option value="YEAR">Year</option>
            </select>
          </Field>
          <Field label="Reference date">
            <input
              type="date"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          <div className={styles.reportRangeLabel}>{label}</div>
        </div>
        <ReportButtons
          filename={`financial-report-${period.toLowerCase()}-${reference}`}
          rows={reportRows}
        />
      </article>

      <div className={styles.reportCardGrid}>
        <ReportSummaryCard
          title="Financial Days"
          value={String(filteredDays.length)}
          note={`${filteredDays.filter((item) => item.status === "CLOSED").length} closed`}
          glyph="calendar"
        />
        <ReportSummaryCard
          title="Verified Deposits"
          value={moneyShort(
            filteredDeposits
              .filter((item) => item.status === "VERIFIED")
              .reduce((sum, item) => sum + Number(item.amount), 0),
          )}
          note={`${filteredDeposits.length} deposit records`}
          glyph="bank"
        />
        <ReportSummaryCard
          title="Approved Expenses"
          value={moneyShort(
            filteredExpenses
              .filter((item) => item.status === "APPROVED")
              .reduce((sum, item) => sum + Number(item.amount), 0),
          )}
          note={`${filteredExpenses.length} expense records`}
          glyph="expense"
        />
        <ReportSummaryCard
          title="Net Cash Movement"
          value={moneyShort(
            filteredDeposits
              .filter((item) => item.status === "VERIFIED")
              .reduce((sum, item) => sum + Number(item.amount), 0) -
              filteredExpenses
                .filter((item) => item.status === "APPROVED")
                .reduce((sum, item) => sum + Number(item.amount), 0),
          )}
          note="Deposits less approved expenses"
          glyph="flow"
        />
      </div>

      <div className={styles.chartGrid}>
        <GlassCard title="Cash In and Cash Out Trend" subtitle={label}>
          <EarningsChart rows={reportTrend} />
        </GlassCard>
        <GlassCard title="Cash and Deposit Breakdown" subtitle={label}>
          <BreakdownChart rows={reportTrend} />
        </GlassCard>
      </div>

      <TableCard title="Filtered Financial Days" subtitle={label}>
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
            {filteredDays.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.date)}</td>
                <td>{money(item.openingBalance)}</td>
                <td>{money(item.cashIn)}</td>
                <td>{money(item.cashOut)}</td>
                <td>{money(item.closingBalance)}</td>
                <td>
                  <Status status={item.status} />
                </td>
              </tr>
            ))}
            {!filteredDays.length && (
              <EmptyRow colSpan={6} text="No financial days in this period." />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function PeriodsPage({ data, busy, runAction }: CommonPageProps) {
  const [form, setForm] = useState({
    periodKey: monthInput(),
    reason: "",
  });

  return (
    <SectionPage
      title="Lock Accounting Periods"
      subtitle="Prevent posting into completed months after all financial days are closed."
      glyph="lock"
    >
      {data.features?.accountingPeriods === false && (
        <div className={styles.featureWarning}>
          <Glyph name="warning" />
          <div>
            <strong>AccountingPeriod Prisma model is not active yet</strong>
            <p>
              The portal remains available, but period locking requires the
              included Prisma migration and a freshly generated client.
            </p>
          </div>
        </div>
      )}

      <div className={styles.twoColumn}>
        <article className={styles.formCard}>
          <CardHeading
            title="Period control"
            text="A locked period rejects new expense, bank and day postings."
          />

          <Field label="Accounting month">
            <input
              type="month"
              value={form.periodKey}
              onChange={(event) =>
                setForm({ ...form, periodKey: event.target.value })
              }
            />
          </Field>

          <Field label="Reason">
            <textarea
              value={form.reason}
              onChange={(event) =>
                setForm({ ...form, reason: event.target.value })
              }
              placeholder="Month-end close, audit completion or management instruction..."
            />
          </Field>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy || data.features?.accountingPeriods === false}
            onClick={() => void runAction("LOCK_PERIOD", form)}
          >
            <Glyph name="lock" /> Lock accounting period
          </button>
        </article>

        <article className={styles.statusPanel}>
          <CardHeading
            title="Locking rules"
            text="The system protects finalized financial records."
          />

          <ul className={styles.ruleList}>
            <li>All financial days in the month must be closed.</li>
            <li>Bank mismatches must be resolved.</li>
            <li>Approved expenses remain unchanged.</li>
            <li>
              Accountants may request reopening; only Company Admin approval
              reopens a locked period.
            </li>
          </ul>
        </article>
      </div>

      <TableCard
        title="Accounting Period Register"
        subtitle="Open and locked months"
      >
        <DataTable>
          <thead>
            <tr>
              <th>#</th>
              <th>Period</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th>Locked by</th>
              <th>Reason</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {safeArray<any>(data.periods).map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.label}</td>
                <td>{formatDate(item.startsAt)}</td>
                <td>{formatDate(item.endsAt)}</td>
                <td>
                  <Status status={item.status} />
                </td>
                <td>{item.lockedBy?.name || "N/A"}</td>
                <td className={styles.wrapCell}>{item.reason || "N/A"}</td>
                <td>
                  {item.status === "LOCKED" ? (
                    <button
                      type="button"
                      className={styles.miniButton}
                      disabled={busy}
                      onClick={() =>
                        void runAction("REQUEST_PERIOD_REOPEN", {
                          periodKey: item.periodKey,
                          reason: "Accountant requested Company Admin approval",
                        })
                      }
                    >
                      Request reopen
                    </button>
                  ) : (
                    <Status status="OPEN" />
                  )}
                </td>
              </tr>
            ))}
            {!data.periods.length && (
              <EmptyRow
                colSpan={8}
                text="No accounting periods have been registered."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function AttendancePage({ data, busy, runAction }: CommonPageProps) {
  const [period, setPeriod] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR">(
    "WEEK",
  );
  const [reference, setReference] = useState(dateInput());
  const [form, setForm] = useState({
    userId: data.users?.[0]?.id || "",
    date: dateInput(),
    status: "PRESENT",
    notes: "",
  });

  const range = useMemo(
    () => clientPeriodRange(period, reference),
    [period, reference],
  );

  const records = useMemo(
    () =>
      safeArray<any>(data.attendance).filter((item) => {
        const time = new Date(item.date).getTime();
        return time >= range.start.getTime() && time <= range.end.getTime();
      }),
    [data.attendance, range],
  );

  const summary = attendanceSummary(records);

  return (
    <SectionPage
      title="Attendance Management"
      subtitle="Automatic attendance from float activity, return deadlines and GPS movement."
      glyph="attendance"
      action={
        <button
          type="button"
          className={styles.headerButton}
          disabled={busy}
          onClick={() =>
            void runAction("SYNC_ATTENDANCE", {
              date: reference,
              cutoffHour: 18,
            })
          }
        >
          <Glyph name="refresh" /> Generate automatically
        </button>
      }
    >
      <div className={styles.periodBar}>
        <div>
          {(["DAY", "WEEK", "MONTH", "YEAR"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={period === item ? styles.activePeriod : ""}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <Field label="Reference date">
          <input
            type="date"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
        <span>
          {formatDate(range.start)} — {formatDate(range.end)}
        </span>
      </div>

      <div className={styles.metricGrid}>
        <MetricCard
          label="Present"
          value={String(summary.present)}
          theme="yellow"
          note="Returned within deadline"
        />
        <MetricCard
          label="Late"
          value={String(summary.late)}
          theme="orange"
          note="Returned after cutoff"
        />
        <MetricCard
          label="Absent"
          value={String(summary.absent)}
          theme="peach"
          note="Failed operational rules"
        />
        <MetricCard
          label="Attendance Rate"
          value={`${summary.rate}%`}
          theme="blue"
          note={`${summary.attended}/${summary.working} attendance`}
        />
      </div>

      <article className={styles.adjustmentCard}>
        <CardHeading
          title="Approved manual adjustment"
          text="Manual changes require Accountant or Company Admin approval."
        />
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            void runAction("ADJUST_ATTENDANCE", form);
          }}
        >
          <Field label="User">
            <select
              value={form.userId}
              onChange={(event) =>
                setForm({ ...form, userId: event.target.value })
              }
            >
              {safeArray<any>(data.users).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {roleLabel(item.role)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </Field>
          <Field label="Approval notes">
            <input
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              placeholder="Reason for adjustment"
            />
          </Field>
          <button type="submit" disabled={busy}>
            Save adjustment
          </button>
        </form>
      </article>

      <ClassAttendanceGrid
        users={safeArray<any>(data.users)}
        records={records}
        selectedDate={reference}
        busy={busy}
        runAction={runAction}
      />

      <TableCard
        title="Attendance Register"
        subtitle={`${records.length} records in selected period`}
      >
        <DataTable minWidth={1100}>
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Role</th>
              <th>Date</th>
              <th>Status</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Source</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  <Entity
                    name={item.user?.name || "User"}
                    sub={item.user?.email || ""}
                  />
                </td>
                <td>{roleLabel(item.user?.role)}</td>
                <td>{formatDate(item.date)}</td>
                <td>
                  <Status status={item.status} />
                </td>
                <td>{formatDate(item.checkInAt, true)}</td>
                <td>{formatDate(item.checkOutAt, true)}</td>
                <td>{safeText(item.source).replaceAll("_", " ")}</td>
                <td className={styles.wrapCell}>{item.notes || "N/A"}</td>
              </tr>
            ))}
            {!records.length && (
              <EmptyRow
                colSpan={9}
                text="No attendance records in this period."
              />
            )}
          </tbody>
        </DataTable>
      </TableCard>
    </SectionPage>
  );
}

function NotificationsPage({ data, busy, runAction }: CommonPageProps) {
  return (
    <SectionPage
      title="Notifications"
      subtitle="SMS, email and in-app financial event center."
      glyph="bell"
      action={
        <button
          type="button"
          className={styles.headerButton}
          disabled={busy}
          onClick={() => void runAction("MARK_ALL_NOTIFICATIONS_READ")}
        >
          <Glyph name="check" /> Mark all read
        </button>
      }
    >
      <div className={styles.eventStrip}>
        {[
          "Float approved",
          "Float confirmed",
          "Expense approved",
          "Expense rejected",
          "Bank mismatch",
          "Deposit verified",
          "Attendance warning",
          "GPS alert",
          "Day opened",
          "Day closed",
          "Low cash balance",
          "Outstanding float reminder",
        ].map((event) => (
          <span key={event}>{event}</span>
        ))}
      </div>

      <div className={styles.notificationGrid}>
        {safeArray<any>(data.notifications).map((item) => (
          <article
            key={item.id}
            className={`${styles.notificationCard} ${
              item.isRead ? styles.notificationRead : ""
            }`}
          >
            <span>
              <Glyph
                name={
                  item.type === "ERROR"
                    ? "warning"
                    : item.type === "SUCCESS"
                      ? "check"
                      : "bell"
                }
              />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              <small>{formatDate(item.createdAt, true)}</small>
            </div>
            {!item.isRead && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction("MARK_NOTIFICATION_READ", {
                    notificationId: item.id,
                  })
                }
              >
                Mark read
              </button>
            )}
          </article>
        ))}
        {!data.notifications.length && <Empty text="No notifications found." />}
      </div>
    </SectionPage>
  );
}

function ClassAttendanceGrid({
  users,
  records,
  selectedDate,
  busy,
  runAction,
}: {
  users: any[];
  records: any[];
  selectedDate: string;
  busy: boolean;
  runAction: CommonPageProps["runAction"];
}) {
  const selectedKey = dateInput(selectedDate);
  const dayRows = records.filter(
    (item) => dateInput(item.date) === selectedKey,
  );

  return (
    <article className={styles.classAttendance}>
      <header>
        <div>
          <h3>Daily Class Attendance</h3>
          <p>
            ✓ marks present, ✕ marks absent. Missing rows remain unfilled and
            trigger company notifications.
          </p>
        </div>
        <button
          type="button"
          className={styles.headerButton}
          disabled={busy}
          onClick={() =>
            void runAction("GENERATE_ATTENDANCE_ALERTS", { date: selectedDate })
          }
        >
          <Glyph name="bell" /> Send missing-attendance alert
        </button>
      </header>
      <div className={styles.attendanceRoster}>
        {users.map((person, index) => {
          const record = dayRows.find(
            (item) => item.userId === person.id || item.user?.id === person.id,
          );
          return (
            <div className={styles.attendancePerson} key={person.id}>
              <span className={styles.rollNumber}>{index + 1}</span>
              <Entity
                name={person.name || "User"}
                sub={`${person.email || ""} · ${roleLabel(person.role)}`}
              />
              <div className={styles.attendanceMarks}>
                <button
                  type="button"
                  className={
                    record?.status === "PRESENT"
                      ? styles.markPresentActive
                      : styles.markPresent
                  }
                  disabled={busy}
                  title="Mark present"
                  onClick={() =>
                    void runAction("MARK_ATTENDANCE", {
                      userId: person.id,
                      date: selectedDate,
                      status: "PRESENT",
                    })
                  }
                >
                  ✓
                </button>
                <button
                  type="button"
                  className={
                    record?.status === "ABSENT"
                      ? styles.markAbsentActive
                      : styles.markAbsent
                  }
                  disabled={busy}
                  title="Mark absent"
                  onClick={() =>
                    void runAction("MARK_ATTENDANCE", {
                      userId: person.id,
                      date: selectedDate,
                      status: "ABSENT",
                    })
                  }
                >
                  ✕
                </button>
              </div>
              <span className={styles.attendanceResult}>
                {record ? roleLabel(record.status) : "Not filled"}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ProfilePage({
  data,
  busy,
  runAction,
  uploadFile,
  notify,
}: CommonPageProps) {
  const [preview, setPreview] = useState(
    safeText(data.accountant?.profileImageUrl),
  );

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      setPreview(url);
      const saved = await runAction("UPDATE_PROFILE_IMAGE", {
        profileImageUrl: url,
      });
      if (saved) notify("Profile image updated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Profile upload failed.");
    }
  }

  return (
    <SectionPage
      title="Profile"
      subtitle="Accountant identity and portal profile image."
      glyph="profile"
    >
      <div className={styles.profilePageGrid}>
        <article className={styles.profileImageCard}>
          <div className={styles.profileImageLarge}>
            {preview ? (
              <img src={preview} alt={safeText(data.accountant?.name)} />
            ) : (
              safeText(data.accountant?.name).slice(0, 1).toUpperCase()
            )}
          </div>
          <label className={styles.primaryButton}>
            <Glyph name="upload" /> Upload profile image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={selectImage}
              disabled={busy}
              hidden
            />
          </label>
          <small>JPG, PNG or WebP. Maximum 5 MB.</small>
        </article>

        <article className={styles.statusPanel}>
          <CardHeading
            title="Account information"
            text="Read directly from the authenticated database user."
          />
          <div className={styles.detailGrid}>
            <Detail label="Name" value={safeText(data.accountant?.name)} />
            <Detail label="Email" value={safeText(data.accountant?.email)} />
            <Detail label="Role" value={roleLabel(data.accountant?.role)} />
            <Detail label="Company" value={safeText(data.company?.name)} />
            <Detail
              label="Approval limit"
              value={money(
                data.accountant?.approvalLimit ||
                  data.settings?.accountantExpenseApprovalLimit ||
                  0,
              )}
            />
            <Detail
              label="Status"
              value={safeText(data.accountant?.status || "ACTIVE")}
            />
          </div>
        </article>
      </div>
    </SectionPage>
  );
}

type CommonPageProps = {
  data: DashboardData;
  busy: boolean;
  runAction: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<boolean>;
  uploadFile: (file: File) => Promise<string>;
  notify: (message: string) => void;
};

function SectionPage({
  title,
  subtitle,
  glyph,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  glyph: GlyphName;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.sectionPage}>
      <header className={styles.sectionHeader}>
        <span>
          <Glyph name={glyph} />
        </span>
        <div>
          <small>Accountant Portal</small>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action && <aside>{action}</aside>}
      </header>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
  theme,
}: {
  label: string;
  value: string;
  note: string;
  theme: "peach" | "blue" | "orange" | "yellow";
}) {
  return (
    <article className={`${styles.metricCard} ${styles[theme]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function GlassCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.glassCard}>
      <header>
        <div>
          <h3>{title}</h3>
          <small>{subtitle}</small>
        </div>
      </header>
      {children}
    </article>
  );
}

function EarningsChart({ rows }: { rows: any[] }) {
  const list = safeArray<any>(rows);
  const width = 680;
  const height = 245;
  const padding = 28;
  const max = Math.max(
    1,
    ...list.flatMap((item) => [
      Number(item.income || 0),
      Number(item.expense || 0),
      Number(item.deposit || 0),
    ]),
  );

  function points(field: string) {
    return list
      .map((item, index) => {
        const x =
          padding +
          (index * (width - padding * 2)) / Math.max(1, list.length - 1);
        const y =
          height -
          padding -
          (Number(item[field] || 0) / max) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className={styles.lineChart}>
      <div className={styles.chartLegend}>
        <span>
          <i className={styles.legendIncome}></i>Income
        </span>
        <span>
          <i className={styles.legendExpense}></i>Expenses
        </span>
        <span>
          <i className={styles.legendDeposit}></i>Deposits
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Earnings overview chart"
      >
        <defs>
          <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a9d8ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a9d8ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((value) => (
          <line
            key={value}
            x1={padding}
            x2={width - padding}
            y1={padding + (height - padding * 2) * value}
            y2={padding + (height - padding * 2) * value}
            className={styles.chartGridLine}
          />
        ))}
        <polyline points={points("income")} className={styles.incomeLine} />
        <polyline points={points("expense")} className={styles.expenseLine} />
        <polyline points={points("deposit")} className={styles.depositLine} />
      </svg>

      <div className={styles.chartLabels}>
        {list.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function BreakdownChart({ rows }: { rows: any[] }) {
  const list = safeArray<any>(rows);
  const max = Math.max(
    1,
    ...list.flatMap((item) => [
      Number(item.income || 0),
      Number(item.expense || 0),
      Number(item.deposit || 0),
    ]),
  );

  return (
    <div className={styles.barChart}>
      {list.map((item) => (
        <article key={item.key}>
          <div>
            <span
              className={styles.incomeBar}
              style={{
                height: `${Math.max(6, (Number(item.income || 0) / max) * 100)}%`,
              }}
              title={`Income ${money(item.income)}`}
            ></span>
            <span
              className={styles.expenseBar}
              style={{
                height: `${Math.max(6, (Number(item.expense || 0) / max) * 100)}%`,
              }}
              title={`Expense ${money(item.expense)}`}
            ></span>
            <span
              className={styles.depositBar}
              style={{
                height: `${Math.max(6, (Number(item.deposit || 0) / max) * 100)}%`,
              }}
              title={`Deposit ${money(item.deposit)}`}
            ></span>
          </div>
          <small>{item.label}</small>
        </article>
      ))}
    </div>
  );
}

function CashFlowChart({ rows }: { rows: any[] }) {
  const values = safeArray<any>(rows).slice(-30);
  if (!values.length) return <Empty text="No cash flow data is available." />;
  const width = 960;
  const height = 280;
  const padding = 34;
  const max = Math.max(
    1,
    ...values.flatMap((item) => [
      Number(item.inflow || 0),
      Number(item.outflow || 0),
      Math.abs(Number(item.net || 0)),
    ]),
  );
  const x = (index: number) =>
    padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
  const y = (value: number) =>
    height - padding - (Math.max(0, value) / max) * (height - padding * 2);
  const inflowPoints = values
    .map((item, index) => `${x(index)},${y(Number(item.inflow || 0))}`)
    .join(" ");
  const outflowPoints = values
    .map((item, index) => `${x(index)},${y(Number(item.outflow || 0))}`)
    .join(" ");

  return (
    <div className={styles.cashFlowChart}>
      <div className={styles.chartLegend}>
        <span>
          <i className={styles.legendIncome}></i>Cash in
        </span>
        <span>
          <i className={styles.legendExpense}></i>Cash out
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cash flow movement chart"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const lineY = padding + (line * (height - padding * 2)) / 4;
          return (
            <line
              key={line}
              x1={padding}
              y1={lineY}
              x2={width - padding}
              y2={lineY}
              className={styles.chartGridLine}
            />
          );
        })}
        <polyline points={inflowPoints} className={styles.incomeLine} />
        <polyline points={outflowPoints} className={styles.expenseLine} />
        {values.map((item, index) => (
          <g key={item.key || index}>
            <circle
              cx={x(index)}
              cy={y(Number(item.inflow || 0))}
              r="3.5"
              className={styles.cashInPoint}
            />
            <circle
              cx={x(index)}
              cy={y(Number(item.outflow || 0))}
              r="3.5"
              className={styles.cashOutPoint}
            />
          </g>
        ))}
      </svg>
      <div className={styles.cashFlowLabels}>
        {values.map((item, index) => (
          <span key={item.key || index}>
            {index % 4 === 0 || index === values.length - 1 ? item.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function SpendingDonut({ rows }: { rows: any[] }) {
  const list = safeArray<any>(rows).slice(0, 5);
  const total = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  let cursor = 0;
  const colors = ["#ffb59c", "#a8d1ff", "#ffd48f", "#b7e4df", "#d8c1ff"];

  const stops = list.map((item, index) => {
    const start = cursor;
    const end = total ? cursor + (Number(item.amount) / total) * 100 : cursor;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div className={styles.donutLayout}>
      <div
        className={styles.donut}
        style={{
          background: `radial-gradient(circle, rgba(255,255,255,.88) 0 42%, transparent 43%), conic-gradient(${stops.join(",") || "#e9e5df 0 100%"})`,
        }}
      >
        <span>
          <strong>{moneyShort(total)}</strong>
          <small>Spending</small>
        </span>
      </div>
      <div className={styles.donutLegend}>
        {list.map((item, index) => (
          <div key={item.category}>
            <i style={{ background: colors[index % colors.length] }}></i>
            <span>{item.category}</span>
            <strong>{moneyShort(item.amount)}</strong>
          </div>
        ))}
      </div>
    </div>
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
      <header>
        <div>
          <h3>{title}</h3>
          <small>{subtitle}</small>
        </div>
      </header>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function CardHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.cardHeading}>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Status({ status }: { status: unknown }) {
  const value = safeText(status).toUpperCase();
  const positive = [
    "OPEN",
    "VERIFIED",
    "APPROVED",
    "PRESENT",
    "SUCCESS",
    "CLOSED",
    "DEBIT",
  ].includes(value);
  const warning = [
    "PENDING",
    "LATE",
    "ISSUED",
    "CONFIRMED",
    "WARNING",
  ].includes(value);

  return (
    <span
      className={`${styles.status} ${
        positive
          ? styles.statusPositive
          : warning
            ? styles.statusWarning
            : styles.statusNegative
      }`}
    >
      <i></i>
      {value.replaceAll("_", " ") || "N/A"}
    </span>
  );
}

function Entity({ name, sub }: { name: string; sub: string }) {
  return (
    <div className={styles.entity}>
      <span>{name.slice(0, 1).toUpperCase() || "?"}</span>
      <div>
        <strong>{name}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detail}>
      <span>{label}</span>
      <strong>{value || "N/A"}</strong>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`${styles.summaryLine} ${warning ? styles.summaryWarning : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusHero({
  status,
  label,
  value,
}: {
  status: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.statusHero}>
      <span>
        <Status status={status} />
        <small>{label}</small>
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function StatementColumn({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<[string, number]>;
  total: number;
}) {
  return (
    <article className={styles.statementColumn}>
      <header>{title}</header>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{money(value)}</strong>
        </div>
      ))}
      <footer>
        <span>Total</span>
        <strong>{money(total)}</strong>
      </footer>
    </article>
  );
}

function DocumentLinks({
  documents,
}: {
  documents: Array<[string, string | null | undefined]>;
}) {
  return (
    <div className={styles.documentLinks}>
      {documents.map(([label, url]) =>
        url ? (
          <a key={label} href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <span key={label}>{label}</span>
        ),
      )}
    </div>
  );
}

function ExpenseWorkflow() {
  const steps = [
    "Employee",
    "Submit Expense",
    "Upload Receipt",
    "Accountant Reviews",
    "Approve / Reject",
    "Update Financial Records",
  ];

  return (
    <article className={styles.workflowCard}>
      <div>
        <h3>Expense Management Workflow</h3>
        <p>
          Fuel, transport, airtime, accommodation, repairs, stationery, meals,
          office and emergency expenses.
        </p>
      </div>
      <section>
        {steps.map((step, index) => (
          <span key={step}>
            <b>{index + 1}</b>
            {step}
            {index < steps.length - 1 && <Glyph name="arrow" />}
          </span>
        ))}
      </section>
    </article>
  );
}

function ReportSummaryCard({
  title,
  value,
  note,
  glyph,
}: {
  title: string;
  value: string;
  note: string;
  glyph: GlyphName;
}) {
  return (
    <article className={styles.reportSummaryCard}>
      <Glyph name={glyph} />
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function ReportButtons({ filename, rows }: { filename: string; rows: any[] }) {
  function primitiveKeys(): string[] {
    return Array.from(
      rows.reduce<Set<string>>((set, row) => {
        Object.keys(row || {}).forEach((key) => {
          if (typeof row[key] !== "object") set.add(key);
        });
        return set;
      }, new Set<string>()),
    );
  }

  function exportCsv() {
    if (!rows.length) return;
    const keys = primitiveKeys();
    const csv = [
      keys,
      ...rows.map((row) => keys.map((key) => safeText(row[key]))),
    ]
      .map((line) =>
        line
          .map((cell) => `"${safeText(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${filename}-${dateInput()}.csv`);
  }

  function exportPdf() {
    if (!rows.length) return;
    const keys = primitiveKeys();
    const lines = [
      filename.replaceAll("-", " ").toUpperCase(),
      `Generated: ${new Date().toLocaleString("en-TZ")}`,
      "",
      keys.join(" | "),
      ...rows.map((row) => keys.map((key) => safeText(row[key])).join(" | ")),
    ];
    downloadBlob(buildSimplePdf(lines), `${filename}-${dateInput()}.pdf`);
  }

  return (
    <div className={styles.reportButtons}>
      <button type="button" onClick={exportPdf} disabled={!rows.length}>
        <Glyph name="print" /> PDF
      </button>
      <button type="button" onClick={exportCsv} disabled={!rows.length}>
        <Glyph name="download" /> CSV
      </button>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildSimplePdf(sourceLines: string[]): Blob {
  const sanitize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, " ")
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
  const wrapped: string[] = [];
  for (const source of sourceLines) {
    const line = sanitize(source);
    if (!line) {
      wrapped.push("");
      continue;
    }
    for (let index = 0; index < line.length; index += 105)
      wrapped.push(line.slice(index, index + 105));
  }
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(wrapped.length / 45)) },
    (_, index) => wrapped.slice(index * 45, index * 45 + 45),
  );
  const objects: string[] = [];
  const pageRefs = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pageLines, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    const text = pageLines
      .map(
        (line, lineIndex) =>
          `${lineIndex === 0 ? "" : "0 -16 Td "}(${line}) Tj`,
      )
      .join("\n");
    const stream = `BT /F1 8 Tf 40 800 Td\n${text}\nET`;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1)
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function PrintButton() {
  return (
    <button
      type="button"
      className={styles.headerButton}
      onClick={() => window.print()}
    >
      <Glyph name="print" /> Print / PDF
    </button>
  );
}

function NotificationPopup({
  notifications,
  unread,
  runAction,
  openAll,
}: {
  notifications: any[];
  unread: number;
  runAction: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<boolean>;
  openAll: () => void;
}) {
  return (
    <div className={styles.notificationPopup}>
      <header>
        <div>
          <strong>Notifications</strong>
          <small>{unread} unread</small>
        </div>
        <button
          type="button"
          onClick={() => void runAction("MARK_ALL_NOTIFICATIONS_READ")}
        >
          Mark all read
        </button>
      </header>
      <section>
        {safeArray<any>(notifications)
          .slice(0, 8)
          .map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.isRead ? styles.popupRead : ""}
              onClick={() =>
                void runAction("MARK_NOTIFICATION_READ", {
                  notificationId: item.id,
                })
              }
            >
              <Glyph name={item.type === "ERROR" ? "warning" : "bell"} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.message}</small>
              </span>
            </button>
          ))}
      </section>
      <footer>
        <button type="button" onClick={openAll}>
          Open notification center
        </button>
      </footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.stateCard}>
      <span className={styles.loader}></span>
      <h2>Loading finance records...</h2>
      <p>
        Financial days, bank deposits, expenses, float, attendance and reports.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className={styles.stateCard}>
      <Glyph name="warning" />
      <h2>Accountant portal could not load</h2>
      <p>{message}</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <Empty text={text} />
      </td>
    </tr>
  );
}

function clientPeriodRange(
  period: "DAY" | "WEEK" | "MONTH" | "YEAR",
  reference: string,
) {
  const date = new Date(`${reference}T12:00:00`);
  const start = new Date(date);
  const end = new Date(date);

  if (period === "DAY") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "WEEK") {
    const day = start.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "MONTH") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function attendanceSummary(rows: any[]) {
  const present = rows.filter((item) => item.status === "PRESENT").length;
  const late = rows.filter((item) => item.status === "LATE").length;
  const absent = rows.filter((item) => item.status === "ABSENT").length;
  const working = present + late + absent;
  const attended = present + late;

  return {
    present,
    late,
    absent,
    working,
    attended,
    rate: working ? Math.round((attended / working) * 100) : 0,
  };
}
