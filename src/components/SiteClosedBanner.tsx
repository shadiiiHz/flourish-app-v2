"use client";

import { Store } from "lucide-react";
import { useOrderType } from "@/context/OrderTypeContext";
import { useSiteStatus } from "@/context/SiteStatusContext";

function SiteClosedBanner() {
  const { siteClosed, manuallyClosed, businessHoursEnabled } = useSiteStatus();
  const { openModal } = useOrderType();

  if (!siteClosed) return null;

  // The manual toggle takes priority in the message even if both are on —
  // it's the deliberate "we're off today" signal, not an automatic side effect.
  const message =
    !manuallyClosed && businessHoursEnabled
      ? "در حال حاضر، فلوریش تعطیل است. اما امکان پیش‌سفارش وجود دارد."
      : "امروز فلوریش تعطیل است، اما امکان ثبت پیش‌سفارش وجود دارد.";

  return (
    <button
      type="button"
      onClick={openModal}
      className="flex w-full items-center justify-center gap-2 bg-sand-500 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:opacity-90 sm:text-sm"
    >
      <Store className="h-4 w-4 shrink-0" />
      {message}
    </button>
  );
}

export default SiteClosedBanner;
