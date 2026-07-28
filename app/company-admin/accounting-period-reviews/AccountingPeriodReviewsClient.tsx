"use client";

import { useEffect, useState } from "react";

async function json(url: string, options?: RequestInit) { const response = await fetch(url, { cache: "no-store", credentials: "include", ...options }); const raw = await response.text(); const result = raw ? JSON.parse(raw) : {}; if (!response.ok || result.success === false) throw new Error(result.message || "Request failed."); return result; }

export default function AccountingPeriodReviewsClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  async function load() { try { const result = await json("/api/company-admin/accounting-period-reviews"); setRows(result.rows || []); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load requests."); } }
  useEffect(() => { void load(); }, []);
  async function review(requestId: string, decision: string) { try { const result = await json("/api/company-admin/accounting-period-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, decision, reviewNote: note }) }); setMessage(result.message); setNote(""); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Review failed."); } }
  return <main style={{minHeight:"100vh",padding:24,background:"#f4f6fb",fontFamily:"Inter,system-ui"}}><h1>Accounting Period Reopen Reviews</h1><p>{message}</p><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Company Admin review note" style={{width:"100%",maxWidth:900,minHeight:90,padding:12,borderRadius:12,border:"1px solid #dfe4ee"}} /><section style={{display:"grid",gap:10,maxWidth:1100,marginTop:15}}>{rows.map((row) => <article key={row.id} style={{padding:16,borderRadius:16,background:"white",boxShadow:"0 10px 30px rgba(30,40,70,.08)"}}><strong>{row.period?.label}</strong><p>{row.reason}</p><small>{row.status}</small>{row.status === "PENDING" && <div style={{display:"flex",gap:8,marginTop:10}}><button disabled={!note} onClick={() => void review(row.id,"APPROVED")}>Approve and reopen</button><button disabled={!note} onClick={() => void review(row.id,"REJECTED")}>Reject</button></div>}</article>)}</section></main>;
}
