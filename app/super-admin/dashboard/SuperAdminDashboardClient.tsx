"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./SuperAdminDashboard.module.css";

type DashboardUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  companyId: string | null;
  companyName: string | null;
};

type CompanyItem = {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  usersCount: number;
  branchesCount: number;
  latestPlan: string;
  latestAmount: number;
};

type UserItem = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  companyId?: string | null;
  companyName: string;
  branchName: string;
  createdAt: string;
};

type SubscriptionItem = {
  id: string;
  plan: string;
  amount: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  company: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
};

type AuditItem = {
  id: string;
  action: string;
  module: string;
  details: string | null;
  createdAt: string;
  user?: {
    name: string;
    role: string;
  } | null;
  company?: {
    name: string;
  } | null;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

type MessageItem = {
  id: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  company?: {
    name: string;
  } | null;
};

type DashboardData = {
  stats: {
    totalCompanies: number;
    activeCompanies: number;
    suspendedCompanies: number;
    disabledCompanies: number;
    totalUsers: number;
    totalCompanyAdmins: number;
    activeCompanyAdmins: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalAuditLogs: number;
    totalNotifications: number;
    unreadNotifications: number;
    totalMessages: number;
    unreadMessages: number;
    revenueTotal: number;
  };
  companies: CompanyItem[];
  subscriptions: SubscriptionItem[];
  auditLogs: AuditItem[];
  notifications: NotificationItem[];
  messages: MessageItem[];
  users: UserItem[];
};

type Props = {
  user: DashboardUser;
};

type SidebarPage =
  | "Dashboard"
  | "Create Companies"
  | "Manage Companies"
  | "Manage Company Admins"
  | "Manage Subscriptions"
  | "Access Every Company"
  | "View Global Reports"
  | "Manage Permissions"
  | "Manage System Settings"
  | "Reset Passwords"
  | "View Audit Logs";

type CompanyForm = {
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
};

type SubscriptionForm = {
  companyId: string;
  plan: string;
  amount: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type CompanyAdminForm = {
  companyId: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  status: "ACTIVE" | "SUSPENDED" | "REMOVED";
};

type SettingsState = {
  mfa: boolean;
  backups: boolean;
  auditLogs: boolean;
  passwordExpiry: boolean;
  financialLocking: boolean;
  maintenanceMode: boolean;
};

const PROFILE_IMAGE_KEY = "simamia_super_admin_profile_image";
const SIDEBAR_COLLAPSE_KEY = "simamia_super_admin_sidebar_collapsed";

const emptyCompanyForm: CompanyForm = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
};

const emptySubscriptionForm: SubscriptionForm = {
  companyId: "",
  plan: "Enterprise",
  amount: "2500000",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

const emptyCompanyAdminForm: CompanyAdminForm = {
  companyId: "",
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  status: "ACTIVE",
};

function createPermissionState() {
  return {
    SYSTEM_DEVELOPER: {
      dashboard: true,
      companies: true,
      users: true,
      reports: true,
      settings: true,
      audit: true,
    },
    SUPER_ADMIN: {
      dashboard: true,
      companies: true,
      users: true,
      reports: true,
      settings: true,
      audit: true,
    },
    COMPANY_ADMIN: {
      dashboard: true,
      companies: false,
      users: true,
      reports: true,
      settings: true,
      audit: false,
    },
    ACCOUNTANT: {
      dashboard: true,
      companies: false,
      users: false,
      reports: true,
      settings: false,
      audit: false,
    },
    STAFF: {
      dashboard: true,
      companies: false,
      users: false,
      reports: false,
      settings: false,
      audit: false,
    },
    BROKER: {
      dashboard: true,
      companies: false,
      users: false,
      reports: false,
      settings: false,
      audit: false,
    },
    GPS_MANAGER: {
      dashboard: true,
      companies: false,
      users: false,
      reports: true,
      settings: false,
      audit: false,
    },
  };
}

export default function SuperAdminDashboardClient({ user }: Props) {
  const router = useRouter();

  const [activePage, setActivePage] = useState<SidebarPage>("Dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<
    string | null
  >(null);
  const [editingCompanyAdminId, setEditingCompanyAdminId] = useState<
    string | null
  >(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );

  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);

  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm>(
    emptySubscriptionForm,
  );

  const [companyAdminForm, setCompanyAdminForm] = useState<CompanyAdminForm>(
    emptyCompanyAdminForm,
  );

  const [messageForm, setMessageForm] = useState({
    receiverId: "",
    subject: "",
    message: "",
  });

  const [permissions, setPermissions] = useState(createPermissionState);

  const [settings, setSettings] = useState<SettingsState>({
    mfa: true,
    backups: true,
    auditLogs: true,
    passwordExpiry: false,
    financialLocking: true,
    maintenanceMode: false,
  });

  const sidebarItems = useMemo(
    () => [
      { label: "Dashboard" as const, icon: "🏠" },
      { label: "Create Companies" as const, icon: "➕" },
      { label: "Manage Companies" as const, icon: "🏢" },
      { label: "Manage Company Admins" as const, icon: "👨‍💼" },
      { label: "Manage Subscriptions" as const, icon: "💳" },
      { label: "Access Every Company" as const, icon: "🌐" },
      { label: "View Global Reports" as const, icon: "📊" },
      { label: "Manage Permissions" as const, icon: "🛡️" },
      { label: "Manage System Settings" as const, icon: "⚙️" },
      { label: "Reset Passwords" as const, icon: "🔑" },
      { label: "View Audit Logs" as const, icon: "🧾" },
    ],
    [],
  );

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/super-admin/dashboard", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const text = await response.text();

      let result: any = {};

      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        result = {
          success: false,
          message: "Dashboard API returned invalid JSON.",
          rawResponse: text,
        };
      }

      if (!response.ok || !result.success) {
        setData(null);
        setErrorMessage(
          `${result.message || "Dashboard API failed."}${
            result.error ? ` Error: ${result.error}` : ""
          }`,
        );
        console.error("DASHBOARD_API_ERROR:", {
          status: response.status,
          result,
          rawResponse: text,
        });
        return;
      }

      if (result.warnings?.length) {
        console.warn("DASHBOARD_API_WARNINGS:", result.warnings);
      }

      setData(result);
      if (!selectedCompanyId && result.companies?.length) {
        setSelectedCompanyId(result.companies[0].id);
      }
    } catch (error) {
      setData(null);
      setErrorMessage("Failed to connect to dashboard API.");
      console.error("DASHBOARD_FETCH_ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedImage = localStorage.getItem(PROFILE_IMAGE_KEY);
    const savedCollapse = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);

    if (savedImage) setProfileImage(savedImage);
    if (savedCollapse === "yes") setSidebarCollapsed(true);

    loadDashboard();
  }, []);

  function toggleSidebar() {
    if (window.innerWidth <= 900) {
      setMobileSidebarOpen((value) => !value);
      return;
    }

    setSidebarCollapsed((value) => {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, !value ? "yes" : "no");
      return !value;
    });
  }

  function openPage(page: SidebarPage) {
    setActivePage(page);
    setShowMessages(false);
    setShowNotifications(false);
    setMobileSidebarOpen(false);
  }

  async function handleProfileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }

    setUploading(true);

    try {
      const compressedImage = await compressImage(file, 420, 420, 0.72);
      localStorage.setItem(PROFILE_IMAGE_KEY, compressedImage);
      setProfileImage(compressedImage);
    } catch {
      alert("Failed to compress image.");
    } finally {
      setUploading(false);
    }
  }

  function startEditCompany(company: CompanyItem) {
    setEditingCompanyId(company.id);
    setCompanyForm({
      name: company.name,
      code: company.code,
      email: company.email ?? "",
      phone: company.phone ?? "",
      address: company.address ?? "",
    });
    openPage("Create Companies");
  }

  function clearCompanyForm() {
    setEditingCompanyId(null);
    setCompanyForm(emptyCompanyForm);
  }

  async function saveCompany() {
    setActionLoading(true);

    try {
      const url = editingCompanyId
        ? `/api/super-admin/companies/${editingCompanyId}`
        : "/api/super-admin/companies";

      const method = editingCompanyId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(companyForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to save company.");
        return;
      }

      clearCompanyForm();
      await loadDashboard();
      openPage("Manage Companies");
    } finally {
      setActionLoading(false);
    }
  }

  async function updateCompanyStatus(
    companyId: string,
    status: "ACTIVE" | "SUSPENDED" | "DISABLED",
  ) {
    setActionLoading(true);

    try {
      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to update company.");
        return;
      }

      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  async function removeCompany(companyId: string) {
    if (
      !confirm(
        "Remove this company? This action can delete related company data.",
      )
    ) {
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to remove company.");
        return;
      }

      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  function startEditCompanyAdmin(admin: UserItem) {
    const status = String(admin.status || "ACTIVE").toUpperCase();

    setEditingCompanyAdminId(admin.id);
    setCompanyAdminForm({
      companyId: admin.companyId || "",
      name: admin.name || "",
      username: admin.username || "",
      email: admin.email || "",
      phone: admin.phone || "",
      password: "",
      status:
        status === "SUSPENDED" || status === "REMOVED" ? status : "ACTIVE",
    });
    openPage("Manage Company Admins");
  }

  function clearCompanyAdminForm() {
    setEditingCompanyAdminId(null);
    setCompanyAdminForm(emptyCompanyAdminForm);
  }

  async function saveCompanyAdmin() {
    if (
      !companyAdminForm.companyId ||
      !companyAdminForm.name.trim() ||
      !companyAdminForm.username.trim() ||
      !companyAdminForm.email.trim()
    ) {
      alert("Company, full name, username and email are required.");
      return;
    }

    if (!editingCompanyAdminId && companyAdminForm.password.length < 8) {
      alert("Password must contain at least 8 characters.");
      return;
    }

    setActionLoading(true);

    try {
      const url = editingCompanyAdminId
        ? `/api/super-admin/company-admins/${editingCompanyAdminId}`
        : "/api/super-admin/company-admins";

      const response = await fetch(url, {
        method: editingCompanyAdminId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(companyAdminForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to save company administrator.");
        return;
      }

      alert(
        editingCompanyAdminId
          ? "Company administrator updated successfully."
          : "Company administrator created successfully.",
      );

      clearCompanyAdminForm();
      await loadDashboard();
      openPage("Manage Company Admins");
    } catch (error) {
      console.error("SAVE_COMPANY_ADMIN_ERROR:", error);
      alert("Could not connect to the company administrator API.");
    } finally {
      setActionLoading(false);
    }
  }

  async function updateCompanyAdminStatus(
    adminId: string,
    status: "ACTIVE" | "SUSPENDED" | "REMOVED",
  ) {
    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/super-admin/company-admins/${adminId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ status }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to update administrator status.");
        return;
      }

      await loadDashboard();
    } catch (error) {
      console.error("UPDATE_COMPANY_ADMIN_STATUS_ERROR:", error);
      alert("Could not connect to the company administrator API.");
    } finally {
      setActionLoading(false);
    }
  }

  async function removeCompanyAdmin(adminId: string) {
    if (
      !confirm(
        "Remove this company administrator? The account will be marked as REMOVED and can be restored later.",
      )
    ) {
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/super-admin/company-admins/${adminId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to remove company administrator.");
        return;
      }

      if (editingCompanyAdminId === adminId) {
        clearCompanyAdminForm();
      }

      await loadDashboard();
    } catch (error) {
      console.error("REMOVE_COMPANY_ADMIN_ERROR:", error);
      alert("Could not connect to the company administrator API.");
    } finally {
      setActionLoading(false);
    }
  }

  function startEditSubscription(subscription: SubscriptionItem) {
    setEditingSubscriptionId(subscription.id);
    setSubscriptionForm({
      companyId: subscription.company.id,
      plan: subscription.plan,
      amount: String(subscription.amount),
      startsAt: toInputDate(subscription.startsAt),
      endsAt: toInputDate(subscription.endsAt),
      isActive: subscription.isActive,
    });
    openPage("Manage Subscriptions");
  }

  function clearSubscriptionForm() {
    setEditingSubscriptionId(null);
    setSubscriptionForm(emptySubscriptionForm);
  }

  async function saveSubscription() {
    setActionLoading(true);

    try {
      const url = editingSubscriptionId
        ? `/api/super-admin/subscriptions/${editingSubscriptionId}`
        : "/api/super-admin/subscriptions";

      const method = editingSubscriptionId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(subscriptionForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to save subscription.");
        return;
      }

      clearSubscriptionForm();
      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  async function extendSubscription(subscription: SubscriptionItem) {
    const end = new Date(subscription.endsAt);
    end.setFullYear(end.getFullYear() + 1);

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/super-admin/subscriptions/${subscription.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            endsAt: end.toISOString(),
            isActive: true,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to extend subscription.");
        return;
      }

      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  async function removeSubscription(subscriptionId: string) {
    if (!confirm("Remove this subscription?")) return;

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/super-admin/subscriptions/${subscriptionId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to remove subscription.");
        return;
      }

      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  async function resetPassword(userId: string) {
    if (!confirm("Reset this user's password?")) return;

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/super-admin/users/${userId}/reset-password`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to reset password.");
        return;
      }

      alert(`Temporary password: ${result.temporaryPassword}`);
      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  async function sendMessage() {
    setActionLoading(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(messageForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to send message.");
        return;
      }

      setMessageForm({
        receiverId: "",
        subject: "",
        message: "",
      });

      alert("Message sent successfully.");
      await loadDashboard();
    } finally {
      setActionLoading(false);
    }
  }

  async function markNotificationRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });

    await loadDashboard();
  }

  async function markMessageRead(id: string) {
    await fetch(`/api/messages/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });

    await loadDashboard();
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  const stats = data?.stats;

  return (
    <main
      className={`${styles.page} ${
        sidebarCollapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <button
        type="button"
        className={`${styles.mobileBackdrop} ${
          mobileSidebarOpen ? styles.mobileBackdropShow : ""
        }`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-label="Close sidebar"
      />

      <aside
        className={`${styles.sidebar} ${
          mobileSidebarOpen ? styles.sidebarMobileOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <div className={styles.brandLogo}>SF</div>

          <div className={styles.brandText}>
            <h2>Simamia Float</h2>
            <p>Super Admin Console</p>
          </div>
        </div>

        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={toggleSidebar}
        >
          <span>{sidebarCollapsed ? "☰" : "⇤"}</span>
          <strong>{sidebarCollapsed ? "" : "Collapse Menu"}</strong>
        </button>

        <nav className={styles.nav}>
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => openPage(item.label)}
              className={activePage === item.label ? styles.activeNav : ""}
              title={item.label}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navText}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={toggleSidebar}
          >
            ☰
          </button>

          <div className={styles.topNav}>
            <button
              className={activePage === "Dashboard" ? styles.activeTopNav : ""}
              onClick={() => openPage("Dashboard")}
            >
              🏠 Dashboard
            </button>
            <button onClick={() => openPage("Manage Companies")}>
              🏢 Companies
            </button>
            <button onClick={() => openPage("Manage Company Admins")}>
              👨‍💼 Company Admins
            </button>
            <button onClick={() => openPage("Manage Subscriptions")}>
              💳 Subscriptions
            </button>
            <button onClick={() => openPage("Manage Permissions")}>
              🛡️ Permissions
            </button>
            <button onClick={() => openPage("View Audit Logs")}>
              🧾 Audit Logs
            </button>
          </div>

          <div className={styles.topbarActions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                setShowNotifications((value) => !value);
                setShowMessages(false);
              }}
            >
              🔔
              {Number(stats?.unreadNotifications || 0) > 0 && (
                <span className={styles.notificationDot}>
                  {stats?.unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                setShowMessages((value) => !value);
                setShowNotifications(false);
              }}
            >
              💬
              {Number(stats?.unreadMessages || 0) > 0 && (
                <span className={styles.messageDot}>
                  {stats?.unreadMessages}
                </span>
              )}
            </button>

            <div className={styles.profileBox}>
              <label className={styles.profileUploader}>
                {profileImage ? (
                  <img src={profileImage} alt="Profile" />
                ) : (
                  <span>👤</span>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileUpload}
                />
              </label>

              <div>
                <h4>{user.name}</h4>
                <p>{uploading ? "Compressing..." : "Super Admin"}</p>
              </div>
            </div>

            <button onClick={logout} className={styles.logoutButton}>
              Logout
            </button>
          </div>

          {showNotifications && (
            <PopupPanel
              title="Notifications"
              count={stats?.unreadNotifications || 0}
            >
              {data?.notifications?.length ? (
                data.notifications.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => markNotificationRead(item.id)}
                    className={
                      item.isRead ? styles.readItem : styles.unreadItem
                    }
                  >
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small>{formatDate(item.createdAt)}</small>
                  </button>
                ))
              ) : (
                <p className={styles.emptyText}>No notifications found.</p>
              )}
            </PopupPanel>
          )}

          {showMessages && (
            <PopupPanel title="Messages" count={stats?.unreadMessages || 0}>
              {data?.messages?.length ? (
                data.messages.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => markMessageRead(item.id)}
                    className={
                      item.isRead ? styles.readItem : styles.unreadItem
                    }
                  >
                    <strong>{item.subject}</strong>
                    <p>{item.body}</p>
                    <small>
                      From {item.sender?.name} • {formatDate(item.createdAt)}
                    </small>
                  </button>
                ))
              ) : (
                <p className={styles.emptyText}>No messages found.</p>
              )}
            </PopupPanel>
          )}
        </header>

        {loading ? (
          <section className={styles.loadingCard}>
            <div className={styles.loader}></div>
            <h2>Loading dashboard data...</h2>
          </section>
        ) : errorMessage ? (
          <section className={styles.errorCard}>
            <h2>Dashboard API Error</h2>
            <p>{errorMessage}</p>
            <button onClick={loadDashboard}>Try Again</button>
          </section>
        ) : (
          <DashboardContent
            activePage={activePage}
            data={data}
            actionLoading={actionLoading}
            companyForm={companyForm}
            setCompanyForm={setCompanyForm}
            editingCompanyId={editingCompanyId}
            clearCompanyForm={clearCompanyForm}
            saveCompany={saveCompany}
            startEditCompany={startEditCompany}
            updateCompanyStatus={updateCompanyStatus}
            removeCompany={removeCompany}
            companyAdminForm={companyAdminForm}
            setCompanyAdminForm={setCompanyAdminForm}
            editingCompanyAdminId={editingCompanyAdminId}
            clearCompanyAdminForm={clearCompanyAdminForm}
            saveCompanyAdmin={saveCompanyAdmin}
            startEditCompanyAdmin={startEditCompanyAdmin}
            updateCompanyAdminStatus={updateCompanyAdminStatus}
            removeCompanyAdmin={removeCompanyAdmin}
            subscriptionForm={subscriptionForm}
            setSubscriptionForm={setSubscriptionForm}
            editingSubscriptionId={editingSubscriptionId}
            clearSubscriptionForm={clearSubscriptionForm}
            saveSubscription={saveSubscription}
            startEditSubscription={startEditSubscription}
            extendSubscription={extendSubscription}
            removeSubscription={removeSubscription}
            selectedCompanyId={selectedCompanyId}
            setSelectedCompanyId={setSelectedCompanyId}
            permissions={permissions}
            setPermissions={setPermissions}
            settings={settings}
            setSettings={setSettings}
            resetPassword={resetPassword}
            messageForm={messageForm}
            setMessageForm={setMessageForm}
            sendMessage={sendMessage}
            setActivePage={openPage}
          />
        )}
      </section>
    </main>
  );
}

