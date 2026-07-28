import Link from "next/link";

import styles from "./AccountantControlCentreLink.module.css";

export default function AccountantControlCentreLink() {
  return (
    <Link href="/accountant/control-centre" className={styles.link}>
      <span className={styles.icon} aria-hidden="true">finance_mode</span>
      <span className={styles.text}>
        <strong>Accountant Control Centre</strong>
        <small>Attendance, approvals, proofs and reports</small>
      </span>
      <span className={styles.arrow} aria-hidden="true">›</span>
    </Link>
  );
}
