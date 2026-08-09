"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, LocateFixed, MapPinOff, ShieldAlert } from "lucide-react";

import styles from "./StaffLocationTracker.module.css";

type Schedule = {
  timeZone: string;
  startTime: string;
  stopTime: string;
  currentLocalDate: string;
  currentLocalTime: string;
  isSharingWindow: boolean;
  mode: "DAY_WINDOW" | "OVERNIGHT_WINDOW" | "ALL_DAY";
};

type ScheduleResponse = {
  success: true;
  schedule: Schedule;
  serverNow: string;
  message: string;
};

type GpsSaveResponse = {
  success: true;
  sharingAllowed: boolean;
  message: string;
  schedule: Schedule;
  warnings?: string[];
};

type TrackerState =
  | "CHECKING"
  | "STARTING"
  | "SHARING"
  | "NIGHT_STOPPED"
  | "PERMISSION_REQUIRED"
  | "UNSUPPORTED"
  | "OFFLINE"
  | "ERROR";

type GpsStatusDetail = {
  state: TrackerState;
  tracking: boolean;
  message: string;
  schedule: Schedule | null;
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  capturedAt?: string;
};

const DEVICE_TOKEN_KEY = "simamia_staff_device_token_v5";
const PERMISSION_NOTICE_KEY = "simamia_staff_gps_permission_notice_date";
const SCHEDULE_STOP_KEY = "simamia_staff_gps_schedule_stop_date";
const SEND_INTERVAL_MS = 15_000;
const SCHEDULE_CHECK_INTERVAL_MS = 30_000;

function getDeviceToken(): string {
  const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing) return existing;

  const value = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_TOKEN_KEY, value);
  return value;
}

function deviceName(): string {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile ? "Staff mobile phone" : "Staff browser device";
}

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
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
    throw new Error(
      [body.message, body.details, body.code].filter(Boolean).join(" · ") ||
        `Request failed (${response.status}).`,
    );
  }

  return body as T;
}

function permissionMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission is blocked. Enable location access for this site.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "The device could not determine its current location.";
  }
  if (error.code === error.TIMEOUT) {
    return "The GPS request timed out. The portal will try again.";
  }
  return error.message || "The GPS location could not be read.";
}

