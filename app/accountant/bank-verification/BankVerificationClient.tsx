"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./BankVerification.module.css";

type Deposit = Record<string, any>;

function money(value: unknown) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function BankVerificationClient() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ statementAmount: "", statementReference: "", statementDate: "", statementBankAccount: "", bankStatementUrl: "" });

  const selected = useMemo(() => deposits.find((item) => item.id === selectedId) || deposits[0], [deposits, selectedId]);

  async function load() {
    const response = await fetch("/api/accountant/bank-verification", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load deposits.");
    setDeposits(result.deposits || []);
    if (!selectedId && result.deposits?.[0]) setSelectedId(result.deposits[0].id);
  }

  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);
  useEffect(() => {
    if (!selected) return;
    setForm({
      statementAmount: selected.statementAmount == null ? "" : String(selected.statementAmount),
      statementReference: selected.statementReference || "",
      statementDate: selected.statementDate ? String(selected.statementDate).slice(0, 10) : "",
      statementBankAccount: selected.statementBankAccount || "",
      bankStatementUrl: selected.bankStatementUrl || "",
    });
  }, [selected?.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch("/api/accountant/bank-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId: selected.id, ...form }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Verification failed.");
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header><div><small>ACCOUNTING CONTROL</small><h1>Bank Deposit Verification</h1><p>Compare the staff submission with the real bank record.</p></div><a href="/accountant/dashboard">Back to dashboard</a></header>
      {message && <div className={styles.message}>{message}</div>}
      <section className={styles.layout}>
        <aside>
          {deposits.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} className={item.id === selected?.id ? styles.active : ""}>
              <strong>{item.staff?.name || "Staff"}</strong><span>{item.referenceNo || "No reference"}</span><b>{money(item.amount)}</b><em>{String(item.status).replaceAll("_", " ")}</em>
            </button>
          ))}
        </aside>
        <form onSubmit={submit}>
          {selected ? <>
            <div className={styles.staff}><strong>{selected.staff?.name}</strong><span>{selected.staff?.email}</span><b>Submitted {money(selected.amount)} to {selected.bankAccount}</b></div>
            <div className={styles.grid}>
              <label>Bank statement amount<input type="number" min="1" value={form.statementAmount} onChange={(e) => setForm({ ...form, statementAmount: e.target.value })} required /></label>
              <label>Statement reference<input value={form.statementReference} onChange={(e) => setForm({ ...form, statementReference: e.target.value })} required /></label>
              <label>Statement date<input type="date" value={form.statementDate} onChange={(e) => setForm({ ...form, statementDate: e.target.value })} required /></label>
              <label>Statement bank account<input value={form.statementBankAccount} onChange={(e) => setForm({ ...form, statementBankAccount: e.target.value })} required /></label>
            </div>
            <label>Bank statement file URL<input value={form.bankStatementUrl} onChange={(e) => setForm({ ...form, bankStatementUrl: e.target.value })} placeholder="Optional uploaded statement URL" /></label>
            <div className={styles.compare}>
              <span>Staff amount: <b>{money(selected.amount)}</b></span><span>Reference: <b>{selected.referenceNo}</b></span><span>Date: <b>{String(selected.depositDate).slice(0, 10)}</b></span><span>Account: <b>{selected.bankAccount}</b></span>
            </div>
            <button className={styles.submit} disabled={busy}>{busy ? "Comparing..." : "Compare and verify deposit"}</button>
          </> : <p>No bank deposits found.</p>}
        </form>
      </section>
    </main>
  );
}
