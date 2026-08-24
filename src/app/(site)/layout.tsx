import type { ReactNode } from "react";
import SiteShell from "@/components/SiteShell";
import { getSiteStatus } from "@/lib/api";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { siteClosed, manuallyClosed, businessHoursEnabled, businessHoursStart, businessHoursEnd } =
    await getSiteStatus();
  return (
    <SiteShell
      siteClosed={siteClosed}
      manuallyClosed={manuallyClosed}
      businessHoursEnabled={businessHoursEnabled}
      businessHoursStart={businessHoursStart}
      businessHoursEnd={businessHoursEnd}
    >
      {children}
    </SiteShell>
  );
}
