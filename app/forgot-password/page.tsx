import ForgotPasswordForm from "./ForgotPasswordForm";
import styles from "./ForgotPassword.module.css";

export const metadata = {
  title: "Forgot Password | Simamia Float ERP",
  description: "Recover access to Simamia Float ERP.",
};

export default function ForgotPasswordPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.card}>
          <div className={styles.hero}>
            <div className={styles.iconBox}>
              <KeyIcon />
            </div>
            <p className={styles.title}>Password recovery</p>
            <p className={styles.subtitle}>
              Simamia Float uses administrator-controlled access to protect
              financial and company records.
            </p>
          </div>

          <ForgotPasswordForm />
        </section>
      </div>
    </main>
  );
}

function KeyIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15.5 3a5.5 5.5 0 0 0-4.76 8.26L3 19v2h3l1-1h2l1-1v-2l1.74-1.74A5.5 5.5 0 1 0 15.5 3Zm0 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
        fill="currentColor"
      />
    </svg>
  );
}
