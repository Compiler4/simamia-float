import Link from "next/link";

export const metadata = {
  title: "Forgot Password | Simamia Float ERP",
  description: "Recover access to Simamia Float ERP.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#a9b8ae_0%,#7a867d_45%,#5d685f_100%)] px-4 py-6 text-[#07140f]">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[760px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-white/35 bg-[#f8faf7] shadow-[0_30px_90px_rgba(7,20,15,0.32)]">
          <div className="bg-gradient-to-br from-[#06170f] via-[#0c4d31] to-[#168655] px-6 py-10 text-center text-white sm:px-10 sm:py-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-xl backdrop-blur">
              <KeyIcon />
            </div>
            <p className="mt-5 text-[clamp(2rem,8vw,3rem)] font-black tracking-[-0.055em]">
              Password recovery
            </p>
            <p className="mx-auto mt-3 max-w-[540px] text-sm leading-6 text-white/75 sm:text-base">
              Simamia Float uses administrator-controlled access to protect financial and company records.
            </p>
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <h1 className="text-lg font-black text-[#0d5137]">
                Contact your administrator
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#547066]">
                Ask your Company Admin or Super Admin to reset your password. Provide your username, company name and registered email address.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Contact Company Admin"],
                ["2", "Verify your account"],
                ["3", "Receive a new password"],
              ].map(([number, text]) => (
                <article key={number} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#ecf7f1] text-sm font-black text-[#168655]">
                    {number}
                  </span>
                  <p className="mt-3 text-xs font-bold leading-5 text-[#5c6961]">
                    {text}
                  </p>
                </article>
              ))}
            </div>

            <Link
              href="/login"
              className="mt-8 flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#05170f] via-[#0b3a25] to-[#1b8757] px-5 text-sm font-black text-white shadow-xl shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-emerald-900/20"
            >
              Return to sign in
            </Link>
          </div>
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
