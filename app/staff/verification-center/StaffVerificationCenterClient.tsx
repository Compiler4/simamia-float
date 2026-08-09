"use client";

import { type FormEvent, useEffect, useState } from "react";

import styles from "@/components/accountant-v3/WorkflowBridge.module.css";

type Props = { staff: { id: string; name: string; email: string } };

function Icon({ name }: { name: string }) { return <span className="material-symbols-rounded">{name}</span>; }

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...options });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok || result.success === false) throw new Error(result.message || `Request failed (${response.status}).`);
  return result as T;
}

async function upload(file: File) {
  const form = new FormData();
  form.append("file", file);
  return json<{ success: true; url: string }>("/api/accountant-v3/uploads", { method: "POST", body: form });
}

export default function StaffVerificationCenterClient({ staff }: Props) {
  const [data, setData] = useState<any>({ packets: [], bankComparisons: [] });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [packet, setPacket] = useState({ kind: "PROOF", staffMessage: "", staffFileUrl: "" });
  const [bank, setBank] = useState({ staffAmount: "", staffReference: "", staffDate: new Date().toISOString().slice(0,10), staffBankAccount: "", staffFileUrl: "" });

  useEffect(() => { void load(); }, []);
  async function load() { try { setData(await json("/api/staff/verification-packets")); } catch (error) { setToast(error instanceof Error ? error.message : "Could not load records."); } }
  async function fileChange(file: File | undefined, target: "packet" | "bank") {
    if (!file) return;
    setBusy(true);
    try { const result = await upload(file); target === "packet" ? setPacket({ ...packet, staffFileUrl: result.url }) : setBank({ ...bank, staffFileUrl: result.url }); setToast("File uploaded."); }
    catch (error) { setToast(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  async function submitPacket(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result:any = await json("/api/staff/verification-packets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"SUBMIT_PACKET", ...packet }) }); setToast(result.message); setPacket({ ...packet, staffMessage:"", staffFileUrl:"" }); await load(); }
    catch(error){setToast(error instanceof Error?error.message:"Submission failed.");} finally{setBusy(false);}
  }
  async function submitBank(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result:any = await json("/api/staff/verification-packets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"SUBMIT_BANK_PROOF", ...bank }) }); setToast(result.message); setBank({ ...bank, staffAmount:"", staffReference:"", staffFileUrl:"" }); await load(); }
    catch(error){setToast(error instanceof Error?error.message:"Bank proof failed.");} finally{setBusy(false);}
  }

  return <main className={styles.page}>
    {toast && <div className={styles.toast}>{toast}</div>}
    <header className={styles.top}><div><span className={styles.icon}><Icon name="fact_check" /></span><div><small>STAFF PORTAL</small><h1>Verification & Bank Proof Center</h1><p>{staff.name} · {staff.email}</p></div></div><a href="/staff/dashboard"><Icon name="arrow_back" />Staff dashboard</a></header>
    <section className={styles.grid}>
      <article className={styles.panel}><header><h2>Upload SMS, proof or document</h2><p>Company Admin adds a reference, then Accountant verifies or rejects.</p></header><form className={styles.form} onSubmit={submitPacket}><label><span>Evidence type</span><select value={packet.kind} onChange={e=>setPacket({...packet,kind:e.target.value})}><option value="SMS">SMS / message</option><option value="PROOF">Proof</option><option value="DOCUMENT">Document</option><option value="BANK_REFERENCE">Bank reference</option></select></label><label><span>Message or explanation</span><textarea value={packet.staffMessage} onChange={e=>setPacket({...packet,staffMessage:e.target.value})} placeholder="Paste SMS content or explain the proof" /></label><label className={styles.upload}><Icon name="upload_file" /><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xls,.xlsx,.doc,.docx" onChange={e=>void fileChange(e.target.files?.[0],"packet")} />{packet.staffFileUrl && <small>Uploaded: {packet.staffFileUrl}</small>}</label><button className={styles.button} disabled={busy}><Icon name="send" />Send for verification</button></form></article>
      <article className={styles.panel}><header><h2>Upload bank proof</h2><p>The Company Admin statement is required before Accountant reconciliation.</p></header><form className={styles.form} onSubmit={submitBank}><div className={styles.pair}><label><span>Amount (TZS)</span><input required type="number" min="1" value={bank.staffAmount} onChange={e=>setBank({...bank,staffAmount:e.target.value})} /></label><label><span>Deposit date</span><input required type="date" value={bank.staffDate} onChange={e=>setBank({...bank,staffDate:e.target.value})} /></label></div><label><span>Reference number</span><input required value={bank.staffReference} onChange={e=>setBank({...bank,staffReference:e.target.value})} /></label><label><span>Bank account</span><input required value={bank.staffBankAccount} onChange={e=>setBank({...bank,staffBankAccount:e.target.value})} /></label><label className={styles.upload}><Icon name="upload_file" /><input required={!bank.staffFileUrl} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>void fileChange(e.target.files?.[0],"bank")} />{bank.staffFileUrl && <small>Uploaded: {bank.staffFileUrl}</small>}</label><button className={styles.button} disabled={busy}><Icon name="account_balance" />Submit bank proof</button></form></article>
    </section>
    <article className={styles.panel}><header><h2>My verification history</h2><p>Accountant decisions and reasons appear here.</p></header><div className={styles.cards}>{data.packets.map((item:any)=><article className={styles.card} key={item.id}><header><div><small>{item.kind}</small><strong>{item.staffMessage||"Uploaded file"}</strong></div><span className={`${styles.badge} ${item.status==="VERIFIED"?styles.ok:item.status==="REJECTED"?styles.bad:""}`}>{String(item.status).replaceAll("_"," ")}</span></header><p>{item.decisionReason||"No accountant reason yet."}</p><div className={styles.links}>{item.staffFileUrl&&<a href={item.staffFileUrl} target="_blank" rel="noreferrer">Open my file</a>}{item.adminReferenceUrl&&<a href={item.adminReferenceUrl} target="_blank" rel="noreferrer">Open admin reference</a>}</div></article>)}{!data.packets.length&&<div className={styles.empty}>No verification uploads yet.</div>}</div></article>
    <article className={styles.panel}><header><h2>My bank reconciliation history</h2><p>See whether Company Admin supplied a statement and whether Accountant verified the match.</p></header><div className={styles.table}><table><thead><tr><th>Date</th><th>Reference</th><th>Amount</th><th>Admin statement</th><th>Decision</th><th>Reason</th></tr></thead><tbody>{data.bankComparisons.map((item:any)=><tr key={item.id}><td>{item.staffDate?new Date(item.staffDate).toLocaleDateString("en-GB"):"—"}</td><td><strong>{item.staffReference||"—"}</strong></td><td>{new Intl.NumberFormat("en-TZ",{style:"currency",currency:"TZS",maximumFractionDigits:0}).format(Number(item.staffAmount||0))}</td><td>{item.adminReference?`${item.adminReference} · ${item.adminBankAccount||"No account"}`:"Waiting for Company Admin"}</td><td><span className={`${styles.badge} ${item.accountantDecision==="APPROVE"?styles.ok:item.accountantDecision==="REJECT"?styles.bad:""}`}>{item.accountantDecision||"PENDING"}</span></td><td>{item.mismatchReason||"—"}</td></tr>)}</tbody></table></div>{!data.bankComparisons.length&&<div className={styles.empty}>No bank proofs submitted yet.</div>}</article>
  </main>;
}
