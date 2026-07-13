"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./StaffAssignments.module.css";

type Data = {
  staff: any[];
  brokers: any[];
  customers: any[];
  brokerAssignments: any[];
  customerAssignments: any[];
};

async function json(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", credentials: "include", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || "Request failed.");
  return body;
}

export default function StaffAssignmentsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [brokerForm, setBrokerForm] = useState({ staffId: "", brokerId: "", notes: "" });
  const [customerForm, setCustomerForm] = useState({ staffId: "", customerId: "", notes: "" });

  async function load() {
    try {
      setError("");
      setData(await json("/api/admin/staff-assignments"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignments could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const result = await json("/api/admin/staff-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(result.message);
      await load();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function assignBroker(event: FormEvent) {
    event.preventDefault();
    if (await action({ action: "ASSIGN_BROKER", ...brokerForm })) {
      setBrokerForm({ staffId: brokerForm.staffId, brokerId: "", notes: "" });
    }
  }

  async function assignCustomer(event: FormEvent) {
    event.preventDefault();
    if (await action({ action: "ASSIGN_CUSTOMER", ...customerForm })) {
      setCustomerForm({ staffId: customerForm.staffId, customerId: "", notes: "" });
    }
  }

  if (error) return <main className={styles.state}><h1>Staff assignments</h1><p>{error}</p><button onClick={() => void load()}>Try again</button></main>;
  if (!data) return <main className={styles.state}><p>Loading staff assignments…</p></main>;

  return (
    <main className={styles.page}>
      <header><div><small>COMPANY ADMIN</small><h1>Staff Work Assignments</h1><p>Each staff officer sees only the brokers and customers assigned here.</p></div><a href="/admin/dashboard">Back to dashboard</a></header>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.forms}>
        <form onSubmit={assignBroker}>
          <h2>Assign broker</h2>
          <label>Staff officer<select required value={brokerForm.staffId} onChange={(e) => setBrokerForm({ ...brokerForm, staffId: e.target.value })}><option value="">Choose staff</option>{data.staff.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select></label>
          <label>Broker<select required value={brokerForm.brokerId} onChange={(e) => setBrokerForm({ ...brokerForm, brokerId: e.target.value })}><option value="">Choose broker</option>{data.brokers.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.assignedRegion || item.email}</option>)}</select></label>
          <label>Notes<textarea value={brokerForm.notes} onChange={(e) => setBrokerForm({ ...brokerForm, notes: e.target.value })}/></label>
          <button disabled={busy}>Assign broker</button>
        </form>

        <form onSubmit={assignCustomer}>
          <h2>Assign customer</h2>
          <label>Staff officer<select required value={customerForm.staffId} onChange={(e) => setCustomerForm({ ...customerForm, staffId: e.target.value })}><option value="">Choose staff</option>{data.staff.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select></label>
          <label>Customer<select required value={customerForm.customerId} onChange={(e) => setCustomerForm({ ...customerForm, customerId: e.target.value })}><option value="">Choose customer</option>{data.customers.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.region || item.address || "No location"}</option>)}</select></label>
          <label>Notes<textarea value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}/></label>
          <button disabled={busy}>Assign customer</button>
        </form>
      </section>

      <section className={styles.tables}>
        <article><h2>Active broker assignments</h2><div className={styles.scroll}><table><thead><tr><th>#</th><th>Staff</th><th>Broker</th><th>Region</th><th>Assigned</th><th>Action</th></tr></thead><tbody>{data.brokerAssignments.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><b>{row.staff.name}</b><small>{row.staff.email}</small></td><td><b>{row.broker.name}</b><small>{row.broker.email}</small></td><td>{row.broker.assignedRegion || "—"}</td><td>{new Date(row.startedAt).toLocaleString()}</td><td><button disabled={busy} onClick={() => void action({ action: "UNASSIGN_BROKER", assignmentId: row.id })}>Remove</button></td></tr>)}</tbody></table></div></article>
        <article><h2>Active customer assignments</h2><div className={styles.scroll}><table><thead><tr><th>#</th><th>Staff</th><th>Customer</th><th>Location</th><th>Assigned</th><th>Action</th></tr></thead><tbody>{data.customerAssignments.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><b>{row.staff.name}</b><small>{row.staff.email}</small></td><td><b>{row.customer.name}</b><small>{row.customer.email || row.customer.phone || ""}</small></td><td>{row.customer.region || row.customer.address || "—"}</td><td>{new Date(row.startedAt).toLocaleString()}</td><td><button disabled={busy} onClick={() => void action({ action: "UNASSIGN_CUSTOMER", assignmentId: row.id })}>Remove</button></td></tr>)}</tbody></table></div></article>
      </section>
    </main>
  );
}
