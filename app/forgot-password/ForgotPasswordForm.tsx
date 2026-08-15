"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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
    <div className="px-6 py-8 sm:px-10 sm:py-10">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"
      >
        <h1 className="text-lg font-black text-[#0d5137]">
          Request password reset
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#547066]">
          Enter your registered email. Your Company Admin will receive a secure
          reset request and can set a new password from Manage Users.
        </p>

        <label className="mt-5 block text-xs font-black uppercase tracking-[0.08em] text-[#27564a]">
          Registered email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            autoComplete="email"
            className="mt-2 h-12 w-full rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-bold text-[#07140f] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-900/10"
            required
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-white p-3 text-sm font-bold text-[#0d5137]">
            {message}
          </p>
        ) : null}

        <button
          disabled={loading}
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#05170f] via-[#0b3a25] to-[#1b8757] px-5 text-sm font-black text-white shadow-xl shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-emerald-900/20 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Sending request..." : "Send reset request"}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#0d5137] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        Return to sign in
      </Link>
    </div>
  );
}
