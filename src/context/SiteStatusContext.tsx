"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSiteStatus } from "@/lib/api";

interface SiteStatusContextValue {
  /** When true, only preorders can be placed — instant ordering is closed site-wide. */
  siteClosed: boolean;
  /** The raw manual "close the site" toggle, independent of business hours. */
  manuallyClosed: boolean;
  /** Whether the automatic business-hours window is in effect. */
  businessHoursEnabled: boolean;
  /** "HH:mm" in Tehran time. */
  businessHoursStart: string;
  /** "HH:mm" in Tehran time. */
  businessHoursEnd: string;
}

const DEFAULT_STATUS: SiteStatusContextValue = {
  siteClosed: false,
  manuallyClosed: false,
  businessHoursEnabled: false,
  businessHoursStart: "09:00",
  businessHoursEnd: "22:30",
};

const SiteStatusContext = createContext<SiteStatusContextValue | null>(null);

/**
 * Shared layouts don't re-run their server-side data fetch on client-side
 * navigation, so an admin flipping this mid-session wouldn't be picked up
 * just by browsing to another page. Poll it directly from the client instead.
 */
const POLL_INTERVAL_MS = 15_000;

export function SiteStatusProvider({
  children,
  ...initialStatus
}: Partial<SiteStatusContextValue> & { children: ReactNode }) {
  const [status, setStatus] = useState<SiteStatusContextValue>({
    ...DEFAULT_STATUS,
    ...initialStatus,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getSiteStatus().then(
        ({ siteClosed, manuallyClosed, businessHoursEnabled, businessHoursStart, businessHoursEnd }) => {
          if (!cancelled) {
            setStatus({ siteClosed, manuallyClosed, businessHoursEnabled, businessHoursStart, businessHoursEnd });
          }
        },
      );
    };
    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return <SiteStatusContext.Provider value={status}>{children}</SiteStatusContext.Provider>;
}

export function useSiteStatus() {
  const ctx = useContext(SiteStatusContext);
  if (!ctx) throw new Error("useSiteStatus must be used within a SiteStatusProvider");
  return ctx;
}
