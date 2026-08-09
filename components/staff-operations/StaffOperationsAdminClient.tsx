"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import styles from "./StaffOperationsAdminClient.module.css";

type Props = {
  portalTitle: string;
};

type Data = {
  staff: any[];
  lines: any[];
  funding: any[];
  brokers: any[];
  assignments: any[];
};

type ReviewData = {
  proofs: any[];
  expenses: any[];
  summary: Record<string, number>;
};

function money(value: unknown) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function label(value: unknown) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: unknown) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(String(value)));
}

async function json<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok || body.success === false) {
    throw new Error(body.message || "Request failed.");
  }
  return body as T;
}

export default function StaffOperationsAdminClient({ portalTitle }: Props) {
  const [tab, setTab] = useState<
    "NETWORKS" | "FUNDING" | "ASSIGNMENTS" | "PROOFS" | "EXPENSES"
  >("NETWORKS");
  const [data, setData] = useState<Data>({
    staff: [],
    lines: [],
    funding: [],
    brokers: [],
    assignments: [],
  });
  const [review, setReview] = useState<ReviewData>({ proofs: [], expenses: [], summary: {} });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [lineForm, setLineForm] = useState({
    network: "VODACOM",
    simCardNumber: "",
    agentNumber: "",
    accountName: "",
    purpose: "BOTH",
    assignedArea: "",
    isPrimary: true,
  });
  const [fundingForm, setFundingForm] = useState({
    networkLineId: "",
    referenceNo: "",
    floatAmount: "",
    cashAmount: "",
    note: "",
  });
  const [brokerSearch, setBrokerSearch] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    brokerCustomerId: "",
    assignedArea: "",
    notes: "",
  });

  async function load() {
    try {
      const [networkResponse, reviewResponse] = await Promise.all([
        fetch("/api/company-admin/staff-networks", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/company-admin/staff-operations-review", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      setData(await json<Data & { success: true }>(networkResponse));
      setReview(await json<ReviewData & { success: true }>(reviewResponse));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load staff operations.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const staffLines = useMemo(
    () => data.lines.filter((line) => !selectedStaff || line.staffId === selectedStaff),
    [data.lines, selectedStaff],
  );

  const filteredBrokers = useMemo(() => {
    const query = brokerSearch.trim().toLowerCase();
    return data.brokers.filter((broker) => {
      if (!query) return true;
      const haystack = [
        broker.code,
        broker.name,
        broker.businessName,
        broker.phone,
        broker.location,
        broker.region,
        broker.district,
        broker.ward,
        broker.address,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return query.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
    });
  }, [data.brokers, brokerSearch]);

  const staffAssignments = useMemo(
    () => data.assignments.filter((row) => !selectedStaff || row.staffId === selectedStaff),
    [data.assignments, selectedStaff],
  );

  async function post(url: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await json<{ success: true; message: string }>(response);
      setMessage(result.message);
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveLine(event: FormEvent) {
    event.preventDefault();
    if (!selectedStaff) return setMessage("Select a staff member.");
    const ok = await post("/api/company-admin/staff-networks", {
      action: "UPSERT_NETWORK_LINE",
      staffId: selectedStaff,
      ...lineForm,
    });
    if (ok) {
      setLineForm({
        network: "VODACOM",
        simCardNumber: "",
        agentNumber: "",
        accountName: "",
        purpose: "BOTH",
        assignedArea: "",
        isPrimary: false,
      });
    }
  }

  async function issueFunding(event: FormEvent) {
    event.preventDefault();
    if (!selectedStaff) return setMessage("Select a staff member.");
    const ok = await post("/api/company-admin/staff-networks", {
      action: "ISSUE_FUNDING",
      staffId: selectedStaff,
      ...fundingForm,
    });
    if (ok) {
      setFundingForm({
        networkLineId: "",
        referenceNo: "",
        floatAmount: "",
        cashAmount: "",
        note: "",
      });
    }
  }

  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    if (!selectedStaff) return setMessage("Select a staff member.");
    if (!assignmentForm.brokerCustomerId) return setMessage("Select a broker or agent.");
    const ok = await post("/api/company-admin/staff-networks", {
      action: "ASSIGN_BROKER",
      staffId: selectedStaff,
      ...assignmentForm,
    });
    if (ok) {
      setAssignmentForm({ brokerCustomerId: "", assignedArea: "", notes: "" });
      setBrokerSearch("");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <small>{portalTitle}</small>
          <h1>Staff Networks, Funding & Verification</h1>
          <p>Register multiple SIM lines, issue float and cash repeatedly, and verify staff proofs and expenses.</p>
        </div>
        <div>
          <strong>{data.staff.length}</strong><span>Staff</span>
          <strong>{review.summary.pendingProofs || 0}</strong><span>Pending proofs</span>
          <strong>{review.summary.pendingExpenses || 0}</strong><span>Pending expenses</span>
        </div>
      </header>

      <section className={styles.toolbar}>
        <label>
          <span>Staff member</span>
          <select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)}>
            <option value="">All staff / select staff</option>
            {data.staff.map((staff) => (
              <option value={staff.id} key={staff.id}>{staff.name} · {staff.assignedRegion || "No area"}</option>
            ))}
          </select>
        </label>
        <nav>
          {(["NETWORKS", "FUNDING", "ASSIGNMENTS", "PROOFS", "EXPENSES"] as const).map((item) => (
            <button type="button" className={tab === item ? styles.active : ""} onClick={() => setTab(item)} key={item}>
              {label(item)}
            </button>
          ))}
        </nav>
      </section>

      {message && <div className={styles.toast}>{message}</div>}

      {tab === "NETWORKS" && (
        <section className={styles.columns}>
          <form className={styles.card} onSubmit={saveLine}>
            <h2>Register staff SIM line</h2>
            <div className={styles.grid}>
              <label><span>Network</span><select value={lineForm.network} onChange={(event) => setLineForm({ ...lineForm, network: event.target.value })}>
                {["VODACOM", "YAS_MIX", "AIRTEL", "HALOTEL", "OTHER"].map((item) => <option key={item}>{item}</option>)}
              </select></label>
              <label><span>Purpose</span><select value={lineForm.purpose} onChange={(event) => setLineForm({ ...lineForm, purpose: event.target.value })}>
                <option value="FLOAT">Float</option><option value="CASH">Cash</option><option value="BOTH">Both</option>
              </select></label>
            </div>
            <label><span>SIM card number</span><input required value={lineForm.simCardNumber} onChange={(event) => setLineForm({ ...lineForm, simCardNumber: event.target.value })}/></label>
            <label><span>Agent number</span><input value={lineForm.agentNumber} onChange={(event) => setLineForm({ ...lineForm, agentNumber: event.target.value })}/></label>
            <label><span>Account name</span><input value={lineForm.accountName} onChange={(event) => setLineForm({ ...lineForm, accountName: event.target.value })}/></label>
            <label><span>Assigned area</span><input value={lineForm.assignedArea} onChange={(event) => setLineForm({ ...lineForm, assignedArea: event.target.value })}/></label>
            <button disabled={busy}>Save SIM line</button>
          </form>
          <section className={styles.card}>
            <h2>Registered lines</h2>
            <div className={styles.list}>
              {staffLines.map((line) => (
                <article key={line.id}>
                  <b>{label(line.network)}</b>
                  <span>{line.simCardNumber} · {line.agentNumber || "No agent number"}</span>
                  <small>{line.staff?.name} · {line.assignedArea || line.staff?.assignedRegion || "No area"}</small>
                  <em>Float {money(line.floatBalance)} · Cash {money(line.cashBalance)}</em>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {tab === "FUNDING" && (
        <section className={styles.columns}>
          <form className={styles.card} onSubmit={issueFunding}>
            <h2>Issue float and cash</h2>
            <label><span>Network line</span><select value={fundingForm.networkLineId} onChange={(event) => setFundingForm({ ...fundingForm, networkLineId: event.target.value })}>
              <option value="">General funding</option>
              {staffLines.map((line) => <option value={line.id} key={line.id}>{line.network} · {line.simCardNumber}</option>)}
            </select></label>
            <div className={styles.grid}>
              <label><span>Float amount</span><input type="number" min="0" value={fundingForm.floatAmount} onChange={(event) => setFundingForm({ ...fundingForm, floatAmount: event.target.value })}/></label>
              <label><span>Cash amount</span><input type="number" min="0" value={fundingForm.cashAmount} onChange={(event) => setFundingForm({ ...fundingForm, cashAmount: event.target.value })}/></label>
            </div>
            <label><span>Reference</span><input value={fundingForm.referenceNo} onChange={(event) => setFundingForm({ ...fundingForm, referenceNo: event.target.value })} placeholder="Auto-generated when empty"/></label>
            <label><span>Note</span><textarea value={fundingForm.note} onChange={(event) => setFundingForm({ ...fundingForm, note: event.target.value })}/></label>
            <button disabled={busy}>Issue funding</button>
          </form>
          <section className={styles.card}>
            <h2>Funding history</h2>
            <div className={styles.list}>
              {data.funding.filter((row) => !selectedStaff || row.staffId === selectedStaff).map((row) => (
                <article key={row.id}>
                  <b>{row.referenceNo}</b>
                  <span>{row.staff?.name} · {date(row.issuedAt)}</span>
                  <small>Float {money(row.floatAmount)} · Cash {money(row.cashAmount)}</small>
                  <em>{label(row.status)}</em>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {tab === "ASSIGNMENTS" && (
        <section className={styles.columns}>
          <form className={styles.card} onSubmit={saveAssignment}>
            <h2>Assign broker or agent to staff area</h2>
            <label>
              <span>Search broker by first letters, name, phone or area</span>
              <input
                value={brokerSearch}
                onChange={(event) => setBrokerSearch(event.target.value)}
                placeholder="Example: Ma, Mwenge, 0712..."
              />
            </label>
            <label>
              <span>Broker / agent</span>
              <select
                required
                value={assignmentForm.brokerCustomerId}
                onChange={(event) => {
                  const broker = data.brokers.find((item) => item.id === event.target.value);
                  setAssignmentForm({
                    ...assignmentForm,
                    brokerCustomerId: event.target.value,
                    assignedArea:
                      assignmentForm.assignedArea ||
                      broker?.ward ||
                      broker?.district ||
                      broker?.location ||
                      "",
                  });
                }}
              >
                <option value="">Select broker or agent</option>
                {filteredBrokers.slice(0, 1000).map((broker) => (
                  <option value={broker.id} key={broker.id}>
                    {broker.businessName || broker.name} · {broker.phone} · {broker.ward || broker.district || broker.location}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Assigned service area</span>
              <input
                required
                value={assignmentForm.assignedArea}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, assignedArea: event.target.value })}
                placeholder="Ward, district or route area"
              />
            </label>
            <label>
              <span>Assignment note</span>
              <textarea
                value={assignmentForm.notes}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, notes: event.target.value })}
                placeholder="Optional route or service instructions"
              />
            </label>
            <button disabled={busy}>Assign broker to staff</button>
          </form>

          <section className={styles.card}>
            <h2>Current broker assignments</h2>
            <div className={styles.list}>
              {staffAssignments.map((assignment) => (
                <article key={assignment.id}>
                  <b>{assignment.broker?.businessName || assignment.broker?.name}</b>
                  <span>{assignment.staff?.name} · {assignment.broker?.phone}</span>
                  <small>{assignment.assignedArea || assignment.broker?.ward || assignment.broker?.district || assignment.broker?.location}</small>
                  <em>{label(assignment.status)}</em>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post("/api/company-admin/staff-networks", {
                      action: "CHANGE_ASSIGNMENT_STATUS",
                      id: assignment.id,
                      status: assignment.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })}
                  >
                    {assignment.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                  </button>
                </article>
              ))}
              {!staffAssignments.length && <p>No assignments found for the selected staff.</p>}
            </div>
          </section>
        </section>
      )}

      {tab === "PROOFS" && (
        <section className={styles.card}>
          <h2>Proof verification queue</h2>
          <div className={styles.reviewGrid}>
            {review.proofs.map((proof) => (
              <article key={proof.id}>
                <header><b>{proof.referenceNo}</b><em>{label(proof.status)}</em></header>
                <p>{proof.staff?.name} · {proof.senderName} → {proof.receiverName}</p>
                <strong>{money(proof.amount)}</strong>
                <small>{date(proof.transactionAt)} · {label(proof.direction)}</small>
                {proof.smsText && <p>{proof.smsText}</p>}
                {proof.proofUrl && (
                  <a href={proof.proofUrl} target="_blank" rel="noreferrer">Preview proof</a>
                )}
                {proof.status === "PENDING" && <div>
                  <button disabled={busy} onClick={() => void post("/api/company-admin/staff-operations-review", { action: "REVIEW_PROOF", id: proof.id, decision: "VERIFIED" })}>Verify</button>
                  <button disabled={busy} onClick={() => void post("/api/company-admin/staff-operations-review", { action: "REVIEW_PROOF", id: proof.id, decision: "REJECTED", note: "Proof requires correction." })}>Reject</button>
                </div>}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "EXPENSES" && (
        <section className={styles.card}>
          <h2>Expense approval queue</h2>
          <div className={styles.reviewGrid}>
            {review.expenses.map((expense) => (
              <article key={expense.id}>
                <header><b>{expense.otherCategory || label(expense.category)}</b><em>{label(expense.status)}</em></header>
                <p>{expense.employee?.name} · {label(expense.requestMode)}</p>
                <strong>{money(expense.amount)}</strong>
                <small>{date(expense.expenseDate)} · {expense.description}</small>
                {expense.receiptUrl && <a href={expense.receiptUrl} target="_blank" rel="noreferrer">Preview receipt</a>}
                {expense.status === "PENDING" && <div>
                  <button disabled={busy} onClick={() => void post("/api/company-admin/staff-operations-review", { action: "REVIEW_EXPENSE", id: expense.id, decision: "APPROVED" })}>Approve</button>
                  <button disabled={busy} onClick={() => void post("/api/company-admin/staff-operations-review", { action: "REVIEW_EXPENSE", id: expense.id, decision: "REJECTED", note: "Expense requires correction." })}>Reject</button>
                </div>}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
