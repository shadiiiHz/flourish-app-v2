"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/lib/api";

/** Fires one page-view beacon per pathname change — mounted once in SiteShell. */
function VisitTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    trackVisit(pathname);
  }, [pathname]);

  return null;
}

export default VisitTracker;