function DashboardContent({
  activePage,
  data,
  actionLoading,
  companyForm,
  setCompanyForm,
  editingCompanyId,
  clearCompanyForm,
  saveCompany,
  startEditCompany,
  updateCompanyStatus,
  removeCompany,
  companyAdminForm,
  setCompanyAdminForm,
  editingCompanyAdminId,
  clearCompanyAdminForm,
  saveCompanyAdmin,
  startEditCompanyAdmin,
  updateCompanyAdminStatus,
  removeCompanyAdmin,
  subscriptionForm,
  setSubscriptionForm,
  editingSubscriptionId,
  clearSubscriptionForm,
  saveSubscription,
  startEditSubscription,
  extendSubscription,
  removeSubscription,
  selectedCompanyId,
  setSelectedCompanyId,
  permissions,
  setPermissions,
  settings,
  setSettings,
  resetPassword,
  messageForm,
  setMessageForm,
  sendMessage,
  setActivePage,
}: {
  activePage: SidebarPage;
  data: DashboardData | null;
  actionLoading: boolean;
  companyForm: CompanyForm;
  setCompanyForm: (value: CompanyForm) => void;
  editingCompanyId: string | null;
  clearCompanyForm: () => void;
  saveCompany: () => void;
  startEditCompany: (company: CompanyItem) => void;
  updateCompanyStatus: (
    companyId: string,
    status: "ACTIVE" | "SUSPENDED" | "DISABLED",
  ) => void;
  removeCompany: (companyId: string) => void;
  companyAdminForm: CompanyAdminForm;
  setCompanyAdminForm: Dispatch<SetStateAction<CompanyAdminForm>>;
  editingCompanyAdminId: string | null;
  clearCompanyAdminForm: () => void;
  saveCompanyAdmin: () => void;
  startEditCompanyAdmin: (admin: UserItem) => void;
  updateCompanyAdminStatus: (
    adminId: string,
    status: "ACTIVE" | "SUSPENDED" | "REMOVED",
  ) => void;
  removeCompanyAdmin: (adminId: string) => void;
  subscriptionForm: SubscriptionForm;
  setSubscriptionForm: (value: SubscriptionForm) => void;
  editingSubscriptionId: string | null;
  clearSubscriptionForm: () => void;
  saveSubscription: () => void;
  startEditSubscription: (subscription: SubscriptionItem) => void;
  extendSubscription: (subscription: SubscriptionItem) => void;
  removeSubscription: (subscriptionId: string) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string) => void;
  permissions: ReturnType<typeof createPermissionState>;
  setPermissions: (value: ReturnType<typeof createPermissionState>) => void;
  settings: SettingsState;
  setSettings: Dispatch<SetStateAction<SettingsState>>;
  resetPassword: (userId: string) => void;
  messageForm: {
    receiverId: string;
    subject: string;
    message: string;
  };
  setMessageForm: (value: {
    receiverId: string;
    subject: string;
    message: string;
  }) => void;
  sendMessage: () => void;
  setActivePage: (page: SidebarPage) => void;
}) {
  if (!data) {
    return (
      <section className={styles.errorCard}>
        <h2>No dashboard data found.</h2>
        <p>Login again as Super Admin and check the dashboard API.</p>
      </section>
    );
  }

  if (activePage === "Create Companies") {
    return (
      <CreateCompaniesPage
        data={data}
        companyForm={companyForm}
        setCompanyForm={setCompanyForm}
        editingCompanyId={editingCompanyId}
        clearCompanyForm={clearCompanyForm}
        saveCompany={saveCompany}
        startEditCompany={startEditCompany}
        actionLoading={actionLoading}
      />
    );
  }

  if (activePage === "Manage Companies") {
    return (
      <ManageCompaniesPage
        data={data}
        startEditCompany={startEditCompany}
        updateCompanyStatus={updateCompanyStatus}
        removeCompany={removeCompany}
        actionLoading={actionLoading}
      />
    );
  }

  if (activePage === "Manage Company Admins") {
    return (
      <ManageCompanyAdminsPage
        data={data}
        form={companyAdminForm}
        setForm={setCompanyAdminForm}
        editingAdminId={editingCompanyAdminId}
        clearForm={clearCompanyAdminForm}
        saveAdmin={saveCompanyAdmin}
        startEdit={startEditCompanyAdmin}
        updateStatus={updateCompanyAdminStatus}
        removeAdmin={removeCompanyAdmin}
        actionLoading={actionLoading}
      />
    );
  }

  if (activePage === "Manage Subscriptions") {
    return (
      <ManageSubscriptionsPage
        data={data}
        subscriptionForm={subscriptionForm}
        setSubscriptionForm={setSubscriptionForm}
        editingSubscriptionId={editingSubscriptionId}
        clearSubscriptionForm={clearSubscriptionForm}
        saveSubscription={saveSubscription}
        startEditSubscription={startEditSubscription}
        extendSubscription={extendSubscription}
        removeSubscription={removeSubscription}
        actionLoading={actionLoading}
      />
    );
  }

  if (activePage === "Access Every Company") {
    return (
      <AccessEveryCompanyPage
        data={data}
        selectedCompanyId={selectedCompanyId}
        setSelectedCompanyId={setSelectedCompanyId}
      />
    );
  }

  if (activePage === "View Global Reports") {
    return <GlobalReportsPage data={data} />;
  }

  if (activePage === "Manage Permissions") {
    return (
      <ManagePermissionsPage
        permissions={permissions}
        setPermissions={setPermissions}
      />
    );
  }

  if (activePage === "Manage System Settings") {
    return <SystemSettingsPage settings={settings} setSettings={setSettings} />;
  }

  if (activePage === "Reset Passwords") {
    return (
      <ResetPasswordsPage users={data.users} resetPassword={resetPassword} />
    );
  }

  if (activePage === "View Audit Logs") {
    return <AuditLogsPage logs={data.auditLogs} />;
  }

  return (
    <DashboardHome
      data={data}
      messageForm={messageForm}
      setMessageForm={setMessageForm}
      sendMessage={sendMessage}
      setActivePage={setActivePage}
    />
  );
}

