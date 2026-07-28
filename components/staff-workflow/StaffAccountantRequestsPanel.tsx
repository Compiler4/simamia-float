"use client";

import { type FormEvent, useEffect, useState } from "react";

import styles from "./StaffAccountantRequestsPanel.module.css";

type Tab = "expense" | "proof" | "funding";

async function requestJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...options,
  });
  const raw = await response.text();
  const result = raw ? JSON.parse(raw) : {};
  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status}).`);
  }
  return result;
}

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

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date());
}

export default function StaffAccountantRequestsPanel() {
  const [tab, setTab] = useState<Tab>("expense");
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [proofRows, setProofRows] = useState<any[]>([]);
  const [fundingRows, setFundingRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [expense, setExpense] = useState({
    expenseDate: today(),
    requestMode: "ADVANCE_REQUEST",
    category: "TRANSPORT",
    otherCategory: "",
    amount: "",
    requestedAction: "",
    description: "",
    receiptUrl: "",
  });
  const [proof, setProof] = useState({
    direction: "STAFF_TO_ACCOUNTANT",
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

  async function load() {
    try {
      const [expenses, proofs, funding] = await Promise.all([
        requestJson("/api/staff/expense-requests"),
        requestJson("/api/staff/proofs"),
        requestJson("/api/staff/funding-receipts"),
      ]);
      setExpenseRows(expenses.rows || []);
      setProofRows(proofs.rows || []);
      setFundingRows(funding.rows || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Staff records could not load.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(file: File, destination: "expense" | "proof") {
    const form = new FormData();
    form.append("file", file);
    const result = await requestJson<{ url: string }>(
      "/api/accounting-documents/upload",
      { method: "POST", body: form },
    );
    if (destination === "expense") {
      setExpense((current) => ({ ...current, receiptUrl: result.url }));
    } else {
      setProof((current) => ({ ...current, proofUrl: result.url }));
    }
    setNotice("Supporting document uploaded.");
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await requestJson("/api/staff/expense-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expense),
      });
      setNotice(result.message);
      setExpense((current) => ({
        ...current,
        amount: "",
        requestedAction: "",
        description: "",
        receiptUrl: "",
      }));
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Expense request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await requestJson("/api/staff/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });
      setNotice(result.message);
      setProof((current) => ({
        ...current,
        referenceNo: "",
        transactionId: "",
        amount: "",
        smsText: "",
        proofUrl: "",
      }));
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Proof submission failed.");
    } finally {
      setBusy(false);
    }
  }

  async function decideFunding(receiptId: string, decision: string) {
    const reason =
      decision === "REJECTED"
        ? window.prompt("Why are you rejecting this funding?") || ""
        : "";
    if (decision === "REJECTED" && !reason) return;
    setBusy(true);
    try {
      const result = await requestJson("/api/staff/funding-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId, decision, reason }),
      });
      setNotice(result.message);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Funding decision failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.heroIcon}>assignment</span>
        <div>
          <small>STAFF OPERATIONS</small>
          <h2>Requests, Proofs and Funding</h2>
          <p>Send records to the Accountant and follow every review decision.</p>
        </div>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}

      <nav className={styles.tabs}>
        <button className={tab === "expense" ? styles.active : ""} onClick={() => setTab("expense")}>Expense Request</button>
        <button className={tab === "proof" ? styles.active : ""} onClick={() => setTab("proof")}>SMS / Proof</button>
        <button className={tab === "funding" ? styles.active : ""} onClick={() => setTab("funding")}>Float + Cash</button>
      </nav>

      {tab === "expense" && (
        <div className={styles.workspace}>
          <form className={styles.card} onSubmit={submitExpense}>
            <h3>New expense request</h3>
            <div className={styles.formGrid}>
              <label>Date<input type="date" value={expense.expenseDate} onChange={(event) => setExpense({ ...expense, expenseDate: event.target.value })} required /></label>
              <label>Request type<select value={expense.requestMode} onChange={(event) => setExpense({ ...expense, requestMode: event.target.value })}><option value="ADVANCE_REQUEST">Advance request</option><option value="REIMBURSEMENT">Reimbursement</option><option value="DIRECT_PAYMENT_REQUEST">Direct payment</option></select></label>
              <label>Category<select value={expense.category} onChange={(event) => setExpense({ ...expense, category: event.target.value })}><option>TRANSPORT</option><option>FUEL</option><option>AIRTIME</option><option>MEALS</option><option>ACCOMMODATION</option><option>OTHER</option></select></label>
              <label>Amount<input type="number" min="1" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} required /></label>
            </div>
            <label>Requested action<input value={expense.requestedAction} onChange={(event) => setExpense({ ...expense, requestedAction: event.target.value })} placeholder="What should the company pay or provide?" /></label>
            <label>Reason<textarea value={expense.description} onChange={(event) => setExpense({ ...expense, description: event.target.value })} required /></label>
            <label className={styles.upload}>Receipt / quotation<input type="file" accept="image/*,.pdf" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], "expense")} /></label>
            <button className={styles.primary} disabled={busy}>{busy ? "Submitting..." : "Submit expense request"}</button>
          </form>
          <RecordList rows={expenseRows} type="expense" />
        </div>
      )}

      {tab === "proof" && (
        <div className={styles.workspace}>
          <form className={styles.card} onSubmit={submitProof}>
            <h3>Upload SMS or proof</h3>
            <div className={styles.formGrid}>
              <label>Reference<input value={proof.referenceNo} onChange={(event) => setProof({ ...proof, referenceNo: event.target.value })} required /></label>
              <label>Amount<input type="number" min="1" value={proof.amount} onChange={(event) => setProof({ ...proof, amount: event.target.value })} required /></label>
              <label>Sender<input value={proof.senderName} onChange={(event) => setProof({ ...proof, senderName: event.target.value })} required /></label>
              <label>Receiver<input value={proof.receiverName} onChange={(event) => setProof({ ...proof, receiverName: event.target.value })} required /></label>
              <label>Direction<select value={proof.direction} onChange={(event) => setProof({ ...proof, direction: event.target.value })}><option>STAFF_TO_ACCOUNTANT</option><option>STAFF_TO_BANK</option><option>STAFF_TO_BROKER</option><option>BROKER_TO_STAFF</option><option>EXPENSE_PAYMENT</option><option>OTHER</option></select></label>
              <label>Transaction time<input type="datetime-local" value={proof.transactionAt} onChange={(event) => setProof({ ...proof, transactionAt: event.target.value })} required /></label>
            </div>
            <label>SMS text<textarea value={proof.smsText} onChange={(event) => setProof({ ...proof, smsText: event.target.value })} placeholder="Paste the complete SMS message" /></label>
            <label className={styles.upload}>Screenshot / document<input type="file" accept="image/*,.pdf" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], "proof")} /></label>
            <button className={styles.primary} disabled={busy}>{busy ? "Submitting..." : "Submit proof"}</button>
          </form>
          <RecordList rows={proofRows} type="proof" />
        </div>
      )}

      {tab === "funding" && (
        <article className={styles.card}>
          <h3>Funding awaiting your confirmation</h3>
          <div className={styles.fundingList}>
            {fundingRows.map((row) => (
              <article key={row.id}>
                <div><strong>{row.referenceNo}</strong><small>{row.accountant?.name || "Accountant"}</small></div>
                <span>Float <b>{money(row.floatAmount)}</b></span>
                <span>Cash <b>{money(row.cashAmount)}</b></span>
                <span>Total <b>{money(row.totalAmount)}</b></span>
                <em>{label(row.status)}</em>
                {row.status === "PENDING" && <div><button disabled={busy} onClick={() => void decideFunding(row.id, "CONFIRMED")}>Confirm</button><button disabled={busy} className={styles.reject} onClick={() => void decideFunding(row.id, "REJECTED")}>Reject</button></div>}
              </article>
            ))}
            {!fundingRows.length && <p>No funding records.</p>}
          </div>
        </article>
      )}
    </section>
  );
}

function RecordList({ rows, type }: { rows: any[]; type: "expense" | "proof" }) {
  return (
    <article className={styles.card}>
      <h3>{type === "expense" ? "My expense requests" : "My uploaded proofs"}</h3>
      <div className={styles.records}>
        {rows.map((row) => (
          <article key={row.id}>
            <div><strong>{row.referenceNo || row.category}</strong><small>{row.description || row.smsText || label(row.kind)}</small></div>
            <b>{money(row.amount)}</b>
            <em>{label(row.status)}</em>
            {row.reviewNote && <p>{row.reviewNote}</p>}
            {row.verificationNote && <p>{row.verificationNote}</p>}
          </article>
        ))}
        {!rows.length && <p>No records yet.</p>}
      </div>
    </article>
  );
}
