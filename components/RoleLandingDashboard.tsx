"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./RoleLandingDashboard.module.css";

type Props = {
  title: string;
  description: string;
  roleLabel: string;
  name: string;
  email: string;
  companyName?: string | null;
};

export default function RoleLandingDashboard({
  title,
  description,
  roleLabel,
  name,
  email,
  companyName,
}: Props) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <p className={styles.eyebrow}>SIMAMIA FLOAT · {roleLabel}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{description}</p>
          </div>
          <button className={styles.logout} type="button" onClick={logout} disabled={leaving}>
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <section className={styles.grid} aria-label="Account overview">
          <article className={styles.card}>
            <h2>Signed-in account</h2>
            <p>{name}</p>
            <p>{email}</p>
            <span className={styles.status}>Authenticated</span>
          </article>
          <article className={styles.card}>
            <h2>Organisation</h2>
            <p>{companyName || "SIMAMIA workspace"}</p>
            <p>Your account is connected to the online Hostinger workspace.</p>
          </article>
          <article className={styles.card}>
            <h2>Workspace status</h2>
            <p>The role route is active and protected by the SIMAMIA session.</p>
            <span className={styles.status}>Online</span>
          </article>
        </section>
      </div>
    </main>
  );
}
