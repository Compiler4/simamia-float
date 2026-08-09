import {
  Banknote,
  ShieldCheck,
} from "lucide-react";

export default function Loading() {
  return (
    <main className="routeLoadingShell" aria-busy="true" aria-live="polite">
      <div className="routeLoadingPanel">
        <div className="routeLoadingMark">
          <ShieldCheck size={26} />
          <Banknote size={22} />
        </div>
        <div>
          <p>Preparing Simamia Float</p>
          <strong>Loading secure workspace</strong>
        </div>
        <span className="routeLoadingBar" />
      </div>
    </main>
  );
}
