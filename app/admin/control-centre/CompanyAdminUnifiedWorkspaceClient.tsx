"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  Landmark,
  LayoutGrid,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from "lucide-react";

import CompanyAdminAccountantBridgeClient from "@/app/admin/accountant-bridge/CompanyAdminAccountantBridgeClient";
import ImportedFinanceClient from "@/app/admin/imported-finance/ImportedFinanceClient";
import StaffAreaAssignmentsPanel from "@/components/company-admin/StaffAreaAssignmentsPanel";
import StaffOperationsAdminClient from "@/components/staff-operations/StaffOperationsAdminClient";

import styles from "./CompanyAdminUnifiedWorkspace.module.css";

export type UnifiedWorkspaceModule =
  | "staff-areas"
  | "accountant-bridge"
  | "imported-finance"
  | "staff-operations";

type Props = {
  initialModule: UnifiedWorkspaceModule;
  dashboardHref: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleLabel: string;
    companyId: string;
    profileImageUrl: string | null;
  };
};

type ModuleItem = {
  key: UnifiedWorkspaceModule;
  label: string;
  note: string;
  icon: typeof MapPinned;
};

const modules: ModuleItem[] = [
  {
    key: "staff-areas",
    label: "Staff Areas",
    note: "Areas, brokers and customers",
    icon: MapPinned,
  },
  {
    key: "accountant-bridge",
    label: "Accountant Bridge",
    note: "Approvals and verification",
    icon: BookOpenCheck,
  },
  {
    key: "imported-finance",
    label: "Imported Finance",
    note: "Agents and bank matching",
    icon: Landmark,
  },
  {
    key: "staff-operations",
    label: "Staff Operations",
    note: "Operational controls",
    icon: BriefcaseBusiness,
  },
];

const SIDEBAR_STORAGE_KEY = "simamia_company_admin_control_centre_sidebar";

export default function CompanyAdminUnifiedWorkspaceClient({
  initialModule,
  dashboardHref,
  user,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] =
    useState<UnifiedWorkspaceModule>(initialModule);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  useEffect(() => {
    setActiveModule(initialModule);
  }, [initialModule]);

  const activeItem = useMemo(
    () => modules.find((item) => item.key === activeModule) ?? modules[0],
    [activeModule],
  );

  function changeModule(next: UnifiedWorkspaceModule) {
    setActiveModule(next);
    setMobileOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set("module", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSidebar() {
    if (window.innerWidth <= 960) {
      setMobileOpen((current) => !current);
      return;
    }

    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        next ? "collapsed" : "expanded",
      );
      return next;
    });
  }

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CA";

  return (
    <main className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      <button
        type="button"
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropOpen : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
      />

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ""}`}
      >
        <div className={styles.brand}>
          <span><ShieldCheck size={25} /></span>
          <div>
            <strong>Simamia Float</strong>
            <small>Unified Admin Control</small>
          </div>
          <button
            type="button"
            className={styles.mobileClose}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          className={styles.collapseButton}
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <nav className={styles.navigation} aria-label="Unified modules">
          <small>Company Admin Modules</small>
          {modules.map((item) => {
            const Icon = item.icon;
            const selected = item.key === activeModule;

            return (
              <button
                key={item.key}
                type="button"
                className={selected ? styles.activeNav : ""}
                onClick={() => changeModule(item.key)}
                title={`${item.label} — ${item.note}`}
              >
                <span><Icon size={20} /></span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </div>
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <span>{initials}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.mobileMenu}
            onClick={toggleSidebar}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <div className={styles.moduleHeading}>
            <span><LayoutGrid size={19} /></span>
            <div>
              <small>Company Admin Control Centre</small>
              <strong>{activeItem.label}</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <Link href={dashboardHref}>
              <ArrowLeft size={17} /> Dashboard
            </Link>
            <div className={styles.userBadge}>
              {user.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImageUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
              <div>
                <strong>{user.name}</strong>
                <small>{user.roleLabel}</small>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.moduleViewport}>
          {activeModule === "staff-areas" && (
            <StaffAreaAssignmentsPanel dashboardHref={dashboardHref} />
          )}

          {activeModule === "accountant-bridge" && (
            <CompanyAdminAccountantBridgeClient
              admin={{ id: user.id, name: user.name, email: user.email }}
              dashboardHref={dashboardHref}
            />
          )}

          {activeModule === "imported-finance" && (
            <ImportedFinanceClient
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                roleLabel: user.roleLabel,
                companyId: user.companyId,
                profileImageUrl: user.profileImageUrl,
              }}
            />
          )}

          {activeModule === "staff-operations" && (
            <StaffOperationsAdminClient portalTitle="Company Admin Portal" />
          )}
        </section>
      </section>
    </main>
  );
}
