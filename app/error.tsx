"use client";

import {
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="routeErrorShell">
      <section className="routeErrorPanel">
        <div className="routeErrorIcon">
          <ShieldAlert size={28} />
        </div>
        <p>Workspace interrupted</p>
        <h1>Something stopped this page from opening.</h1>
        <span>{error.message || "Please refresh this workspace and try again."}</span>
        <button type="button" onClick={reset}>
          <RefreshCw size={17} />
          Try again
        </button>
      </section>
    </main>
  );
}