export default function StaffLocationTracker() {
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const scheduleRef = useRef<Schedule | null>(null);
  const stateRef = useRef<TrackerState>("CHECKING");
  const messageRef = useRef("Checking the automatic GPS schedule...");
  const latestRef = useRef<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    capturedAt: string;
  } | null>(null);
  const [state, setState] = useState<TrackerState>("CHECKING");
  const [message, setMessage] = useState("Checking the automatic GPS schedule...");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [latest, setLatest] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    capturedAt: string;
  } | null>(null);

  const publish = useCallback(
    (
      nextState: TrackerState,
      nextMessage: string,
      nextSchedule: Schedule | null = scheduleRef.current,
      position?: {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        capturedAt: string;
      },
    ) => {
      stateRef.current = nextState;
      messageRef.current = nextMessage;
      if (position) latestRef.current = position;
      if (mountedRef.current) {
        setState(nextState);
        setMessage(nextMessage);
        if (nextSchedule) setSchedule(nextSchedule);
        if (position) setLatest(position);
      }

      const detail: GpsStatusDetail = {
        state: nextState,
        tracking: nextState === "SHARING" || nextState === "STARTING",
        message: nextMessage,
        schedule: nextSchedule,
        ...(position || {}),
      };

      window.dispatchEvent(
        new CustomEvent<GpsStatusDetail>("simamia:gps-status", { detail }),
      );
    },
    [],
  );

  const postControlEvent = useCallback(async (event: string) => {
    try {
      await readJson<GpsSaveResponse>("/api/staff/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          deviceToken: getDeviceToken(),
        }),
      });
    } catch (error) {
      console.warn(`[${event}]`, error);
    }
  }, []);

  const clearWatcher = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    sendingRef.current = false;
  }, []);

  const stopForNight = useCallback(
    async (currentSchedule: Schedule) => {
      clearWatcher();
      const stopKey = `${currentSchedule.currentLocalDate}:${currentSchedule.stopTime}`;
      const alreadyReported = window.localStorage.getItem(SCHEDULE_STOP_KEY);

      if (alreadyReported !== stopKey) {
        window.localStorage.setItem(SCHEDULE_STOP_KEY, stopKey);
        await postControlEvent("SCHEDULE_STOP");
      }

      publish(
        "NIGHT_STOPPED",
        `Night schedule: GPS is stopped. It will start automatically at ${currentSchedule.startTime}.`,
        currentSchedule,
      );
    },
    [clearWatcher, postControlEvent, publish],
  );

  const reportPermissionDenied = useCallback(
    async (currentSchedule: Schedule | null) => {
      const today = currentSchedule?.currentLocalDate || new Date().toISOString().slice(0, 10);
      const alreadyReported = window.localStorage.getItem(PERMISSION_NOTICE_KEY);

      if (alreadyReported !== today) {
        window.localStorage.setItem(PERMISSION_NOTICE_KEY, today);
        await postControlEvent("PERMISSION_DENIED");
      }
    },
    [postControlEvent],
  );

  const sendPosition = useCallback(
    async (position: GeolocationPosition) => {
      const currentSchedule = scheduleRef.current;
      if (!currentSchedule?.isSharingWindow) return;

      const now = Date.now();
      if (now - lastSentAtRef.current < SEND_INTERVAL_MS || sendingRef.current) {
        return;
      }

      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        (latitude === 0 && longitude === 0)
      ) {
        publish(
          "ERROR",
          "The device returned an invalid 0,0 GPS coordinate. Waiting for a valid position.",
          currentSchedule,
        );
        return;
      }

      lastSentAtRef.current = now;
      sendingRef.current = true;

      const capturedAt = new Date(position.timestamp || now).toISOString();
      const currentPosition = {
        latitude,
        longitude,
        accuracy: Number.isFinite(Number(position.coords.accuracy))
          ? Number(position.coords.accuracy)
          : null,
        capturedAt,
      };

      try {
        const result = await readJson<GpsSaveResponse>("/api/staff/gps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceToken: getDeviceToken(),
            deviceName: deviceName(),
            latitude,
            longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            capturedAt,
          }),
        });

        scheduleRef.current = result.schedule;
        setSchedule(result.schedule);

        if (!result.sharingAllowed) {
          await stopForNight(result.schedule);
          return;
        }

        publish(
          "SHARING",
          `Automatic GPS is sharing until ${result.schedule.stopTime}.`,
          result.schedule,
          currentPosition,
        );
      } catch (error) {
        const nextMessage =
          error instanceof Error ? error.message : "The GPS location could not be saved.";
        publish(navigator.onLine ? "ERROR" : "OFFLINE", nextMessage, currentSchedule);
      } finally {
        sendingRef.current = false;
      }
    },
    [publish, stopForNight],
  );

  const startWatcher = useCallback(
    async (currentSchedule: Schedule, forcePrompt = false) => {
      if (!currentSchedule.isSharingWindow) {
        await stopForNight(currentSchedule);
        return;
      }

      if (!navigator.geolocation) {
        clearWatcher();
        publish(
          "UNSUPPORTED",
          "This device does not support browser geolocation.",
          currentSchedule,
        );
        return;
      }

      if (watchIdRef.current != null) {
        if (stateRef.current !== "SHARING") {
          publish(
            "STARTING",
            `Automatic GPS is waiting for a position and will stop at ${currentSchedule.stopTime}.`,
            currentSchedule,
          );
        }
        return;
      }

      if (!forcePrompt && navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });

          if (permission.state === "denied") {
            await reportPermissionDenied(currentSchedule);
            publish(
              "PERMISSION_REQUIRED",
              "Location permission is blocked. Open the site settings and allow Location.",
              currentSchedule,
            );
            return;
          }
        } catch {
          // Some browsers do not expose geolocation through the Permissions API.
        }
      }

      publish(
        "STARTING",
        `Starting automatic GPS for the ${currentSchedule.startTime}–${currentSchedule.stopTime} work period...`,
        currentSchedule,
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => void sendPosition(position),
        (error) => {
          clearWatcher();
          const nextMessage = permissionMessage(error);

          if (error.code === error.PERMISSION_DENIED) {
            void reportPermissionDenied(currentSchedule);
            publish("PERMISSION_REQUIRED", nextMessage, currentSchedule);
            return;
          }

          publish(navigator.onLine ? "ERROR" : "OFFLINE", nextMessage, currentSchedule);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5_000,
          timeout: 25_000,
        },
      );
    },
    [clearWatcher, publish, reportPermissionDenied, sendPosition, stopForNight],
  );

  const synchronizeSchedule = useCallback(
    async (forcePrompt = false) => {
      try {
        const result = await readJson<ScheduleResponse>("/api/staff/gps/schedule");
        scheduleRef.current = result.schedule;
        if (mountedRef.current) setSchedule(result.schedule);

        if (result.schedule.isSharingWindow) {
          await startWatcher(result.schedule, forcePrompt);
        } else {
          await stopForNight(result.schedule);
        }
      } catch (error) {
        publish(
          navigator.onLine ? "ERROR" : "OFFLINE",
          error instanceof Error ? error.message : "The GPS schedule could not be checked.",
          scheduleRef.current,
        );
      }
    },
    [publish, startWatcher, stopForNight],
  );

  useEffect(() => {
    mountedRef.current = true;
    void synchronizeSchedule(false);

    const scheduleTimer = window.setInterval(
      () => void synchronizeSchedule(false),
      SCHEDULE_CHECK_INTERVAL_MS,
    );

    const handleResume = () => void synchronizeSchedule(false);
    const handleManualStart = () => void synchronizeSchedule(true);
    const handleStatusRequest = () =>
      publish(
        stateRef.current,
        messageRef.current,
        scheduleRef.current,
        latestRef.current || undefined,
      );

    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);
    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("simamia:gps-request-start", handleManualStart);
    window.addEventListener("simamia:gps-status-request", handleStatusRequest);

    return () => {
      mountedRef.current = false;
      window.clearInterval(scheduleTimer);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("simamia:gps-request-start", handleManualStart);
      window.removeEventListener("simamia:gps-status-request", handleStatusRequest);
      clearWatcher();
    };
  }, [clearWatcher, synchronizeSchedule]);

  const permissionRequired = state === "PERMISSION_REQUIRED";
  const tracking = state === "SHARING" || state === "STARTING";

  return (
    <aside
      className={`${styles.tracker} ${tracking ? styles.active : ""} ${
        state === "NIGHT_STOPPED" ? styles.night : ""
      } ${permissionRequired || state === "ERROR" ? styles.warning : ""}`}
      aria-live="polite"
    >
      <span className={styles.icon}>
        {tracking ? (
          <LocateFixed size={19} />
        ) : state === "NIGHT_STOPPED" ? (
          <Clock3 size={19} />
        ) : permissionRequired ? (
          <ShieldAlert size={19} />
        ) : (
          <MapPinOff size={19} />
        )}
      </span>

      <div className={styles.copy}>
        <strong>
          {tracking
            ? "Automatic GPS active"
            : state === "NIGHT_STOPPED"
              ? "Automatic night stop"
              : permissionRequired
                ? "GPS permission needed"
                : "Automatic GPS"}
        </strong>
        <small>{message}</small>
        {latest && tracking && (
          <em>
            {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}
            {latest.accuracy != null ? ` · ±${Math.round(latest.accuracy)} m` : ""}
          </em>
        )}
        {schedule && (
          <em>
            Daily schedule: {schedule.startTime}–{schedule.stopTime} · {schedule.timeZone}
          </em>
        )}
      </div>

      {(permissionRequired || state === "ERROR" || state === "OFFLINE") &&
        schedule?.isSharingWindow && (
          <button
            type="button"
            onClick={() => {
              clearWatcher();
              void synchronizeSchedule(true);
            }}
          >
            Enable GPS
          </button>
        )}
    </aside>
  );
}
