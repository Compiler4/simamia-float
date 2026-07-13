import { redirect } from "next/navigation";
import { getCurrentUser, getDashboardPath } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getDashboardPath(user.role));
  }

  return <LoginForm />;
}