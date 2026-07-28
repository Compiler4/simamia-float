"use client";

import { useEffect } from "react";

const DEVICE_TOKEN_KEY = "simamia_staff_device_token_v4";

function deviceToken(): string {
  const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

async function postLocation(body: Record<string, unknown>) {
  await fetch("/api/staff/gps", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export default function StaffLocationTracker() {
  useEffect(() => {
    if (!navigator.geolocation) return;

    let stopped = false;
    let lastSentAt = 0;
    let lastPosition: GeolocationPosition | null = null;
    const token = deviceToken();

    function submit(position: GeolocationPosition) {
      if (stopped) return;
      const now = Date.now();
      lastPosition = position;

      if (now - lastSentAt < 15_000) {
        return;
      }

      lastSentAt = now;
      void postLocation({
        deviceToken: token,
        deviceName:
          (navigator as any).userAgentData?.platform ||
          navigator.platform ||
          "Staff installed PWA device",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        capturedAt: new Date(position.timestamp).toISOString(),
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      submit,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          void postLocation({
            event: "DISABLED",
            deviceToken: token,
            capturedAt: new Date().toISOString(),
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 8_000,
        timeout: 25_000,
      },
    );

    const heartbeat = window.setInterval(() => {
      if (lastPosition) submit(lastPosition);
    }, 30_000);

    const visibility = () => {
      if (document.visibilityState === "visible") {
        navigator.geolocation.getCurrentPosition(
          submit,
          () => undefined,
          {
            enableHighAccuracy: true,
            maximumAge: 5_000,
            timeout: 20_000,
          },
        );
      }
    };

    document.addEventListener("visibilitychange", visibility);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return null;
}
