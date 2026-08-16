import type { ReactNode } from "react";
import SiteShell from "@/components/SiteShell";
import { getSiteStatus } from "@/lib/api";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { siteClosed } = await getSiteStatus();
  return <SiteShell siteClosed={siteClosed}>{children}</SiteShell>;
}
