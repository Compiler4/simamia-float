"use client";

import dynamic from "next/dynamic";

import styles from "./StaffDashboard.module.css";

type StaffDashboardEntryProps = {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    roleLabel: string;
    companyId: string | null;
  };
  initialDate: string;
};

/**
 * The staff workspace contains browser-only features (GPS, canvas image
 * compression, localStorage, navigator and Leaflet). Rendering that large
 * interactive tree on the server gives React two chances to disagree about
 * the first DOM tree during development/HMR.
 *
 * Keep this tiny boundary as the only server-prerendered client component and
 * mount the real dashboard exclusively in the browser.
 */
const StaffDashboardClient = dynamic(
  () => import("./StaffDashboardClient"),
  {
    ssr: false,
    loading: () => <StaffDashboardBootScreen />,
  },
);

function StaffDashboardBootScreen() {
  return (
    <main className={styles.clientBootShell} aria-busy="true">
      <section className={styles.clientBootCard}>
        <span className={styles.clientBootMark}>SI</span>
        <div>
          <small>SECURE STAFF WORKSPACE</small>
          <h1>Simamia Float</h1>
          <p>Loading your staff dashboard and live operations…</p>
        </div>
        <i className={styles.clientBootSpinner} aria-hidden="true" />
      </section>
    </main>
  );
}

export default function StaffDashboardEntry(props: StaffDashboardEntryProps) {
  return <StaffDashboardClient {...props} />;
}
