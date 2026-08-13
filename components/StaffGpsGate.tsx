"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import StaffLocationTracker from "@/app/staff/dashboard/StaffLocationTracker";

type SessionResponse = {
  authenticated?: boolean;
  user?: {
    role?: string | null;
  } | null;
};

export default function StaffGpsGate() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });
        const body = (await response.json()) as SessionResponse;

        if (!active) return;

        setEnabled(
          response.ok &&
            body.authenticated === true &&
            String(body.user?.role ?? "").toUpperCase() === "STAFF",
        );
      } catch {
        if (active) setEnabled(false);
      }
    }

    void checkSession();

    window.addEventListener("focus", checkSession);

    return () => {
      active = false;
      window.removeEventListener("focus", checkSession);
    };
  }, [pathname]);

  return enabled ? <StaffLocationTracker /> : null;
}
