"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./imported-finance.module.css";

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleLabel: string;
    companyId: string;
    profileImageUrl: string | null;
  };
};

type PageKey = "Overview" | "Float Agents" | "Bank Statement" | "Reconciliation";

type FinanceData = {
  success: true;
  company: { id: string; name: string; code: string };
  stats: {
    importedAgents: number;
    displayedAgentMatches: number;
    uniqueMsisdn: number;
    uniqueAliasCodes: number;
    statementTransactions: number;
    matchedCount: number;
    reviewCount: number;
    unmatchedCount: number;
    notApplicableCount: number;
    matchRate: number;
  };
  importBatch: any | null;
  statement: any | null;
  dailySeries: Array<{
    date: string;
    credit: number;
    debit: number;
    net: number;
    count: number;
  }>;
  agents: {
    rows: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  transactions: {
    rows: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const nav: Array<{ page: PageKey; icon: string; note: string }> = [
  { page: "Overview", icon: "grid", note: "Import summary" },
  { page: "Float Agents", icon: "users", note: "2,273 agent records" },
  { page: "Bank Statement", icon: "bank", note: "CRDB transactions" },
  { page: "Reconciliation", icon: "match", note: "Agent matching" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    bank: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 10v9" />
        <path d="M9 10v9" />
        <path d="M15 10v9" />
        <path d="M19 10v9" />
        <path d="M3 21h18" />
      </>
    ),
    match: (
      <>
        <path d="M8 7h11l-3-3" />
        <path d="m19 7-3 3" />
        <path d="M16 17H5l3 3" />
        <path d="m5 17 3-3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    warning: (
      <>
        <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] ?? paths.file}
    </svg>
  );
}

function money(value: unknown): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function compactMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) >= 1_000_000_000) return `TZS ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(amount) >= 1_000_000) return `TZS ${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `TZS ${(amount / 1_000).toFixed(1)}K`;
  return money(amount);
}

