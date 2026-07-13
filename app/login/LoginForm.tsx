"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Login failed.");
        return;
      }

      router.push(data.redirectTo);
      router.refresh();
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#747c73] px-4 py-6 text-[#07140f] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[1480px] items-center justify-center">
        <section className="grid min-h-[760px] w-full overflow-hidden rounded-[28px] border border-black/20 bg-[#f8faf7] shadow-2xl lg:grid-cols-[1fr_1.08fr] lg:p-5">
          {/* LEFT LOGIN SIDE */}
          <div className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
            <div className="absolute left-10 top-8 hidden text-3xl font-semibold italic text-slate-200 lg:block">
              Simamia
            </div>

            <div className="w-full max-w-[440px]">
              <div className="mb-8 flex justify-center lg:justify-start">
                <div className="flex h-20 w-20 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#06170f] via-[#0c4d31] to-[#1c8f5b] shadow-2xl shadow-emerald-900/25">
                  <LogoMark />
                </div>
              </div>

              <div className="text-center lg:text-left">
                <p className="mb-2 text-sm font-black uppercase tracking-[0.28em] text-[#1b8757]">
                  Secure ERP Portal
                </p>

                <h1 className="text-3xl font-black tracking-tight text-[#07140f] sm:text-4xl">
                  Welcome Back
                </h1>

                <p className="mt-3 text-base leading-7 text-[#737b75]">
                  Sign in to Simamia Float ERP and continue managing float,
                  accounting, workforce, GPS tracking and company operations.
                </p>
              </div>

              <div className="my-9 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent lg:from-slate-200 lg:to-transparent" />

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-black text-[#07140f]">
                    Username or Email
                  </label>

                  <div className="group flex h-15 items-center rounded-[14px] border border-slate-200 bg-white shadow-sm transition focus-within:border-[#168655] focus-within:shadow-lg focus-within:shadow-emerald-900/10 focus-within:ring-4 focus-within:ring-emerald-900/10">
                    <div className="ml-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ecf7f1] text-[#168655] transition group-focus-within:bg-[#168655] group-focus-within:text-white">
                      <UserIcon />
                    </div>

                    <input
                      type="text"
                      value={login}
                      onChange={(event) => setLogin(event.target.value)}
                      placeholder="system_developer"
                      className="h-full w-full rounded-[14px] bg-transparent px-4 text-[15px] font-semibold text-[#07140f] outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-black text-[#07140f]">
                      Password
                    </label>

                    <button
                      type="button"
                      className="text-sm font-black text-[#168655] transition hover:text-[#07140f]"
                    >
                      Forgot?
                    </button>
                  </div>

                  <div className="group flex h-15 items-center rounded-[14px] border border-slate-200 bg-white shadow-sm transition focus-within:border-[#168655] focus-within:shadow-lg focus-within:shadow-emerald-900/10 focus-within:ring-4 focus-within:ring-emerald-900/10">
                    <div className="ml-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ecf7f1] text-[#168655] transition group-focus-within:bg-[#168655] group-focus-within:text-white">
                      <LockIcon />
                    </div>

                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      className="h-full w-full bg-transparent px-4 text-[15px] font-semibold text-[#07140f] outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="mr-4 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#ecf7f1] hover:text-[#168655]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {message && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-sm">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-15 w-full rounded-[14px] bg-gradient-to-r from-[#05170f] via-[#0b3a25] to-[#1b8757] text-sm font-black text-white shadow-xl shadow-emerald-950/20 transition hover:scale-[1.01] hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <p className="mt-7 text-center text-sm font-medium text-[#7c837d]">
                Enterprise access is restricted to authorized company users.
              </p>

              <details className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm backdrop-blur">
                <summary className="cursor-pointer font-black text-[#07140f]">
                  Demo Login Credentials
                </summary>

                <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                  <p>Developer: system_developer / Dev@12345</p>
                  <p>Super Admin: super_admin / Super@12345</p>
                  <p>Company Admin: company_admin / Admin@12345</p>
                  <p>Accountant: accountant / Accountant@12345</p>
                  <p>Staff: staff / Staff@12345</p>
                  <p>Broker: broker / Broker@12345</p>
                  <p>GPS Manager: gps_manager / Gps@12345</p>
                </div>
              </details>
            </div>
          </div>

          {/* RIGHT DESIGN SIDE */}
          <div className="relative hidden overflow-hidden rounded-[22px] bg-[#03180f] lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(30,140,89,0.7),transparent_28%),radial-gradient(circle_at_15%_85%,rgba(27,128,82,0.8),transparent_28%),radial-gradient(circle_at_78%_38%,rgba(11,54,35,0.95),transparent_36%)]" />
            <div className="absolute inset-0 bg-black/25" />

            <div className="absolute -right-24 top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute -bottom-24 left-12 h-80 w-80 rounded-full bg-green-500/20 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between p-16">
              <div>
                <p className="max-w-[620px] font-serif text-[72px] italic leading-[0.92] tracking-tight text-white/90">
                  Enter <br />
                  the Future
                </p>

                <h2 className="mt-8 max-w-[600px] text-[58px] font-light leading-[0.98] tracking-[-0.07em] text-white/85">
                  of Float, Cash Flow & Accounting, today
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <FeatureCard
                  icon={<MoneyIcon />}
                  title="Float Control"
                  text="Issue, collect, verify and track float transactions."
                />

                <FeatureCard
                  icon={<ChartIcon />}
                  title="Accounting"
                  text="Cash book, ledger, trial balance and reports."
                />

                <FeatureCard
                  icon={<GpsIcon />}
                  title="GPS Tracking"
                  text="Track staff, brokers, motorcycles and vehicles."
                />

                <FeatureCard
                  icon={<ShieldIcon />}
                  title="Secure Access"
                  text="Role-based login, audit logs and approvals."
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-[#168655]">
        {icon}
      </div>

      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
    </div>
  );
}

