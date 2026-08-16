"use client";

import { createContext, useContext, type ReactNode } from "react";

interface SiteStatusContextValue {
  /** When true, only preorders can be placed — instant ordering is closed site-wide. */
  siteClosed: boolean;
}

const SiteStatusContext = createContext<SiteStatusContextValue | null>(null);

export function SiteStatusProvider({
  siteClosed,
  children,
}: {
  siteClosed: boolean;
  children: ReactNode;
}) {
  return (
    <SiteStatusContext.Provider value={{ siteClosed }}>{children}</SiteStatusContext.Provider>
  );
}

export function useSiteStatus() {
  const ctx = useContext(SiteStatusContext);
  if (!ctx) throw new Error("useSiteStatus must be used within a SiteStatusProvider");
  return ctx;
}
