"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "./ForgotPassword.module.css";

type ResetResponse = {
  success?: boolean;
  message?: string;
};

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setMessage("");
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const result = (await response.json()) as ResetResponse;

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Password recovery failed.");
      }

      setMessage(
        result.message ||
          "If that email is registered, your company administrator has been notified.",
      );
      setEmail("");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Password recovery could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.formWrap}>
      <form onSubmit={submit} className={styles.formCard}>
        <h1 className={styles.formTitle}>Request password reset</h1>
        <p className={styles.formText}>
          Enter your registered email. Your Company Admin will receive a secure
          reset request and can set a new password from Manage Users.
        </p>

        <label className={styles.label}>
          Registered email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            autoComplete="email"
            className={styles.input}
            required
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
        >
          {loading ? "Sending request..." : "Send reset request"}
        </button>
      </form>

      <Link href="/login" className={styles.backLink}>
        Return to sign in
      </Link>
    </div>
  );
}