function dateTime(value: unknown): string {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

function dateOnly(value: unknown): string {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

async function requestData(params: URLSearchParams): Promise<FinanceData> {
  const response = await fetch(`/api/admin/imported-finance?${params.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  const text = await response.text();
  let result: any;

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`The server returned invalid JSON (${response.status}).`);
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      [result.message, result.code, result.details].filter(Boolean).join("\n") ||
        "Imported finance data could not be loaded.",
    );
  }

  return result as FinanceData;
}

function csvDownload(filename: string, headers: string[], rows: unknown[][]) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ImportedFinanceClient({ user }: Props) {
  const [activePage, setActivePage] = useState<PageKey>("Overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FinanceData | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [matchStatus, setMatchStatus] = useState("");
  const [direction, setDirection] = useState("");
  const [agentPage, setAgentPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 250);
    return () => window.clearTimeout(timer);
  }, [agentSearch, transactionSearch, matchStatus, direction, agentPage, transactionPage]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        agentPage: String(agentPage),
        agentPageSize: "25",
        transactionPage: String(transactionPage),
        transactionPageSize: "25",
        agentSearch,
        transactionSearch,
        matchStatus,
        direction,
      });
      setData(await requestData(params));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The page could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function changePage(page: PageKey) {
    setActivePage(page);
    setMobileOpen(false);
  }

  const profileInitials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

  return (
    <main className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      <button
        type="button"
        aria-label="Close menu"
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropShow : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}><Icon name="bank" /></span>
          <div>
            <strong>Simamia Finance</strong>
            <small>Imported Data Centre</small>
          </div>
          <em>LIVE</em>
        </div>

        <button
          type="button"
          className={styles.collapseButton}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span>☰</span>
          <b>{collapsed ? "Expand" : "Collapse menu"}</b>
        </button>

        <nav>
          <small>Imported finance</small>
          {nav.map((item) => (
            <button
              type="button"
              key={item.page}
              className={activePage === item.page ? styles.activeNav : ""}
              onClick={() => changePage(item.page)}
              title={item.page}
            >
              <span><Icon name={item.icon} /></span>
              <div>
                <strong>{item.page}</strong>
                <small>{item.note}</small>
              </div>
              <i><Icon name="arrow" /></i>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFoot}>
          <span>{user.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : profileInitials}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.roleLabel}</small>
          </div>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <button type="button" className={styles.mobileMenu} onClick={() => setMobileOpen(true)}>☰</button>
          <div>
            <small>{data?.company.name ?? "Imported finance workspace"}</small>
            <h1>{activePage}</h1>
          </div>
          <div className={styles.globalSearch}>
            <Icon name="search" />
            <input
              value={activePage === "Float Agents" ? agentSearch : transactionSearch}
              onChange={(event) => {
                if (activePage === "Float Agents") {
                  setAgentPage(1);
                  setAgentSearch(event.target.value);
                } else {
                  setTransactionPage(1);
                  setTransactionSearch(event.target.value);
                }
              }}
              placeholder={activePage === "Float Agents" ? "Search name, phone or alias..." : "Search reference, sender or details..."}
            />
          </div>
          <button type="button" className={styles.iconButton} onClick={() => void loadData()} title="Refresh"><Icon name="refresh" /></button>
          <div className={styles.userBadge}>
            <span>{profileInitials}</span>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
          </div>
        </header>

        {error ? (
          <ErrorCard message={error} retry={() => void loadData()} />
        ) : loading && !data ? (
          <Loading />
        ) : data ? (
          <div className={styles.pageBody}>
            {activePage === "Overview" && <Overview data={data} setPage={changePage} />}
            {activePage === "Float Agents" && (
              <AgentsPage
                data={data}
                search={agentSearch}
                setSearch={(value) => { setAgentPage(1); setAgentSearch(value); }}
                setPage={setAgentPage}
              />
            )}
            {activePage === "Bank Statement" && (
              <TransactionsPage
                data={data}
                mode="statement"
                search={transactionSearch}
                setSearch={(value) => { setTransactionPage(1); setTransactionSearch(value); }}
                matchStatus={matchStatus}
                setMatchStatus={(value) => { setTransactionPage(1); setMatchStatus(value); }}
                direction={direction}
                setDirection={(value) => { setTransactionPage(1); setDirection(value); }}
                setPage={setTransactionPage}
              />
            )}
            {activePage === "Reconciliation" && (
              <TransactionsPage
                data={data}
                mode="reconciliation"
                search={transactionSearch}
                setSearch={(value) => { setTransactionPage(1); setTransactionSearch(value); }}
                matchStatus={matchStatus}
                setMatchStatus={(value) => { setTransactionPage(1); setMatchStatus(value); }}
                direction={direction}
                setDirection={(value) => { setTransactionPage(1); setDirection(value); }}
                setPage={setTransactionPage}
              />
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Overview({ data, setPage }: { data: FinanceData; setPage: (page: PageKey) => void }) {
  const statement = data.statement;
  return (
    <>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Verified source import</span>
          <h2>Float agents and bank activity in one financial workspace.</h2>
          <p>The Excel master list and CRDB statement are stored in structured Prisma tables, ready for assignment, searching and reconciliation.</p>
          <div className={styles.heroActions}>
            <button type="button" onClick={() => setPage("Float Agents")}><Icon name="users" />Browse agents</button>
            <button type="button" onClick={() => setPage("Reconciliation")}><Icon name="match" />Review matching</button>
          </div>
        </div>
        <div className={styles.heroOrb}>
          <strong>{data.stats.importedAgents.toLocaleString()}</strong>
          <span>Imported agents</span>
          <small>{data.importBatch?.status ?? "READY"}</small>
        </div>
      </section>

      <section className={styles.metrics}>
        <Metric title="Agent master" value={data.stats.importedAgents.toLocaleString()} note="Unique Excel rows imported" tone="green" icon="users" />
        <Metric title="Statement credit" value={compactMoney(statement?.totalCredit)} note="22 incoming transactions" tone="mint" icon="bank" />
        <Metric title="Statement debit" value={compactMoney(statement?.totalDebit)} note="5 cash-out transactions" tone="gold" icon="file" />
        <Metric title="Available balance" value={compactMoney(statement?.availableBalance)} note="Cleared and book balance" tone="blue" icon="grid" />
      </section>

      <section className={styles.dashboardGrid}>
        <Card title="Bank movement" subtitle="Credit, debit and net movement by statement date">
          <MovementChart rows={data.dailySeries} />
        </Card>
        <Card title="Reconciliation quality" subtitle="Imported sender-to-agent matching">
          <MatchDonut stats={data.stats} />
        </Card>
      </section>

      <section className={styles.dashboardGridBottom}>
        <Card title="Source files" subtitle="Auditable import batches">
          <div className={styles.sourceList}>
            <SourceRow icon="users" title="float data_063712.xlsx" note={`Sheet1 • ${data.stats.importedAgents.toLocaleString()} rows`} status={data.importBatch?.status ?? "COMPLETED"} />
            <SourceRow icon="file" title={statement?.sourceFileName ?? "Bank statement PDF"} note={`${dateOnly(statement?.periodStart)} - ${dateOnly(statement?.periodEnd)} • ${data.stats.statementTransactions} rows`} status="COMPLETED" />
          </div>
        </Card>
        <Card title="Account statement" subtitle="CRDB account metadata">
          <div className={styles.detailGrid}>
            <Detail label="Account name" value={statement?.accountName ?? "N/A"} />
            <Detail label="Account number" value={statement?.accountNumber ?? "N/A"} />
            <Detail label="Bank / branch" value={`${statement?.bankName ?? "N/A"} • ${statement?.branchName ?? "N/A"}`} />
            <Detail label="Generated" value={dateTime(statement?.generatedAt)} />
            <Detail label="Book balance" value={money(statement?.bookBalance)} />
            <Detail label="Cleared balance" value={money(statement?.clearedBalance)} />
          </div>
        </Card>
      </section>
    </>
  );
}

function AgentsPage({ data, search, setSearch, setPage }: { data: FinanceData; search: string; setSearch: (value: string) => void; setPage: (page: number) => void }) {
  function exportAgents() {
    csvDownload(
      "float-agents-current-page.csv",
      ["Agent Name", "MSISDN", "Alias Code", "Source Row", "Status"],
      data.agents.rows.map((row) => [row.name, row.phone, row.code, row.sourceRowNumber, row.status]),
    );
  }

  return (
    <>
      <PageIntro icon="users" title="Float Agent Master" text="All Excel columns are preserved: Agent_name, Agent_MSISDN and Alias_code. Normalised values are used for searching and matching while original source values remain auditable." />
      <div className={styles.toolbar}>
        <label className={styles.searchField}><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agent name, phone or alias code" /></label>
        <button type="button" onClick={exportAgents}><Icon name="download" />Export current page</button>
      </div>
      <Card title="Imported agents" subtitle={`${data.agents.total.toLocaleString()} matching records`} flush>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th>#</th><th>Agent name</th><th>MSISDN</th><th>Alias code</th><th>Source</th><th>Status</th></tr></thead>
            <tbody>
              {data.agents.rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{(data.agents.page - 1) * data.agents.pageSize + index + 1}</td>
                  <td><Person name={row.name} note={row.sourceAgentName?.trim() !== row.name ? `Source: ${row.sourceAgentName}` : "Imported agent"} /></td>
                  <td><strong className={styles.mono}>{row.phone}</strong></td>
                  <td><span className={styles.alias}>{row.code}</span></td>
                  <td><span className={styles.sourceTag}>{row.sourceSheetName} • row {row.sourceRowNumber}</span></td>
                  <td><Status value={row.status} /></td>
                </tr>
              ))}
              {!data.agents.rows.length && <tr><td colSpan={6}><Empty text="No imported agents match the current search." /></td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={data.agents.page} totalPages={data.agents.totalPages} setPage={setPage} />
      </Card>
    </>
  );
}

function TransactionsPage({ data, mode, search, setSearch, matchStatus, setMatchStatus, direction, setDirection, setPage }: {
  data: FinanceData;
  mode: "statement" | "reconciliation";
  search: string;
  setSearch: (value: string) => void;
  matchStatus: string;
  setMatchStatus: (value: string) => void;
  direction: string;
  setDirection: (value: string) => void;
  setPage: (page: number) => void;
}) {
  const rows = data.transactions.rows;
  function exportRows() {
    csvDownload(
      mode === "statement" ? "bank-statement-transactions.csv" : "bank-reconciliation.csv",
      ["Posting Date", "Reference", "Sender", "Direction", "Debit", "Credit", "Book Balance", "Match Status", "Matched Agent"],
      rows.map((row) => [row.postingDate, row.reference, row.senderName, row.direction, row.debit, row.credit, row.bookBalance, row.matchStatus, row.matchedBrokerCustomer?.name]),
    );
  }

  return (
    <>
      <PageIntro
        icon={mode === "statement" ? "bank" : "match"}
        title={mode === "statement" ? "CRDB Bank Statement" : "Agent Reconciliation"}
        text={mode === "statement" ? "Every PDF transaction is stored with posting date, value date, reference, details, debit, credit and running book balance." : "Incoming bank senders are compared with the imported agent master. High-confidence records are matched automatically; uncertain records remain for review."}
      />
      {mode === "reconciliation" && (
        <section className={styles.metricsSmall}>
          <Metric title="Matched" value={String(data.stats.matchedCount)} note="High confidence" tone="green" icon="check" />
          <Metric title="Review" value={String(data.stats.reviewCount)} note="Manual confirmation" tone="gold" icon="warning" />
          <Metric title="Unmatched" value={String(data.stats.unmatchedCount)} note="No reliable agent" tone="rose" icon="match" />
          <Metric title="Match rate" value={`${data.stats.matchRate.toFixed(1)}%`} note="Credits only" tone="blue" icon="grid" />
        </section>
      )}
      <div className={styles.toolbar}>
        <label className={styles.searchField}><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, sender or transaction details" /></label>
        <select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="">All directions</option><option value="CREDIT">Credit</option><option value="DEBIT">Debit</option></select>
        <select value={matchStatus} onChange={(event) => setMatchStatus(event.target.value)}><option value="">All match statuses</option><option value="MATCHED">Matched</option><option value="REVIEW_REQUIRED">Review required</option><option value="UNMATCHED">Unmatched</option><option value="NOT_APPLICABLE">Not applicable</option></select>
        <button type="button" onClick={exportRows}><Icon name="download" />Export CSV</button>
      </div>
      <Card title={mode === "statement" ? "Statement transactions" : "Matching register"} subtitle={`${data.transactions.total} matching transactions`} flush>
        <div className={styles.tableScroll}>
          <table className={styles.transactionTable}>
            <thead><tr><th>Date</th><th>Reference / details</th><th>Sender</th><th>Debit</th><th>Credit</th><th>Book balance</th><th>Agent match</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{dateOnly(row.postingDate)}</strong><small>{dateTime(row.postingDate).split(", ").at(-1)}</small></td>
                  <td><strong className={styles.mono}>{row.reference}</strong><small className={styles.detailText}>{row.details}</small></td>
                  <td>{row.senderName ? <Person name={row.senderName} note={row.transactionType?.replaceAll("_", " ")} /> : <span className={styles.muted}>Bank cash-out</span>}</td>
                  <td className={styles.debit}>{Number(row.debit) ? money(row.debit) : "—"}</td>
                  <td className={styles.credit}>{Number(row.credit) ? money(row.credit) : "—"}</td>
                  <td><strong>{money(row.bookBalance)}</strong></td>
                  <td>
                    <Status value={row.matchStatus} />
                    {row.matchedBrokerCustomer && <small className={styles.matchName}>{row.matchedBrokerCustomer.name}<br />{row.matchConfidence}% confidence</small>}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7}><Empty text="No statement transactions match the current filters." /></td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={data.transactions.page} totalPages={data.transactions.totalPages} setPage={setPage} />
      </Card>
    </>
  );
}

function MovementChart({ rows }: { rows: FinanceData["dailySeries"] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.credit, row.debit]));
  return (
    <div className={styles.barChart}>
      {rows.map((row) => (
        <article key={row.date}>
          <div className={styles.barValues}>
            <span className={styles.creditBar} style={{ height: `${Math.max(5, (row.credit / max) * 190)}px` }} title={money(row.credit)} />
            <span className={styles.debitBar} style={{ height: `${Math.max(5, (row.debit / max) * 190)}px` }} title={money(row.debit)} />
          </div>
          <strong>{dateOnly(row.date)}</strong>
          <small>{row.count} transactions</small>
        </article>
      ))}
      {!rows.length && <Empty text="No statement movement is available." />}
      <div className={styles.chartLegend}><span><i className={styles.creditDot} />Credit</span><span><i className={styles.debitDot} />Debit</span></div>
    </div>
  );
}

function MatchDonut({ stats }: { stats: FinanceData["stats"] }) {
  const total = Math.max(1, stats.matchedCount + stats.reviewCount + stats.unmatchedCount + stats.notApplicableCount);
  const matched = (stats.matchedCount / total) * 100;
  const review = (stats.reviewCount / total) * 100;
  const unmatched = (stats.unmatchedCount / total) * 100;
  const background = `conic-gradient(#11996f 0 ${matched}%, #f4b942 ${matched}% ${matched + review}%, #e96c78 ${matched + review}% ${matched + review + unmatched}%, #b9c4be ${matched + review + unmatched}% 100%)`;
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut} style={{ background }}><div><strong>{stats.matchRate.toFixed(1)}%</strong><span>Match rate</span></div></div>
      <div className={styles.donutLegend}>
        <Legend label="Matched" value={stats.matchedCount} tone="green" />
        <Legend label="Review required" value={stats.reviewCount} tone="gold" />
        <Legend label="Unmatched" value={stats.unmatchedCount} tone="rose" />
        <Legend label="Bank cash-out" value={stats.notApplicableCount} tone="grey" />
      </div>
    </div>
  );
}

function Metric({ title, value, note, tone, icon }: { title: string; value: string; note: string; tone: string; icon: string }) {
  return <article className={`${styles.metric} ${styles[`metric_${tone}`]}`}><span><Icon name={icon} /></span><div><small>{title}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function Card({ title, subtitle, children, flush = false }: { title: string; subtitle: string; children: ReactNode; flush?: boolean }) {
  return <section className={`${styles.card} ${flush ? styles.cardFlush : ""}`}><header><div><h3>{title}</h3><p>{subtitle}</p></div></header>{children}</section>;
}

function PageIntro({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <section className={styles.pageIntro}><span><Icon name={icon} /></span><div><small>Imported finance module</small><h2>{title}</h2><p>{text}</p></div></section>;
}

function SourceRow({ icon, title, note, status }: { icon: string; title: string; note: string; status: string }) {
  return <article><span><Icon name={icon} /></span><div><strong>{title}</strong><small>{note}</small></div><Status value={status} /></article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function Person({ name, note }: { name: string; note?: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase();
  return <div className={styles.person}><span>{initial}</span><div><strong>{name}</strong>{note && <small>{note}</small>}</div></div>;
}

function Status({ value }: { value: string }) {
  const key = String(value || "UNKNOWN").toLowerCase();
  return <span className={`${styles.status} ${styles[`status_${key}`] ?? ""}`}>{String(value || "UNKNOWN").replaceAll("_", " ")}</span>;
}

function Legend({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><i className={styles[`legend_${tone}`]} /><span>{label}</span><strong>{value}</strong></div>;
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (page: number) => void }) {
  return <footer className={styles.pagination}><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page <strong>{page}</strong> of <strong>{totalPages}</strong></span><button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></footer>;
}

function Empty({ text }: { text: string }) {
  return <div className={styles.empty}><Icon name="file" /><span>{text}</span></div>;
}

function Loading() {
  return <div className={styles.loading}><span /><span /><span /><p>Loading imported finance data...</p></div>;
}

function ErrorCard({ message, retry }: { message: string; retry: () => void }) {
  return <section className={styles.errorCard}><Icon name="warning" /><h2>Imported finance page could not load</h2><pre>{message}</pre><button type="button" onClick={retry}>Try again</button></section>;
}
