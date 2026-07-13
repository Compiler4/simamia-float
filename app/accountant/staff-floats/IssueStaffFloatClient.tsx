"use client";

import { type FormEvent, useEffect, useState } from "react";
import styles from "./IssueStaffFloat.module.css";

function money(value: unknown) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

export default function IssueStaffFloatClient({ accountantName }: { accountantName: string }) {
  const [data, setData] = useState<any>({ staff: [], transactions: [] });
  const [form, setForm] = useState({ staffId: "", amount: "", purpose: "Morning broker operations", referenceNo: "", notes: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/accountant/staff-floats", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load staff.");
    setData(result);
  }
  useEffect(() => { void load().catch((e) => setMessage(e.message)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/accountant/staff-floats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Float assignment failed.");
      setMessage(result.message); setForm({ staffId: "", amount: "", purpose: "Morning broker operations", referenceNo: "", notes: "" }); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Float assignment failed."); } finally { setBusy(false); }
  }

  return <main className={styles.page}><header><small>ACCOUNTANT CONTROL</small><h1>Issue Morning Float</h1><p>Welcome, {accountantName}. Assign controlled float to staff officers before broker distribution.</p></header>{message && <div className={styles.message}>{message}</div>}<section className={styles.grid}><form onSubmit={submit}><h2>New staff float</h2><label>Staff officer<select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} required><option value="">Select staff officer</option>{data.staff.map((item: any) => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select></label><label>Amount (TZS)<input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required/></label><label>Purpose<input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required/></label><label>Reference<input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="Automatically generated"/></label><label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label><button disabled={busy}>{busy ? "Assigning..." : "Issue float to staff"}</button></form><article><h2>Recent assignments</h2><div className={styles.rows}>{data.transactions.map((item: any) => <div key={item.id}><span>{item.toUser?.profileImageUrl ? <img src={item.toUser.profileImageUrl} alt=""/> : item.toUser?.name?.slice(0,1)}</span><div><strong>{item.toUser?.name}</strong><small>{item.referenceNo || item.purpose}</small></div><b>{money(item.amount)}</b><em>{item.status}</em></div>)}</div></article></section></main>;
}
