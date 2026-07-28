import Link from "next/link";
import styles from "./AccountantPortalLinks.module.css";

const modules = [
  { href: "/accountant/control-centre", icon: "finance_mode", title: "Accountant Control Centre", description: "Approvals, attendance, proof, bank and reports" },
  { href: "/accountant/staff-attendance", icon: "fact_check", title: "STAFF Attendance", description: "Morning and evening accountant journal" },
  { href: "/accountant/staff-floats", icon: "account_balance_wallet", title: "Issue Float + Cash", description: "Fund active STAFF users and track totals" },
  { href: "/accountant/float-returns", icon: "assignment_return", title: "Float Returns", description: "Verify uploaded receipts and returned funds" },
  { href: "/accountant/bank-verification", icon: "account_balance", title: "Bank Verification", description: "Compare STAFF deposits with bank records" },
  { href: "/accountant/accounting-periods", icon: "lock_clock", title: "Accounting Periods", description: "Lock periods and request reopening" },
];

export default function AccountantPortalLinks() {
  return <section className={styles.grid} aria-label="Accountant modules">
    {modules.map((module) => <Link href={module.href} key={module.href} className={styles.link}>
      <span className={styles.icon} aria-hidden="true">{module.icon}</span>
      <span><strong>{module.title}</strong><small>{module.description}</small></span>
      <b aria-hidden="true">›</b>
    </Link>)}
  </section>;
}
