"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LocateFixed, MapPin, Radio, ShieldCheck, Square } from "lucide-react";

import styles from "./agent-location.module.css";

type BrokerInfo = {
  id: string;
  name: string;
  businessName: string | null;
  code: string;
  location: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });
  const raw = await response.text();
  let body: any = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Server returned invalid JSON (${response.status}).`);
  }
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${response.status}).`);
  }
  return body as T;
}

export default function AgentLocationShareClient({ token }: { token: string }) {
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const [broker, setBroker] = useState<BrokerInfo | null>(null);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSent, setLastSent] = useState("");

  useEffect(() => {
    void requestJson<{ success: true; broker: BrokerInfo }>(
      `/api/agent-location/${encodeURIComponent(token)}`,
    )
      .then((result) => setBroker(result.broker))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "The sharing page could not load."),
      )
      .finally(() => setLoading(false));

    return () => {
      if (watchId.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [token]);

  async function send(position: GeolocationPosition) {
    const now = Date.now();
    if (now - lastSentAt.current < 12_000) return;
    lastSentAt.current = now;
    setAccuracy(position.coords.accuracy);

    const result = await requestJson<{ success: true; message: string; capturedAt: string }>(
      `/api/agent-location/${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      },
    );

    setMessage(result.message);
    setLastSent(result.capturedAt);
  }

  function startSharing() {
    if (!navigator.geolocation) {
      setError("This phone does not support browser geolocation.");
      return;
    }

    setError("");
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        void send(position).catch((shareError) => {
          setError(shareError instanceof Error ? shareError.message : "Location sharing failed.");
        });
      },
      (locationError) => {
        setError(locationError.message || "Location permission is required.");
        setSharing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3_000,
        timeout: 25_000,
      },
    );
  }

  function stopSharing() {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    setMessage("Live location sharing stopped.");
  }

  if (loading) {
    return <main className={styles.page}><section className={styles.card}><div className={styles.loader} /><h1>Loading secure location link</h1></section></main>;
  }

  if (error && !broker) {
    return <main className={styles.page}><section className={styles.card}><MapPin size={42} /><h1>Location link unavailable</h1><p>{error}</p></section></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.badge}><ShieldCheck size={16} /> Secure Simamia Float link</div>
        <div className={styles.icon}><LocateFixed size={36} /></div>
        <small>REGISTERED AGENT LIVE GPS</small>
        <h1>{broker?.businessName || broker?.name || "Agent location"}</h1>
        <p>{[broker?.code, broker?.address, broker?.ward, broker?.district, broker?.region, broker?.location].filter(Boolean).join(" · ")}</p>

        <div className={styles.statusGrid}>
          <article><Radio size={20} /><span><small>Status</small><strong>{sharing ? "Sharing live" : "Stopped"}</strong></span></article>
          <article><MapPin size={20} /><span><small>Accuracy</small><strong>{accuracy == null ? "—" : `${Math.round(accuracy)} m`}</strong></span></article>
          <article><CheckCircle2 size={20} /><span><small>Last sent</small><strong>{lastSent ? new Date(lastSent).toLocaleTimeString("en-GB") : "—"}</strong></span></article>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        {!sharing ? (
          <button type="button" className={styles.primary} onClick={startSharing}>
            <Radio size={20} /> Start sharing live location
          </button>
        ) : (
          <button type="button" className={styles.stop} onClick={stopSharing}>
            <Square size={18} /> Stop sharing
          </button>
        )}

        <footer>
          Keep this page open while sharing. The Staff Portal receives only this agent's GPS position. The link can be replaced by the assigned Staff Officer.
        </footer>
      </section>
    </main>
  );
}
