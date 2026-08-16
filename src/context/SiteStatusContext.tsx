"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSiteStatus } from "@/lib/api";

interface SiteStatusContextValue {
  /** When true, only preorders can be placed — instant ordering is closed site-wide. */
  siteClosed: boolean;
}

const SiteStatusContext = createContext<SiteStatusContextValue | null>(null);

/**
 * Shared layouts don't re-run their server-side data fetch on client-side
 * navigation, so an admin flipping this mid-session wouldn't be picked up
 * just by browsing to another page. Poll it directly from the client instead.
 */
const POLL_INTERVAL_MS = 15_000;

export function SiteStatusProvider({
  siteClosed: initialSiteClosed,
  children,
}: {
  siteClosed: boolean;
  children: ReactNode;
}) {
  const [siteClosed, setSiteClosed] = useState(initialSiteClosed);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getSiteStatus().then(({ siteClosed }) => {
        if (!cancelled) setSiteClosed(siteClosed);
      });
    };
    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pathname]);

  return (
    <SiteStatusContext.Provider value={{ siteClosed }}>{children}</SiteStatusContext.Provider>
  );
}

export function useSiteStatus() {
  const ctx = useContext(SiteStatusContext);
  if (!ctx) throw new Error("useSiteStatus must be used within a SiteStatusProvider");
  return ctx;
}