function DashboardHome({
  data,
  messageForm,
  setMessageForm,
  sendMessage,
  setActivePage,
}: {
  data: DashboardData;
  messageForm: {
    receiverId: string;
    subject: string;
    message: string;
  };
  setMessageForm: (value: {
    receiverId: string;
    subject: string;
    message: string;
  }) => void;
  sendMessage: () => void;
  setActivePage: (page: SidebarPage) => void;
}) {
  const activeRate =
    data.stats.totalCompanies > 0
      ? Math.round(
          (data.stats.activeCompanies / data.stats.totalCompanies) * 100,
        )
      : 0;

  return (
    <>
      <section className={styles.dashboardHero}>
        <div>
          <p className={styles.kicker}>Enterprise Multi-Company ERP</p>
          <h1>Welcome back, Super Admin</h1>
          <span>
            Manage companies, subscriptions, users, reports, permissions,
            messages and audit logs from one attractive control center.
          </span>
        </div>

        <div className={styles.heroQuickActions}>
          <button onClick={() => setActivePage("Create Companies")}>
            ➕ Add Company
          </button>

          <button onClick={() => setActivePage("Manage Company Admins")}>
            👨‍💼 Add Company Admin
          </button>

          <button onClick={() => setActivePage("View Global Reports")}>
            📊 View Reports
          </button>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <MetricCard
          icon="🏢"
          label="Total Companies"
          value={String(data.stats.totalCompanies)}
          change="+6.2%"
        />
        <MetricCard
          icon="✅"
          label="Active Companies"
          value={String(data.stats.activeCompanies)}
          change="+4.1%"
        />
        <MetricCard
          icon="👨‍💼"
          label="Company Admins"
          value={String(data.stats.totalCompanyAdmins)}
          change={`${data.stats.activeCompanyAdmins} active`}
        />
        <MetricCard
          icon="💳"
          label="Active Subscriptions"
          value={String(data.stats.activeSubscriptions)}
          change="+9.8%"
        />
        <MetricCard
          icon="📈"
          label="Active Rate"
          value={`${activeRate}%`}
          change="+1.4%"
        />
        <MetricCard
          icon="⛔"
          label="Suspended/Disabled"
          value={String(
            data.stats.suspendedCompanies + data.stats.disabledCompanies,
          )}
          change="-8.6%"
        />
      </section>

      <section className={styles.overviewGrid}>
        <article className={styles.bigCard}>
          <CardHeader
            title="System Growth Overview"
            subtitle="Weekly company and user activity"
            action="Weekly"
          />

          <div className={styles.salesBars}>
            {[
              { day: "Sat", height: "50%" },
              { day: "Sun", height: "66%" },
              { day: "Mon", height: "54%" },
              { day: "Tue", height: "88%", active: true },
              { day: "Wed", height: "40%" },
              { day: "Thu", height: "58%" },
              { day: "Fri", height: "44%" },
            ].map((bar) => (
              <div className={styles.salesBarItem} key={bar.day}>
                <span>{bar.day}</span>
                <div
                  className={
                    bar.active ? styles.activeSalesBar : styles.salesBar
                  }
                  style={{ height: bar.height }}
                >
                  {bar.active && (
                    <strong>
                      {data.stats.totalUsers}
                      <small>Total Users</small>
                    </strong>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.bigCard}>
          <CardHeader
            title="Company Pipeline"
            subtitle="Live database status"
            action="Monthly"
          />

          <div className={styles.pipelineBody}>
            <div className={styles.pipelineList}>
              <PipelineItem
                color="purple"
                label="Total Companies"
                value={String(data.stats.totalCompanies)}
              />
              <PipelineItem
                color="blue"
                label="Subscriptions"
                value={String(data.stats.totalSubscriptions)}
              />
              <PipelineItem
                color="gray"
                label="Suspended"
                value={String(data.stats.suspendedCompanies)}
              />
              <PipelineItem
                color="green"
                label="Active"
                value={String(data.stats.activeCompanies)}
              />
            </div>

            <div className={styles.donut}>
              <span>{data.stats.activeCompanies}</span>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.bigCard}>
          <CardHeader
            title="Top Registered Companies"
            subtitle="Recently added companies"
            action="↗"
          />

          <div className={styles.companyList}>
            {data.companies.slice(0, 4).map((company) => (
              <CompanyMiniRow key={company.id} company={company} />
            ))}
          </div>
        </article>

        <article className={styles.bigCard}>
          <CardHeader title="Send Message" subtitle="Communicate with users" />

          <MessageForm
            users={data.users}
            form={messageForm}
            setForm={setMessageForm}
            sendMessage={sendMessage}
          />
        </article>

        <article className={styles.bigCard}>
          <CardHeader title="System Summary" subtitle="Real database counts" />

          <SummaryRow
            icon="🔔"
            label="Notifications"
            value={String(data.stats.totalNotifications)}
          />
          <SummaryRow
            icon="💬"
            label="Messages"
            value={String(data.stats.totalMessages)}
          />
          <SummaryRow
            icon="💳"
            label="Subscriptions"
            value={String(data.stats.activeSubscriptions)}
          />
          <SummaryRow
            icon="🧾"
            label="Audit Logs"
            value={String(data.stats.totalAuditLogs)}
          />

          <div className={styles.totalBox}>
            <span>Total Revenue</span>
            <strong>{formatMoney(data.stats.revenueTotal)}</strong>
          </div>
        </article>
      </section>
    </>
  );
}

function CreateCompaniesPage({
  data,
  companyForm,
  setCompanyForm,
  editingCompanyId,
  clearCompanyForm,
  saveCompany,
  startEditCompany,
  actionLoading,
}: {
  data: DashboardData;
  companyForm: CompanyForm;
  setCompanyForm: (value: CompanyForm) => void;
  editingCompanyId: string | null;
  clearCompanyForm: () => void;
  saveCompany: () => void;
  startEditCompany: (company: CompanyItem) => void;
  actionLoading: boolean;
}) {
  return (
    <PageShell
      icon="➕"
      title={editingCompanyId ? "Edit Company" : "Create Companies"}
      subtitle="Add new companies that will use Simamia Float ERP and review registered companies instantly."
    >
      <div className={styles.twoColumnGrid}>
        <article className={styles.formPanel}>
          <div className={styles.panelGlow}></div>

          <h2>
            {editingCompanyId
              ? "Update company details"
              : "Register new company"}
          </h2>
          <p>
            Fill company information carefully. Company code must be unique and
            will be used for identification.
          </p>

          <div className={styles.formStack}>
            <label>
              Company Name
              <input
                value={companyForm.name}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, name: e.target.value })
                }
                placeholder="Example: Simamia Float Company"
              />
            </label>

            <label>
              Company Code
              <input
                value={companyForm.code}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, code: e.target.value })
                }
                placeholder="Example: SIMAMIA"
              />
            </label>

            <label>
              Email Address
              <input
                value={companyForm.email}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, email: e.target.value })
                }
                placeholder="company@example.com"
              />
            </label>

            <label>
              Phone Number
              <input
                value={companyForm.phone}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, phone: e.target.value })
                }
                placeholder="+255..."
              />
            </label>

            <label>
              Address
              <textarea
                value={companyForm.address}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, address: e.target.value })
                }
                placeholder="Dar es Salaam, Tanzania"
              />
            </label>

            <div className={styles.formActions}>
              <button onClick={saveCompany} disabled={actionLoading}>
                {actionLoading
                  ? "Saving..."
                  : editingCompanyId
                    ? "Update Company"
                    : "Create Company"}
              </button>

              {editingCompanyId && (
                <button
                  className={styles.lightButton}
                  onClick={clearCompanyForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <CardHeader
            title="Companies Added"
            subtitle="All companies registered in the system"
          />

          <ResponsiveTable>
            <thead>
              <tr>
                <th>Company</th>
                <th>Code</th>
                <th>Status</th>
                <th>Users</th>
                <th>Subscription</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {data.companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <Entity
                      name={company.name}
                      sub={company.email || company.address || "No email"}
                    />
                  </td>
                  <td>{company.code}</td>
                  <td>
                    <StatusBadge status={company.status} />
                  </td>
                  <td>{company.usersCount}</td>
                  <td>{company.latestPlan}</td>
                  <td>
                    <button
                      className={styles.smallPrimary}
                      onClick={() => startEditCompany(company)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </article>
      </div>
    </PageShell>
  );
}

function ManageCompaniesPage({
  data,
  startEditCompany,
  updateCompanyStatus,
  removeCompany,
  actionLoading,
}: {
  data: DashboardData;
  startEditCompany: (company: CompanyItem) => void;
  updateCompanyStatus: (
    companyId: string,
    status: "ACTIVE" | "SUSPENDED" | "DISABLED",
  ) => void;
  removeCompany: (companyId: string) => void;
  actionLoading: boolean;
}) {
  return (
    <PageShell
      icon="🏢"
      title="Manage Companies"
      subtitle="Company actions now change automatically according to the current company status."
    >
      <div className={styles.actionStats}>
        <MiniStat
          label="Active"
          value={String(data.stats.activeCompanies)}
          icon="✅"
        />
        <MiniStat
          label="Suspended"
          value={String(data.stats.suspendedCompanies)}
          icon="⛔"
        />
        <MiniStat
          label="Deactivated"
          value={String(data.stats.disabledCompanies)}
          icon="🚫"
        />
        <MiniStat
          label="Total"
          value={String(data.stats.totalCompanies)}
          icon="🏢"
        />
      </div>

      <article className={styles.tablePanel}>
        <CardHeader
          title="Registered Companies"
          subtitle="Suspend, deactivate, reactivate, edit or remove a company"
        />

        <ResponsiveTable>
          <thead>
            <tr>
              <th>Company</th>
              <th>Code</th>
              <th>Status</th>
              <th>Users</th>
              <th>Branches</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {data.companies.map((company) => {
              const status = String(company.status || "").toUpperCase();
              const isActive = status === "ACTIVE";
              const isSuspended = status === "SUSPENDED";
              const isDeactivated = status === "DISABLED";

              return (
                <tr key={company.id}>
                  <td>
                    <Entity
                      name={company.name}
                      sub={company.email || company.address || "No email"}
                    />
                  </td>
                  <td>{company.code}</td>
                  <td>
                    <StatusBadge status={company.status} />
                  </td>
                  <td>{company.usersCount}</td>
                  <td>{company.branchesCount}</td>
                  <td>{company.latestPlan}</td>
                  <td>{formatMoney(company.latestAmount)}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      {isActive && (
                        <>
                          <button
                            className={styles.warningButton}
                            onClick={() =>
                              updateCompanyStatus(company.id, "SUSPENDED")
                            }
                            disabled={actionLoading}
                          >
                            ⏸ Suspend
                          </button>

                          <button
                            className={styles.deactivateButton}
                            onClick={() =>
                              updateCompanyStatus(company.id, "DISABLED")
                            }
                            disabled={actionLoading}
                          >
                            ⛔ Deactivate
                          </button>
                        </>
                      )}

                      {(isSuspended || isDeactivated) && (
                        <button
                          className={styles.reactivateButton}
                          onClick={() =>
                            updateCompanyStatus(company.id, "ACTIVE")
                          }
                          disabled={actionLoading}
                        >
                          ↻ Reactivate
                        </button>
                      )}

                      {!isActive && !isSuspended && !isDeactivated && (
                        <button
                          className={styles.reactivateButton}
                          onClick={() =>
                            updateCompanyStatus(company.id, "ACTIVE")
                          }
                          disabled={actionLoading}
                        >
                          ↻ Reactivate
                        </button>
                      )}

                      <button
                        className={styles.editButton}
                        onClick={() => startEditCompany(company)}
                        disabled={actionLoading}
                      >
                        ✏ Edit
                      </button>

                      <button
                        className={styles.dangerButton}
                        onClick={() => removeCompany(company.id)}
                        disabled={actionLoading}
                      >
                        🗑 Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </article>
    </PageShell>
  );
}

function ManageCompanyAdminsPage({
  data,
  form,
  setForm,
  editingAdminId,
  clearForm,
  saveAdmin,
  startEdit,
  updateStatus,
  removeAdmin,
  actionLoading,
}: {
  data: DashboardData;
  form: CompanyAdminForm;
  setForm: Dispatch<SetStateAction<CompanyAdminForm>>;
  editingAdminId: string | null;
  clearForm: () => void;
  saveAdmin: () => void;
  startEdit: (admin: UserItem) => void;
  updateStatus: (
    adminId: string,
    status: "ACTIVE" | "SUSPENDED" | "REMOVED",
  ) => void;
  removeAdmin: (adminId: string) => void;
  actionLoading: boolean;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingAdminId && !form.companyId && data.companies[0]) {
      setForm((current) => ({
        ...current,
        companyId: data.companies[0].id,
      }));
    }
  }, [data.companies, editingAdminId, form.companyId, setForm]);

  const companyAdmins = useMemo(
    () =>
      data.users.filter(
        (item) => String(item.role || "").toUpperCase() === "COMPANY_ADMIN",
      ),
    [data.users],
  );

  const filteredAdmins = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return companyAdmins;

    return companyAdmins.filter((admin) =>
      [
        admin.name,
        admin.username,
        admin.email,
        admin.phone || "",
        admin.companyName,
        admin.status,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword),
      ),
    );
  }, [companyAdmins, search]);

  const activeAdmins = companyAdmins.filter(
    (admin) => String(admin.status).toUpperCase() === "ACTIVE",
  ).length;

  const suspendedAdmins = companyAdmins.filter(
    (admin) => String(admin.status).toUpperCase() === "SUSPENDED",
  ).length;

  const removedAdmins = companyAdmins.filter(
    (admin) => String(admin.status).toUpperCase() === "REMOVED",
  ).length;

  const companiesWithAdmins = new Set(
    companyAdmins
      .filter((admin) => String(admin.status).toUpperCase() !== "REMOVED")
      .map((admin) => admin.companyId)
      .filter(Boolean),
  ).size;

  const selectedCompany = data.companies.find(
    (company) => company.id === form.companyId,
  );

  return (
    <PageShell
      icon="👨‍💼"
      title="Manage Company Administrators"
      subtitle="Create and assign a company administrator to any registered company, then edit, suspend, restore or remove the account."
    >
      <div className={styles.adminOverviewGrid}>
        <article className={styles.adminOverviewCard}>
          <span>👨‍💼</span>
          <div>
            <p>Total Company Admins</p>
            <strong>{companyAdmins.length}</strong>
          </div>
        </article>

        <article className={styles.adminOverviewCard}>
          <span>✅</span>
          <div>
            <p>Active Admins</p>
            <strong>{activeAdmins}</strong>
          </div>
        </article>

        <article className={styles.adminOverviewCard}>
          <span>⏸</span>
          <div>
            <p>Suspended Admins</p>
            <strong>{suspendedAdmins}</strong>
          </div>
        </article>

        <article className={styles.adminOverviewCard}>
          <span>🏢</span>
          <div>
            <p>Companies Assigned</p>
            <strong>
              {companiesWithAdmins}/{data.companies.length}
            </strong>
          </div>
        </article>

        <article className={styles.adminOverviewCard}>
          <span>🗑</span>
          <div>
            <p>Removed Accounts</p>
            <strong>{removedAdmins}</strong>
          </div>
        </article>
      </div>

      <div className={styles.twoColumnGrid}>
        <article className={styles.formPanel}>
          <div className={styles.panelGlow}></div>

          <div className={styles.adminFormHeader}>
            <div className={styles.adminFormIcon}>
              {editingAdminId ? "✏️" : "➕"}
            </div>
            <div>
              <h2>
                {editingAdminId
                  ? "Edit Company Administrator"
                  : "Add Company Administrator"}
              </h2>
              <p>
                {editingAdminId
                  ? "Update the administrator and move the account to another company when required."
                  : "Create a secure administrator account and connect it to a registered company."}
              </p>
            </div>
          </div>

          {selectedCompany && (
            <div className={styles.adminCompanyPreview}>
              <div>
                <span>
                  {selectedCompany.name
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word.charAt(0))
                    .join("")
                    .toUpperCase()}
                </span>
              </div>
              <section>
                <small>Selected company</small>
                <strong>{selectedCompany.name}</strong>
                <p>
                  {selectedCompany.code} • {selectedCompany.status}
                </p>
              </section>
            </div>
          )}

          <div className={styles.formStack}>
            <label>
              Registered Company
              <select
                value={form.companyId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    companyId: event.target.value,
                  }))
                }
              >
                <option value="">Select registered company</option>
                {data.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} - {company.code} ({company.status})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Full Name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Example: Asha Mtei"
                autoComplete="name"
              />
            </label>

            <label>
              Username
              <input
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: event.target.value
                      .toLowerCase()
                      .replace(/\s+/g, ""),
                  }))
                }
                placeholder="Example: asha.admin"
                autoComplete="username"
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value.toLowerCase(),
                  }))
                }
                placeholder="admin@company.com"
                autoComplete="email"
              />
            </label>

            <label>
              Phone Number
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+255..."
                autoComplete="tel"
              />
            </label>

            <label>
              {editingAdminId
                ? "New Password (leave blank to keep current password)"
                : "Temporary Password"}
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder={
                  editingAdminId
                    ? "Enter only when changing password"
                    : "Minimum 8 characters"
                }
                autoComplete="new-password"
              />
            </label>

            <div className={styles.adminPasswordNote}>
              <span>🔐</span>
              <p>
                The password is securely hashed using bcrypt before it is saved
                in the <strong>passwordHash</strong> database field.
              </p>
            </div>

            <label>
              Account Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as CompanyAdminForm["status"],
                  }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                {editingAdminId && <option value="REMOVED">Removed</option>}
              </select>
            </label>

            <div className={styles.formActions}>
              <button
                type="button"
                onClick={saveAdmin}
                disabled={actionLoading || data.companies.length === 0}
              >
                {actionLoading
                  ? "Saving..."
                  : editingAdminId
                    ? "Update Administrator"
                    : "Create Administrator"}
              </button>

              <button
                type="button"
                className={styles.lightButton}
                onClick={clearForm}
                disabled={actionLoading}
              >
                {editingAdminId ? "Cancel Edit" : "Clear Form"}
              </button>
            </div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.adminTableHeader}>
            <div>
              <h2>Company Administrators</h2>
              <p>
                Every company administrator with the related registered company.
              </p>
            </div>

            <label className={styles.adminSearchBox}>
              <span>🔎</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin or company..."
              />
            </label>
          </div>

          <ResponsiveTable>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Company</th>
                <th>Username</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAdmins.length ? (
                filteredAdmins.map((admin) => {
                  const status = String(admin.status || "").toUpperCase();
                  const isActive = status === "ACTIVE";
                  const isRemoved = status === "REMOVED";

                  return (
                    <tr key={admin.id}>
                      <td>
                        <Entity name={admin.name} sub={admin.email} />
                      </td>
                      <td>
                        <div className={styles.adminCompanyCell}>
                          <strong>{admin.companyName || "No Company"}</strong>
                          <small>
                            {data.companies.find(
                              (company) => company.id === admin.companyId,
                            )?.code || "UNASSIGNED"}
                          </small>
                        </div>
                      </td>
                      <td>{admin.username}</td>
                      <td>{admin.phone || "N/A"}</td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>{formatDate(admin.createdAt)}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.editButton}
                            onClick={() => startEdit(admin)}
                            disabled={actionLoading}
                          >
                            ✏ Edit
                          </button>

                          {isActive ? (
                            <button
                              className={styles.warningButton}
                              onClick={() =>
                                updateStatus(admin.id, "SUSPENDED")
                              }
                              disabled={actionLoading}
                            >
                              ⏸ Suspend
                            </button>
                          ) : (
                            <button
                              className={styles.reactivateButton}
                              onClick={() => updateStatus(admin.id, "ACTIVE")}
                              disabled={actionLoading}
                            >
                              ↻ {isRemoved ? "Restore" : "Activate"}
                            </button>
                          )}

                          {!isRemoved && (
                            <button
                              className={styles.dangerButton}
                              onClick={() => removeAdmin(admin.id)}
                              disabled={actionLoading}
                            >
                              🗑 Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className={styles.tableEmptyCell}>
                    <span>👨‍💼</span>
                    <strong>No company administrators found</strong>
                    <p>
                      Create the first company administrator using the form.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </ResponsiveTable>
        </article>
      </div>
    </PageShell>
  );
}

function ManageSubscriptionsPage({
  data,
  subscriptionForm,
  setSubscriptionForm,
  editingSubscriptionId,
  clearSubscriptionForm,
  saveSubscription,
  startEditSubscription,
  extendSubscription,
  removeSubscription,
  actionLoading,
}: {
  data: DashboardData;
  subscriptionForm: SubscriptionForm;
  setSubscriptionForm: (value: SubscriptionForm) => void;
  editingSubscriptionId: string | null;
  clearSubscriptionForm: () => void;
  saveSubscription: () => void;
  startEditSubscription: (subscription: SubscriptionItem) => void;
  extendSubscription: (subscription: SubscriptionItem) => void;
  removeSubscription: (subscriptionId: string) => void;
  actionLoading: boolean;
}) {
  return (
    <PageShell
      icon="💳"
      title="Manage Subscriptions"
      subtitle="Create, edit, extend and remove company subscriptions from one beautiful page."
    >
      <div className={styles.twoColumnGrid}>
        <article className={styles.formPanel}>
          <div className={styles.panelGlow}></div>

          <h2>
            {editingSubscriptionId
              ? "Edit Subscription"
              : "Add Company Subscription"}
          </h2>
          <p>
            Select a registered company, choose plan, amount and subscription
            duration.
          </p>

          <div className={styles.formStack}>
            <label>
              Company
              <select
                value={subscriptionForm.companyId}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    companyId: e.target.value,
                  })
                }
              >
                <option value="">Select company</option>
                {data.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} - {company.code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Plan
              <select
                value={subscriptionForm.plan}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    plan: e.target.value,
                  })
                }
              >
                <option value="Starter">Starter</option>
                <option value="Business">Business</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Premium">Premium</option>
              </select>
            </label>

            <label>
              Amount
              <input
                type="number"
                value={subscriptionForm.amount}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    amount: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Starts At
              <input
                type="date"
                value={subscriptionForm.startsAt}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    startsAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Ends At
              <input
                type="date"
                value={subscriptionForm.endsAt}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    endsAt: e.target.value,
                  })
                }
              />
            </label>

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={subscriptionForm.isActive}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    isActive: e.target.checked,
                  })
                }
              />
              Active subscription
            </label>

            <div className={styles.formActions}>
              <button onClick={saveSubscription} disabled={actionLoading}>
                {actionLoading
                  ? "Saving..."
                  : editingSubscriptionId
                    ? "Update Subscription"
                    : "Create Subscription"}
              </button>

              {editingSubscriptionId && (
                <button
                  className={styles.lightButton}
                  onClick={clearSubscriptionForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <CardHeader
            title="Company Subscriptions"
            subtitle="All subscription data by company"
          />

          <ResponsiveTable>
            <thead>
              <tr>
                <th>Company</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {data.subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <Entity name={sub.company.name} sub={sub.company.code} />
                  </td>
                  <td>{sub.plan}</td>
                  <td>{formatMoney(sub.amount)}</td>
                  <td>{formatDate(sub.startsAt)}</td>
                  <td>{formatDate(sub.endsAt)}</td>
                  <td>
                    <span
                      className={
                        sub.isActive
                          ? styles.statusActive
                          : styles.statusDisabled
                      }
                    >
                      {sub.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.editButton}
                        onClick={() => startEditSubscription(sub)}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.successButton}
                        onClick={() => extendSubscription(sub)}
                      >
                        Add 1 Year
                      </button>
                      <button
                        className={styles.dangerButton}
                        onClick={() => removeSubscription(sub.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </article>
      </div>
    </PageShell>
  );
}

function AccessEveryCompanyPage({
  data,
  selectedCompanyId,
  setSelectedCompanyId,
}: {
  data: DashboardData;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string) => void;
}) {
  const selected =
    data.companies.find((company) => company.id === selectedCompanyId) ||
    data.companies[0];

  const normalize = (value: string | null | undefined) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const selectedUsers = selected
    ? data.users.filter((companyUser) => {
        if (companyUser.companyId) {
          return companyUser.companyId === selected.id;
        }

        return normalize(companyUser.companyName) === normalize(selected.name);
      })
    : [];

  const selectedSubscriptions = selected
    ? data.subscriptions.filter(
        (subscription) => subscription.company.id === selected.id,
      )
    : [];

  const activeUsers = selectedUsers.filter(
    (companyUser) => normalize(companyUser.status) === "active",
  ).length;

  const adminUsers = selectedUsers.filter((companyUser) =>
    ["COMPANY_ADMIN", "SUPER_ADMIN", "SYSTEM_DEVELOPER"].includes(
      String(companyUser.role || "").toUpperCase(),
    ),
  ).length;

  const uniqueBranches = new Set(
    selectedUsers
      .map((companyUser) => normalize(companyUser.branchName))
      .filter((branchName) => branchName && branchName !== "n/a"),
  ).size;

  return (
    <PageShell
      icon="🌐"
      title="Access Every Company"
      subtitle="Select a company to review its complete profile, users, roles, branches and subscription information."
    >
      <article className={styles.tablePanel}>
        <CardHeader
          title="Choose a Company"
          subtitle="Click Access to open the complete company review below"
        />

        <ResponsiveTable>
          <thead>
            <tr>
              <th>Company</th>
              <th>Code</th>
              <th>Status</th>
              <th>Users</th>
              <th>Branches</th>
              <th>Plan</th>
              <th>Access</th>
            </tr>
          </thead>

          <tbody>
            {data.companies.map((company) => {
              const isSelected = selected?.id === company.id;

              return (
                <tr
                  key={company.id}
                  className={isSelected ? styles.selectedCompanyRow : ""}
                >
                  <td>
                    <Entity
                      name={company.name}
                      sub={company.email || company.address || company.code}
                    />
                  </td>
                  <td>{company.code}</td>
                  <td>
                    <StatusBadge status={company.status} />
                  </td>
                  <td>{company.usersCount}</td>
                  <td>{company.branchesCount}</td>
                  <td>{company.latestPlan}</td>
                  <td>
                    <button
                      className={
                        isSelected
                          ? styles.companyAccessButtonActive
                          : styles.companyAccessButton
                      }
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      {isSelected ? "✓ Viewing" : "↗ Access"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </article>

      {selected ? (
        <section className={styles.companyReviewSection}>
          <article className={styles.companyReviewHero}>
            <div className={styles.companyReviewIdentity}>
              <div className={styles.companyReviewLogo}>
                {selected.name
                  .split(" ")
                  .slice(0, 2)
                  .map((word) => word.charAt(0))
                  .join("")
                  .toUpperCase()}
              </div>

              <div>
                <span className={styles.companyReviewLabel}>
                  Company workspace
                </span>
                <h2>{selected.name}</h2>
                <p>{selected.address || "No address has been added."}</p>
              </div>
            </div>

            <div className={styles.companyReviewStatus}>
              <StatusBadge status={selected.status} />
              <span>Code: {selected.code}</span>
            </div>
          </article>

          <div className={styles.companyReviewStats}>
            <article className={styles.companyReviewStatPurple}>
              <span>👥</span>
              <div>
                <p>Total Users</p>
                <strong>{selectedUsers.length}</strong>
              </div>
            </article>

            <article className={styles.companyReviewStatGreen}>
              <span>✅</span>
              <div>
                <p>Active Users</p>
                <strong>{activeUsers}</strong>
              </div>
            </article>

            <article className={styles.companyReviewStatBlue}>
              <span>🛡️</span>
              <div>
                <p>Administrators</p>
                <strong>{adminUsers}</strong>
              </div>
            </article>

            <article className={styles.companyReviewStatOrange}>
              <span>🏬</span>
              <div>
                <p>Branches</p>
                <strong>{selected.branchesCount || uniqueBranches}</strong>
              </div>
            </article>

            <article className={styles.companyReviewStatPink}>
              <span>💳</span>
              <div>
                <p>Subscriptions</p>
                <strong>{selectedSubscriptions.length}</strong>
              </div>
            </article>
          </div>

          <article className={styles.companyInformationPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span>🏢</span>
                <div>
                  <h3>Company Information</h3>
                  <p>Complete registered details for {selected.name}</p>
                </div>
              </div>
            </div>

            <div className={styles.companyInfoGrid}>
              <div className={styles.companyInfoItem}>
                <span>Company Name</span>
                <strong>{selected.name}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Company Code</span>
                <strong>{selected.code}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Email Address</span>
                <strong>{selected.email || "N/A"}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Phone Number</span>
                <strong>{selected.phone || "N/A"}</strong>
              </div>
              <div className={styles.companyInfoItemWide}>
                <span>Physical Address</span>
                <strong>{selected.address || "N/A"}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Current Status</span>
                <strong>{selected.status}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Latest Plan</span>
                <strong>{selected.latestPlan || "No plan"}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Latest Amount</span>
                <strong>{formatMoney(selected.latestAmount)}</strong>
              </div>
              <div className={styles.companyInfoItem}>
                <span>Registered Users</span>
                <strong>{selected.usersCount}</strong>
              </div>
            </div>
          </article>

          <article className={styles.tablePanel}>
            <CardHeader
              title={`Users at ${selected.name}`}
              subtitle="Username, email, role, branch, phone and account status"
            />

            {selectedUsers.length ? (
              <ResponsiveTable>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedUsers.map((companyUser) => (
                    <tr key={companyUser.id}>
                      <td>
                        <Entity
                          name={companyUser.name}
                          sub={companyUser.companyName || selected.name}
                        />
                      </td>
                      <td>{companyUser.username || "N/A"}</td>
                      <td>{companyUser.email || "N/A"}</td>
                      <td>{companyUser.phone || "N/A"}</td>
                      <td>
                        <span className={styles.roleBadge}>
                          {String(companyUser.role || "N/A").replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                      </td>
                      <td>{companyUser.branchName || "N/A"}</td>
                      <td>
                        <StatusBadge status={companyUser.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
            ) : (
              <div className={styles.companyEmptyState}>
                <span>👥</span>
                <h3>No users found for this company</h3>
                <p>
                  Confirm that the dashboard API returns either companyId or an
                  exact companyName for every user.
                </p>
              </div>
            )}
          </article>

          <article className={styles.tablePanel}>
            <CardHeader
              title="Company Subscriptions"
              subtitle="All subscription records belonging to the selected company"
            />

            {selectedSubscriptions.length ? (
              <ResponsiveTable>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Starts At</th>
                    <th>Ends At</th>
                    <th>Subscription Status</th>
                    <th>Company Status</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedSubscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td>{subscription.plan}</td>
                      <td>{formatMoney(subscription.amount)}</td>
                      <td>{formatDate(subscription.startsAt)}</td>
                      <td>{formatDate(subscription.endsAt)}</td>
                      <td>
                        <StatusBadge
                          status={subscription.isActive ? "ACTIVE" : "DISABLED"}
                        />
                      </td>
                      <td>
                        <StatusBadge status={subscription.company.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
            ) : (
              <div className={styles.companyEmptyState}>
                <span>💳</span>
                <h3>No subscription found</h3>
                <p>
                  This company does not currently have a subscription record.
                </p>
              </div>
            )}
          </article>
        </section>
      ) : (
        <div className={styles.companyEmptyState}>
          <span>🏢</span>
          <h3>No company selected</h3>
          <p>Create or select a company to review its information.</p>
        </div>
      )}
    </PageShell>
  );
}

function GlobalReportsPage({ data }: { data: DashboardData }) {
  return (
    <PageShell
      icon="📊"
      title="View Global Reports"
      subtitle="Company reports, subscription reports, user activity reports and audit reports."
    >
      <div className={styles.reportCards}>
        <ReportCard title="Company Status Report" icon="🏢">
          <MiniReportTable
            rows={data.companies
              .slice(0, 6)
              .map((company) => [
                company.name,
                company.status,
                `${company.usersCount} users`,
              ])}
          />
        </ReportCard>

        <ReportCard title="Subscription Revenue Report" icon="💳">
          <MiniReportTable
            rows={data.subscriptions
              .slice(0, 6)
              .map((sub) => [
                sub.company.name,
                sub.plan,
                formatMoney(sub.amount),
              ])}
          />
        </ReportCard>

        <ReportCard title="User Activity Report" icon="👥">
          <MiniReportTable
            rows={data.users
              .slice(0, 6)
              .map((user) => [user.name, user.role, user.status])}
          />
        </ReportCard>

        <ReportCard title="Audit Log Report" icon="🧾">
          <MiniReportTable
            rows={data.auditLogs
              .slice(0, 6)
              .map((log) => [
                log.action,
                log.module,
                formatDate(log.createdAt),
              ])}
          />
        </ReportCard>
      </div>
    </PageShell>
  );
}

function ManagePermissionsPage({
  permissions,
  setPermissions,
}: {
  permissions: ReturnType<typeof createPermissionState>;
  setPermissions: (value: ReturnType<typeof createPermissionState>) => void;
}) {
  const permissionNames = [
    "dashboard",
    "companies",
    "users",
    "reports",
    "settings",
    "audit",
  ];

  function toggle(role: keyof typeof permissions, permission: string) {
    setPermissions({
      ...permissions,
      [role]: {
        ...permissions[role],
        [permission]:
          !permissions[role][
            permission as keyof (typeof permissions)[typeof role]
          ],
      },
    });
  }

  return (
    <PageShell
      icon="🛡️"
      title="Manage Permissions"
      subtitle="Enable or disable permissions for every system role."
    >
      <div className={styles.permissionMatrix}>
        {Object.entries(permissions).map(([role, rolePermissions]) => (
          <article className={styles.permissionRoleCard} key={role}>
            <div>
              <h2>{role.replaceAll("_", " ")}</h2>
              <p>Control access permissions</p>
            </div>

            <div className={styles.permissionSwitches}>
              {permissionNames.map((permission) => (
                <label key={permission} className={styles.switchRow}>
                  <span>{permission}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(
                      rolePermissions[
                        permission as keyof typeof rolePermissions
                      ],
                    )}
                    onChange={() =>
                      toggle(role as keyof typeof permissions, permission)
                    }
                  />
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function SystemSettingsPage({
  settings,
  setSettings,
}: {
  settings: SettingsState;
  setSettings: Dispatch<SetStateAction<SettingsState>>;
}) {
  const settingsList: Array<[keyof SettingsState, string, string]> = [
    [
      "mfa",
      "Multi-Factor Authentication",
      "Require extra verification for system users.",
    ],
    ["backups", "Automatic Backups", "Run automatic daily database backups."],
    ["auditLogs", "Audit Logging", "Track important system activities."],
    [
      "passwordExpiry",
      "Password Expiry",
      "Force password change after a period.",
    ],
    [
      "financialLocking",
      "Financial Day Locking",
      "Lock approved accounting periods.",
    ],
    ["maintenanceMode", "Maintenance Mode", "Temporarily stop company access."],
  ];

  return (
    <PageShell
      icon="⚙️"
      title="Manage System Settings"
      subtitle="Control security, backups, audit, password and financial protection settings."
    >
      <div className={styles.settingsCards}>
        {settingsList.map(([key, title, text]) => (
          <article className={styles.settingCard} key={key}>
            <div className={styles.settingIcon}>⚙️</div>
            <h2>{title}</h2>
            <p>{text}</p>

            <label className={styles.largeSwitch}>
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={() =>
                  setSettings((current) => ({
                    ...current,
                    [key]: !current[key],
                  }))
                }
              />
              <span>{settings[key] ? "Enabled" : "Disabled"}</span>
            </label>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function ResetPasswordsPage({
  users,
  resetPassword,
}: {
  users: UserItem[];
  resetPassword: (userId: string) => void;
}) {
  return (
    <PageShell
      icon="🔑"
      title="Reset Passwords"
      subtitle="Review users and generate temporary passwords securely."
    >
      <article className={styles.tablePanel}>
        <ResponsiveTable>
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Entity name={user.name} sub={user.email} />
                </td>
                <td>{user.username}</td>
                <td>{user.companyName}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <button
                    className={styles.warningButton}
                    onClick={() => resetPassword(user.id)}
                  >
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </article>
    </PageShell>
  );
}

function AuditLogsPage({ logs }: { logs: AuditItem[] }) {
  return (
    <PageShell
      icon="🧾"
      title="View Audit Logs"
      subtitle="Review all sensitive system activities and changes."
    >
      <div className={styles.auditTimeline}>
        {logs.map((log) => (
          <article key={log.id}>
            <div className={styles.auditDot}></div>
            <div>
              <strong>{log.action}</strong>
              <p>{log.details || "No details provided."}</p>
              <span>
                {log.user?.name || "System"} • {log.module} •{" "}
                {formatDate(log.createdAt)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function PageShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.pageShell}>
      <div className={styles.pageTitle}>
        <div>{icon}</div>
        <section>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </section>
      </div>

      {children}
    </section>
  );
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: string;
}) {
  return (
    <div className={styles.cardHeader}>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {action && <button className={styles.roundButton}>{action}</button>}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  change,
}: {
  icon: string;
  label: string;
  value: string;
  change: string;
}) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span>
          <b>{icon}</b>
          {label}
        </span>
        <strong>{change}</strong>
      </div>
      <h3>{value}</h3>
    </article>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <article className={styles.miniStat}>
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function PipelineItem({
  color,
  label,
  value,
}: {
  color: "purple" | "green" | "gray" | "blue";
  label: string;
  value: string;
}) {
  return (
    <div className={styles.pipelineItem}>
      <span className={styles[color]}></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CompanyMiniRow({ company }: { company: CompanyItem }) {
  return (
    <div className={styles.companyMiniRow}>
      <div className={styles.entityAvatar}>{company.name.charAt(0)}</div>
      <div>
        <h4>{company.name}</h4>
        <p>{company.address || company.code}</p>
      </div>
      <div>
        <strong>{formatMoney(company.latestAmount)}</strong>
        <span>{company.status}</span>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.summaryRow}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MessageForm({
  users,
  form,
  setForm,
  sendMessage,
}: {
  users: UserItem[];
  form: {
    receiverId: string;
    subject: string;
    message: string;
  };
  setForm: (value: {
    receiverId: string;
    subject: string;
    message: string;
  }) => void;
  sendMessage: () => void;
}) {
  return (
    <div className={styles.messageForm}>
      <select
        value={form.receiverId}
        onChange={(event) =>
          setForm({
            ...form,
            receiverId: event.target.value,
          })
        }
      >
        <option value="">Select receiver</option>
        {users.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name} - {item.role}
          </option>
        ))}
      </select>

      <input
        placeholder="Subject"
        value={form.subject}
        onChange={(event) =>
          setForm({
            ...form,
            subject: event.target.value,
          })
        }
      />

      <textarea
        placeholder="Write message..."
        value={form.message}
        onChange={(event) =>
          setForm({
            ...form,
            message: event.target.value,
          })
        }
      />

      <button onClick={sendMessage}>Send Message</button>
    </div>
  );
}

function PopupPanel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.popupPanel}>
      <div className={styles.popupHeader}>
        <h3>{title}</h3>
        <span>{count} unread</span>
      </div>

      <div className={styles.popupList}>{children}</div>
    </div>
  );
}

function ResponsiveTable({ children }: { children: ReactNode }) {
  return (
    <div className={styles.tableScroll}>
      <table>{children}</table>
    </div>
  );
}

function Entity({ name, sub }: { name: string; sub: string }) {
  return (
    <div className={styles.entity}>
      <div className={styles.entityAvatar}>{name.charAt(0)}</div>
      <div>
        <strong>{name}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "ACTIVE"
      ? styles.statusActive
      : status === "DISABLED" || status === "REMOVED"
        ? styles.statusDisabled
        : styles.statusSuspended;

  return <span className={`${styles.statusBadge} ${className}`}>{status}</span>;
}

function ReportCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.reportCard}>
      <div className={styles.reportHeader}>
        <div>{icon}</div>
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  );
}

function MiniReportTable({ rows }: { rows: string[][] }) {
  return (
    <div className={styles.miniReportTable}>
      {rows.map((row, index) => (
        <div key={index}>
          {row.map((cell, cellIndex) => (
            <span key={cellIndex}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<string> {
  const imageBitmap = await createImageBitmap(file);

  let width = imageBitmap.width;
  let height = imageBitmap.height;

  if (width > height && width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  } else if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context not available");
  }

  context.drawImage(imageBitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function toInputDate(value: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatMoneyShort(value: number) {
  if (value >= 1000000) return `TZS ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `TZS ${(value / 1000).toFixed(1)}K`;
  return `TZS ${value}`;
}
