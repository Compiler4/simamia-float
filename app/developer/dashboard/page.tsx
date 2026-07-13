import { redirect } from "next/navigation";
import { getCurrentUser, getRoleLabel } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import styles from "./DeveloperDashboard.module.css";

export default async function DeveloperDashboardPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "SYSTEM_DEVELOPER") redirect("/dashboard");

  const metrics = [
    {
      label: "Active Companies",
      value: "12",
      note: "Multi-tenant companies",
    },
    {
      label: "System Users",
      value: "248",
      note: "Across all companies",
    },
    {
      label: "Open Alerts",
      value: "09",
      note: "System checks required",
    },
    {
      label: "Uptime",
      value: "99.9%",
      note: "Platform availability",
    },
  ];

  const modules = [
    "Company Management",
    "Subscription Control",
    "Role Permissions",
    "Audit Logs",
    "System Settings",
    "Database Health",
    "Backups",
    "Security Center",
  ];

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>SF</div>
          <div>
            <h2>Simamia Float</h2>
            <p>Developer Console</p>
          </div>
        </div>

        <nav className={styles.nav}>
          <a className={styles.activeLink}>Dashboard</a>
          <a>Companies</a>
          <a>Subscriptions</a>
          <a>Users & Roles</a>
          <a>Permissions</a>
          <a>Audit Logs</a>
          <a>System Settings</a>
          <a>Backups</a>
        </nav>

        <div className={styles.sidebarCard}>
          <p>System Status</p>
          <h3>Healthy</h3>
          <span>All core services are running.</span>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{getRoleLabel(user.role)}</p>
            <h1>Welcome back, {user.name}</h1>
            <span>
              Manage multi-company ERP configuration, security, subscriptions,
              roles and system-wide monitoring.
            </span>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.secondaryButton}>View Logs</button>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.hero}>
          <div>
            <p className={styles.heroBadge}>Enterprise Developer Access</p>
            <h2>Multi-company ERP control center</h2>
            <p>
              Monitor companies, activate or suspend tenants, manage global
              settings, check database health, review audit logs and control
              permissions from one secure portal.
            </p>

            <div className={styles.heroActions}>
              <button>Manage Companies</button>
              <button>System Settings</button>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.circleOne}></div>
            <div className={styles.circleTwo}></div>

            <div className={styles.panelContent}>
              <span>Platform Overview</span>
              <h3>Simamia ERP</h3>
              <p>Cash Flow • Float • Accounting • Workforce • GPS</p>
            </div>
          </div>
        </section>

        <section className={styles.metricsGrid}>
          {metrics.map((metric) => (
            <article className={styles.metricCard} key={metric.label}>
              <p>{metric.label}</p>
              <h3>{metric.value}</h3>
              <span>{metric.note}</span>
            </article>
          ))}
        </section>

        <section className={styles.mainGrid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.eyebrow}>Modules</p>
                <h2>Developer tools</h2>
              </div>
              <span className={styles.statusPill}>8 modules</span>
            </div>

            <div className={styles.moduleGrid}>
              {modules.map((module) => (
                <div className={styles.moduleItem} key={module}>
                  <div className={styles.moduleIcon}></div>
                  <span>{module}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.eyebrow}>Recent Activity</p>
                <h2>System audit</h2>
              </div>
            </div>

            <div className={styles.timeline}>
              <div>
                <span></span>
                <p>System Developer logged in successfully.</p>
              </div>
              <div>
                <span></span>
                <p>Database seed completed for Simamia company.</p>
              </div>
              <div>
                <span></span>
                <p>Company Admin account activated.</p>
              </div>
              <div>
                <span></span>
                <p>Financial day module initialized.</p>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}