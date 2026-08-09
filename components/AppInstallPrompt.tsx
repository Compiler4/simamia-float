"use client";

import {
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import styles from "./AppInstallPrompt.module.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "simamia_install_prompt_dismissed";

export default function AppInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsOnline(window.navigator.onLine);
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setDismissed(true);
      window.localStorage.setItem(DISMISSED_KEY, "true");
    }
    setInstallEvent(null);
  }

  async function refreshApp() {
    setRefreshing(true);
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    window.location.reload();
  }

  function dismissPrompt() {
    setDismissed(true);
    window.localStorage.setItem(DISMISSED_KEY, "true");
  }

  if (isStandalone && isOnline) return null;

  return (
    <aside className={styles.prompt} aria-live="polite">
      <div className={isOnline ? styles.statusOnline : styles.statusOffline}>
        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
        <span>{isOnline ? "Live connection" : "Offline mode"}</span>
      </div>

      {!dismissed && installEvent ? (
        <div className={styles.installCard}>
          <button
            className={styles.close}
            type="button"
            aria-label="Hide install prompt"
            onClick={dismissPrompt}
          >
            <X size={16} />
          </button>
          <strong>Install Simamia Float</strong>
          <span>Open it like a phone app with faster access on this device.</span>
          <button className={styles.action} type="button" onClick={installApp}>
            <Download size={17} />
            Install app
          </button>
        </div>
      ) : (
        <button
          className={styles.refresh}
          type="button"
          onClick={refreshApp}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? styles.spin : ""} />
          Sync
        </button>
      )}
    </aside>
  );
}
