"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import styles from "./AccountantVerificationRequests.module.css";

type Packet = {
  id: string;
  title?: string | null;
  category?: string | null;
  targetType: string;
  targetId: string;
  sentByAdminName: string;
  message: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: string;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

type Props = {
  accountant: { id: string; name: string; email: string };
};

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });
  const raw = await response.text();
  const result = raw ? JSON.parse(raw) : {};
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Request failed.");
  }
  return result as T;
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(value));
}

export default function AccountantVerificationRequestsClient({ accountant }: Props) {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("PENDING");

  async function load() {
    setLoading(true);
    try {
      const result = await json<{ success: true; packets: Packet[] }>(
        "/api/accountant/verification-requests",
      );
      setPackets(Array.isArray(result.packets) ? result.packets : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () => packets.filter((packet) => filter === "ALL" || packet.status === filter),
    [filter, packets],
  );

  async function review(packetId: string, decision: "VERIFIED" | "REJECTED") {
    const reason = reasons[packetId] || "";
    if (decision === "REJECTED" && !reason.trim()) {
      setMessage("Enter a rejection reason first.");
      return;
    }

    setBusy(true);
    try {
      const result = await json<{ success: true; message: string }>(
        "/api/accountant/verification-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REVIEW_PACKET", packetId, decision, reason }),
        },
      );
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <small>ACCOUNTANT PORTAL</small>
          <h1>Verification Requests</h1>
          <p>{accountant.name} · {accountant.email}</p>
        </div>
        <Link href="/accountant/dashboard"><ArrowLeft size={17} /> Dashboard</Link>
      </header>

      {message ? <div className={styles.message}>{message}</div> : null}

      <section className={styles.toolbar}>
        <div>
          <ShieldCheck size={20} />
          <span>Only requests from your company are shown.</span>
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All requests</option>
        </select>
        <button type="button" onClick={() => void load()}><RefreshCw size={17} /> Refresh</button>
      </section>

      {loading ? (
        <div className={styles.state}><RefreshCw className={styles.spin} size={31} />Loading requests…</div>
      ) : (
        <section className={styles.cards}>
          {visible.map((packet) => (
            <article key={packet.id}>
              <header>
                <span><FileCheck2 size={22} /></span>
                <div>
                  <small>{packet.category || packet.targetType}</small>
                  <h2>{packet.title || packet.targetId}</h2>
                  <p>Sent by {packet.sentByAdminName} · {date(packet.createdAt)}</p>
                </div>
                <b data-status={packet.status}>{packet.status.replaceAll("_", " ")}</b>
              </header>

              <div className={styles.body}>
                <p>{packet.message}</p>
                {packet.attachmentUrl ? (
                  <a href={packet.attachmentUrl} target="_blank" rel="noreferrer">
                    <FileText size={17} /> {packet.attachmentName || "Open attachment"}
                  </a>
                ) : null}
                <textarea
                  value={reasons[packet.id] || ""}
                  onChange={(event) => setReasons({ ...reasons, [packet.id]: event.target.value })}
                  placeholder="Verification note or rejection reason"
                  disabled={packet.status !== "PENDING"}
                />
              </div>

              <footer>
                {packet.status === "PENDING" ? (
                  <>
                    <button disabled={busy} onClick={() => void review(packet.id, "VERIFIED")}>
                      <CheckCircle2 size={17} /> Verify
                    </button>
                    <button disabled={busy} className={styles.reject} onClick={() => void review(packet.id, "REJECTED")}>
                      <XCircle size={17} /> Reject
                    </button>
                  </>
                ) : (
                  <p>{packet.reviewReason || "No review note."}</p>
                )}
              </footer>
            </article>
          ))}
          {!visible.length ? <div className={styles.state}>No verification requests match this filter.</div> : null}
        </section>
      )}
    </main>
  );
}
