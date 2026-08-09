"use client";

import {
  usePathname,
  useSearchParams,
} from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
} from "react";

import styles from "./RouteTransitionBar.module.css";

function RouteTransitionBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.href === window.location.href) return;

      setFinishing(false);
      setActive(true);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!active) return;

    setFinishing(true);
    const timer = window.setTimeout(() => {
      setActive(false);
      setFinishing(false);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, active]);

  return (
    <div
      className={`${styles.bar} ${active ? styles.active : ""} ${
        finishing ? styles.finishing : ""
      }`}
      aria-hidden="true"
    />
  );
}

export default function RouteTransitionBar() {
  return (
    <Suspense fallback={null}>
      <RouteTransitionBarInner />
    </Suspense>
  );
}
