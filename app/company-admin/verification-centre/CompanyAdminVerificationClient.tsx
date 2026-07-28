"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./CompanyAdminVerificationCentre.module.css";

type TargetType = "STAFF_PROOF" | "BANK_DEPOSIT" | "EXPENSE";

async function json<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "include", ...options });
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(result.message || "Request failed.");
  return result;
}
function money(value: unknown) { return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function label(value: unknown) { return String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase()); }

export default function CompanyAdminVerificationClient({ adminName }: { adminName: string }) {
  const [data, setData] = useState<any>({ packets: [], proofs: [], deposits: [], expenses: [] });
  const [type, setType] = useState<TargetType>("STAFF_PROOF");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() { try { const result = await json("/api/company-admin/verification-packets"); setData(result); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load."); } }
  useEffect(() => { void load(); }, []);
  const targets = useMemo(() => type === "STAFF_PROOF" ? data.proofs : type === "BANK_DEPOSIT" ? data.deposits : data.expenses, [data, type]);
  useEffect(() => { setTargetId(targets[0]?.id || ""); }, [type, targets]);

  async function upload(file: File) {
    const form = new FormData(); form.append("file", file);
    const result = await json<{ url: string }>("/api/accounting-documents/upload", { method: "POST", body: form });
    setAttachmentUrl(result.url); setNotice("Document uploaded.");
  }
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result = await json("/api/company-admin/verification-packets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: type, targetId, message, attachmentUrl }) }); setNotice(result.message); setMessage(""); setAttachmentUrl(""); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : "Send failed."); } finally { setBusy(false); }
  }
  async function decide(decision: string) {
    setBusy(true);
    try { const result = await json("/api/company-admin/expense-decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expenseId: targetId, decision, reason: decisionReason }) }); setNotice(result.message); setDecisionReason(""); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : "Decision failed."); } finally { setBusy(false); }
  }

  const selected = targets.find((row: any) => row.id === targetId);
  return <main className={styles.page}>
    <header><div><small>COMPANY ADMIN CONTROL</small><h1>Verification Centre</h1><p>{adminName}: send comparison files/messages and complete the Company Admin side of expense approval.</p></div><a href="/dashboard">Dashboard</a></header>
    {notice && <div className={styles.notice}>{notice}</div>}
    <section className={styles.tabs}>{(["STAFF_PROOF","BANK_DEPOSIT","EXPENSE"] as TargetType[]).map((item) => <button key={item} className={type === item ? styles.active : ""} onClick={() => setType(item)}>{label(item)}</button>)}</section>
    <section className={styles.grid}>
      <aside>{targets.map((row: any) => <button key={row.id} className={targetId === row.id ? styles.selected : ""} onClick={() => setTargetId(row.id)}><strong>{row.staff?.name || row.employee?.name || row.referenceNo || row.id}</strong><span>{row.referenceNo || row.category || label(row.kind)}</span><b>{money(row.amount)}</b><em>{label(row.status)}</em></button>)}{!targets.length && <p>No records.</p>}</aside>
      <form onSubmit={send}><h2>Send verification packet</h2>{selected && <div className={styles.summary}><strong>{selected.staff?.name || selected.employee?.name || selected.referenceNo}</strong><span>{selected.smsText || selected.description || selected.bankAccount || "Selected record"}</span><b>{money(selected.amount)}</b></div>}
        <label>Message to Accountant<textarea required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain what the accountant must compare or verify." /></label>
        <label>Comparison file<input type="file" accept="image/*,.pdf,.csv,.xls,.xlsx" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} /></label>
        {attachmentUrl && <a href={attachmentUrl} target="_blank" rel="noreferrer">Uploaded comparison file</a>}
        <button disabled={busy || !targetId || !message}>{busy ? "Sending..." : "Send to Accountant"}</button>
        {type === "EXPENSE" && <div className={styles.decision}><h3>Company Admin expense decision</h3><textarea value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} placeholder="Decision reason" /><div><button type="button" disabled={busy || !decisionReason} onClick={() => void decide("APPROVED")}>Approve</button><button type="button" className={styles.reject} disabled={busy || !decisionReason} onClick={() => void decide("REJECTED")}>Reject</button></div></div>}
      </form>
    </section>
  </main>;
}
