"use client";

import { Store } from "lucide-react";
import { useOrderType } from "@/context/OrderTypeContext";
import { useSiteStatus } from "@/context/SiteStatusContext";

function SiteClosedBanner() {
  const { siteClosed } = useSiteStatus();
  const { openModal } = useOrderType();

  if (!siteClosed) return null;

  return (
    <button
      type="button"
      onClick={openModal}
      className="flex w-full items-center justify-center gap-2 bg-sand-500 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:opacity-90 sm:text-sm"
    >
      <Store className="h-4 w-4 shrink-0" />
      امروز فلوریش تعطیل است، اما امکان ثبت پیش‌سفارش وجود دارد.
    </button>
  );
}

export default SiteClosedBanner;
