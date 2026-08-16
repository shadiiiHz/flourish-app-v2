"use client";

import { Info } from "lucide-react";
import { useOrderType } from "@/context/OrderTypeContext";
import { formatPreorderDateWithWeekday } from "@/lib/preorder";

function PreorderBanner() {
  const { orderType, preorder, openModal } = useOrderType();

  if (orderType !== "preorder" || !preorder) return null;

  return (
    <button
      type="button"
      onClick={openModal}
      className="flex w-full items-center justify-center gap-2 bg-sand-50 px-3 py-2.5 text-center text-xs font-semibold text-sand-500 transition hover:bg-sand-100 sm:text-sm"
    >
      شما در حال ثبت پیش‌سفارش برای تاریخ {formatPreorderDateWithWeekday(preorder.date)} هستید.
      <Info className="h-4 w-4 shrink-0" />
    </button>
  );
}

export default PreorderBanner;
