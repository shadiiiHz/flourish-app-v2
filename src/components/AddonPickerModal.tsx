"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import AddonChecklist from "./AddonChecklist";
import { useCart } from "../context/CartContext";
import { useOrderType } from "../context/OrderTypeContext";
import {
  getDiscountedPrice,
  getEffectiveDiscountPercent,
  type MenuItem,
  type MenuItemVariant,
} from "../config/siteConfig";

/** Lets the customer tick a product's (or one of its variants') optional addons before one more unit goes into the cart. Ticking none is fine. */
function AddonPickerModal({
  item,
  variant,
  onClose,
}: {
  item: MenuItem;
  variant?: MenuItemVariant;
  onClose: () => void;
}) {
  const { addToCart, notify } = useCart();
  const { orderType } = useOrderType();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const addons = item.addons ?? [];
  const selectedAddons = useMemo(
    () => addons.filter((addon) => selectedIds.has(addon.id)),
    [addons, selectedIds],
  );

  const basePrice = getDiscountedPrice(
    variant ? variant.price : item.price,
    getEffectiveDiscountPercent(item, orderType),
  );
  const total = basePrice + selectedAddons.reduce((sum, addon) => sum + addon.price, 0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = () => {
    if (addToCart(item, variant, 1, selectedAddons)) {
      notify(`${variant ? `${item.title} (${variant.title})` : item.title} به سبد اضافه شد`);
    }
    onClose();
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-110 flex items-end justify-center p-0 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-cocoa-900/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="addon-picker-title"
        initial={{ opacity: 0, scale: 0.96, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 30 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative flex max-h-[88svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-white/40 bg-white/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:max-h-[85svh] sm:rounded-[2rem]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-sand-50 p-5 sm:p-6">
          <div>
            <h2 id="addon-picker-title" className="font-display text-lg font-bold text-cocoa-900 sm:text-xl">
              {variant ? `${item.title} — ${variant.title}` : item.title}
            </h2>
            <p className="mt-1 text-xs text-cocoa-500 sm:text-sm">
              افزودنی‌های دلخواهتان را انتخاب و به سبد خرید اضافه کنید
            </p>
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 shadow-sm transition hover:bg-sand-50"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <AddonChecklist addons={addons} selectedIds={selectedIds} onToggle={toggle} />
        </div>

        <div className="flex flex-col gap-3 border-t border-sand-50 p-5 sm:p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cocoa-600">قیمت نهایی</span>
            <span className="font-bold text-cocoa-900">{total.toLocaleString("fa-IR")} تومان</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-sand-200 bg-white px-4 py-3 text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
            >
              بستن
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-sand-400 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              افزودن
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default AddonPickerModal;
