import ForgotPasswordForm from "./ForgotPasswordForm";

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
