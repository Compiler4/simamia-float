import { redirect } from "next/navigation";
import { getCurrentUser, getRoleLabel } from "@/lib/auth";

export default async function BrokerDashboardPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "BROKER") redirect("/dashboard");

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="rounded-3xl bg-cyan-950 p-8 text-white">
        <h1 className="text-3xl font-black">{getRoleLabel(user.role)}</h1>
        <p className="mt-2 text-cyan-100">Welcome, {user.name}</p>
        <p className="mt-6">
          Confirm float received, record sales, collections, returns and upload
          proof of payment.
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="mt-8 rounded-xl bg-red-500 px-5 py-3 font-bold text-white">
        Logout
      </button>
    </form>
  );
}