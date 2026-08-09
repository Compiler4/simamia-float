"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DeviceTracker.module.css";

type TrackerState = "IDLE" | "STARTING" | "TRACKING" | "ERROR";

export default function DeviceTrackerPage() {
  const [deviceToken, setDeviceToken] = useState("");
  const [state, setState] = useState<TrackerState>("IDLE");
  const [message, setMessage] = useState(
    "Enter the token created by your Company Admin.",
  );
  const [lastPosition, setLastPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speedKph: number | null;
    sentAt: string;
  } | null>(null);

  const watchId = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("simamia_gps_device_token");
    if (saved) setDeviceToken(saved);

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  async function sendPosition(position: GeolocationPosition) {
    const batteryManager = await (
      navigator as Navigator & {
        getBattery?: () => Promise<{ level: number }>;
      }
    ).getBattery?.();

    const speedKph =
      position.coords.speed === null
        ? null
        : Math.max(0, position.coords.speed * 3.6);

    const response = await fetch("/api/gps/ping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-token": deviceToken.trim(),
      },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speedKph,
        batteryLevel: batteryManager
          ? Math.round(batteryManager.level * 100)
          : null,
        capturedAt: new Date(position.timestamp).toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Location could not be sent.");
    }

    setLastPosition({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speedKph,
      sentAt: new Date().toISOString(),
    });
    setMessage("Live location sent successfully.");
  }

  function startTracking() {
    if (!deviceToken.trim()) {
      setState("ERROR");
      setMessage("Enter the device token first.");
      return;
    }

    if (!navigator.geolocation) {
      setState("ERROR");
      setMessage("This browser does not support GPS location.");
      return;
    }

    localStorage.setItem("simamia_gps_device_token", deviceToken.trim());
    setState("STARTING");
    setMessage("Requesting GPS permission...");

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await sendPosition(position);
          setState("TRACKING");
        } catch (error) {
          setState("ERROR");
          setMessage(
            error instanceof Error ? error.message : "GPS update failed.",
          );
        }
      },
      (error) => {
        setState("ERROR");
        setMessage(error.message || "Location permission was denied.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );
  }

  function stopTracking() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setState("IDLE");
    setMessage("Tracking stopped.");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logo}>SF</div>
        <p className={styles.eyebrow}>Simamia Float GPS</p>
        <h1>Phone Device Tracker</h1>
        <p className={styles.description}>
          Keep this page open while working. Your phone sends live GPS,
          accuracy, speed and supported battery information to your company
          portal.
        </p>

        <label className={styles.field}>
          Device token
          <input
            value={deviceToken}
            onChange={(event) => setDeviceToken(event.target.value)}
            placeholder="Paste the token from Company Admin"
            autoComplete="off"
          />
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={startTracking}
            disabled={state === "TRACKING" || state === "STARTING"}
          >
            {state === "STARTING" ? "Starting..." : "Start live tracking"}
          </button>
          <button type="button" onClick={stopTracking}>
            Stop
          </button>
        </div>

        <div
          className={`${styles.status} ${
            state === "TRACKING"
              ? styles.success
              : state === "ERROR"
                ? styles.error
                : ""
          }`}
        >
          <span></span>
          <div>
            <strong>{state}</strong>
            <p>{message}</p>
          </div>
        </div>

        {lastPosition && (
          <div className={styles.positionGrid}>
            <article>
              <span>Latitude</span>
              <strong>{lastPosition.latitude.toFixed(6)}</strong>
            </article>
            <article>
              <span>Longitude</span>
              <strong>{lastPosition.longitude.toFixed(6)}</strong>
            </article>
            <article>
              <span>Accuracy</span>
              <strong>
                {lastPosition.accuracy
                  ? `${Math.round(lastPosition.accuracy)} m`
                  : "N/A"}
              </strong>
            </article>
            <article>
              <span>Speed</span>
              <strong>
                {lastPosition.speedKph === null
                  ? "N/A"
                  : `${lastPosition.speedKph.toFixed(1)} km/h`}
              </strong>
            </article>
          </div>
        )}

        <div className={styles.note}>
          On Android, allow precise location and disable battery optimization
          for the browser. On iPhone, allow location “While Using the App” and
          keep the page visible because Safari may pause background tracking.
        </div>
      </section>
    </main>
  );
}
