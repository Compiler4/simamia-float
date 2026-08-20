import type { Metadata } from "next";

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

/**
 * Keep the login page independent from the database.
 *
 * Hostinger can therefore render /login even when MySQL is temporarily
 * unavailable or environment variables are being refreshed. The database
 * is contacted only by POST /api/auth/login after the user submits the form.
 */
export default function LoginPage() {
  return <LoginForm />;
}
