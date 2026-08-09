import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  getCurrentUser,
  getDashboardPath,
} from "@/lib/auth";

import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Sign In | Simamia Float",
  description:
    "Securely sign in to the Simamia Float management portal.",
  icons: {
    icon: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect(getDashboardPath(currentUser.role));
  }

  return <LoginForm />;
}
