"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, X } from "lucide-react";
import { toPersianDigits } from "@/lib/formatNumber";

interface DeliveryOutOfRangeModalProps {
  isOpen: boolean;
  maxRadiusKm: number;
  onClose: () => void;
  onSelectPickup: () => void;
}

function DeliveryOutOfRangeModal({
  isOpen,
  maxRadiusKm,
  onClose,
  onSelectPickup,
}: DeliveryOutOfRangeModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-100 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="fixed inset-0 bg-cocoa-900/40 backdrop-blur-sm" />

          <div
            className="relative flex min-h-full items-center justify-center p-3 sm:p-6"
            onClick={onClose}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="out-of-range-modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-[1.75rem] border border-white/40 bg-white/95 p-6 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem]"
            >
              <button
                type="button"
                aria-label="بستن"
                onClick={onClose}
                className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50"
              >
                <X className="h-4 w-4" />
              </button>

              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sand-50 text-sand-500">
                <MapPin className="h-7 w-7" />
              </span>

              <h2
                id="out-of-range-modal-title"
                className="mt-4 font-display text-lg font-bold text-cocoa-900"
              >
                این آدرس خارج از محدوده سرویس‌دهی است
              </h2>
              <p className="mt-2 text-sm leading-7 text-cocoa-600">
                فلوریش فقط تا شعاع {toPersianDigits(String(maxRadiusKm))} کیلومتری اطراف خودش
                سفارش را ارسال می‌کند. در صورتی که خارج از این محدوده هستید، می‌توانید با
                گرفتن پیک و انتخاب گزینه «مراجعه حضوری» سفارش خود را ثبت نمایید. (هزینه پیک به
                عهده مشتری است)
              </p>

              <button
                type="button"
                onClick={onSelectPickup}
                className="mt-6 w-full rounded-full bg-sand-500 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                انتخاب مراجعه حضوری
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default DeliveryOutOfRangeModal;