function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M35.8 8.9C29.2 7.5 20.4 9.5 15.2 15.8C9.8 22.3 9.4 31.4 13.9 37.2C19.3 44.1 31.1 42.5 36.6 35.3C42.3 27.7 41.9 16.4 35.8 8.9Z"
        className={dark ? "fill-[#1b8757]" : "fill-white"}
        opacity="0.96"
      />
      <path
        d="M13.5 38.5C20.1 40 28.8 37.9 34 31.7C39.4 25.2 39.9 16.1 35.4 10.3C30 3.4 18.1 5 12.7 12.2C7 19.8 7.4 31.1 13.5 38.5Z"
        className="fill-[#0b3a25]"
        opacity="0.92"
      />
      <path
        d="M27.5 15.3C24.4 16.2 21.7 18.6 20.4 21.7C19.2 24.7 19.6 28.4 21.6 31.2C24.7 30.3 27.4 27.9 28.7 24.8C29.9 21.8 29.5 18.1 27.5 15.3Z"
        className="fill-white"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V7Zm3 9.73V18h-2v-1.27a2 2 0 1 1 2 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5c5.5 0 9 5.2 9 7s-3.5 7-9 7-9-5.2-9-7 3.5-7 9-7Zm0 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2.2A1.8 1.8 0 1 1 12 10a1.8 1.8 0 0 1 0 3.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path
        d="M3.28 2 22 20.72 20.72 22l-3.05-3.05A10.94 10.94 0 0 1 12 20C6.5 20 3 14.8 3 13a7.86 7.86 0 0 1 2.26-3.84L2 3.28 3.28 2Zm8.72 4c5.5 0 9 5.2 9 7a7.45 7.45 0 0 1-1.7 3.22l-2.5-2.5A4 4 0 0 0 11.28 8.2L8.99 5.91A10.44 10.44 0 0 1 12 6Zm0 11a4 4 0 0 1-4-4c0-.5.09-.98.26-1.42l5.16 5.16A3.9 3.9 0 0 1 12 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 9v2a2 2 0 0 0 2-2H5Zm12 0a2 2 0 0 0 2 2V9h-2ZM5 15h2a2 2 0 0 0-2-2v2Zm12 0h2v-2a2 2 0 0 0-2 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 20h14v-2H5v2Zm1-4h3V9H6v7Zm5 0h3V4h-3v12Zm5 0h3v-6h-3v6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 20 6.5V12c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6.5L12 3Zm3.7 6.8-4.5 4.5-2-2-1.4 1.4 3.4 3.4 5.9-5.9-1.4-1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}