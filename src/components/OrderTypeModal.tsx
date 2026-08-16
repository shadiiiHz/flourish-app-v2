"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, ShoppingBag, X } from "lucide-react";
import { useOrderType } from "@/context/OrderTypeContext";
import type { OrderType } from "@/types/order";
import {
  generatePreorderDateOptions,
  generatePreorderTimeSlots,
  isoToday,
} from "@/lib/preorder";

const DATE_OPTIONS = generatePreorderDateOptions();
const TIME_SLOTS = generatePreorderTimeSlots();
const VISIBLE_DATES = 5;

function OrderTypeModal() {
  const {
    isModalOpen,
    closeModal,
    orderType,
    preorder,
    setInstant,
    setPreorder,
  } = useOrderType();
  const [mounted, setMounted] = useState(false);
  const [selectedType, setSelectedType] = useState<OrderType>("instant");
  const [selectedDate, setSelectedDate] = useState<string>(isoToday());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateStartIndex, setDateStartIndex] = useState(0);
  const [showAllSlots, setShowAllSlots] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync local draft state from context whenever the modal opens.
  const [prevOpen, setPrevOpen] = useState(isModalOpen);
  if (isModalOpen !== prevOpen) {
    setPrevOpen(isModalOpen);
    if (isModalOpen) {
      setSelectedType(orderType);
      setSelectedDate(preorder?.date ?? isoToday());
      setSelectedSlot(preorder?.timeSlot ?? null);
      setError(null);
      const preorderIndex = preorder
        ? DATE_OPTIONS.findIndex((opt) => opt.iso === preorder.date)
        : 0;
      setDateStartIndex(
        Math.min(
          Math.max(preorderIndex, 0),
          DATE_OPTIONS.length - VISIBLE_DATES,
        ),
      );
    }
  }

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen, closeModal]);

  const handleContinue = () => {
    if (selectedType === "instant") {
      setInstant();
      closeModal();
      return;
    }
    if (!selectedSlot) {
      setError("لطفاً یک بازه زمانی انتخاب کنید");
      return;
    }
    setPreorder({ date: selectedDate, timeSlot: selectedSlot });
    closeModal();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isModalOpen && (
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
            onClick={closeModal}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-type-modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-[1.75rem] border border-white/40 bg-white/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-sand-50 p-5 sm:p-6">
                <h2
                  id="order-type-modal-title"
                  className="font-display text-lg font-bold text-cocoa-900"
                >
                  نوع سفارش را انتخاب کنید.
                </h2>
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={closeModal}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedType("instant")}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition ${
                      selectedType === "instant"
                        ? "border-sand-400 bg-sand-50/60"
                        : "border-cocoa-900/10 bg-white"
                    }`}
                  >
                    <ShoppingBag
                      className={`h-6 w-6 ${selectedType === "instant" ? "text-sand-500" : "text-cocoa-500"}`}
                    />
                    <span className="text-sm font-bold text-cocoa-900">
                      سفارش فوری
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType("preorder")}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition ${
                      selectedType === "preorder"
                        ? "border-sand-400 bg-sand-50/60"
                        : "border-cocoa-900/10 bg-white"
                    }`}
                  >
                    <Clock
                      className={`h-6 w-6 ${selectedType === "preorder" ? "text-sand-500" : "text-cocoa-500"}`}
                    />
                    <span className="text-sm font-bold text-cocoa-900">
                      پیش‌سفارش
                    </span>
                  </button>
                </div>

                {selectedType === "preorder" && (
                  <div className="mt-5 flex flex-col gap-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="روزهای قبل‌تر"
                        disabled={dateStartIndex === 0}
                        onClick={() =>
                          setDateStartIndex((i) => Math.max(0, i - 1))
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>

                      <div className="grid flex-1 grid-cols-5 gap-1.5">
                        {DATE_OPTIONS.slice(
                          dateStartIndex,
                          dateStartIndex + VISIBLE_DATES,
                        ).map((opt) => {
                          const isSelected = opt.iso === selectedDate;
                          return (
                            <button
                              key={opt.iso}
                              type="button"
                              onClick={() => setSelectedDate(opt.iso)}
                              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-3 text-center transition ${
                                isSelected
                                  ? "border-sand-500 bg-sand-500 text-white"
                                  : "border-cocoa-900/10 bg-white text-cocoa-900"
                              }`}
                            >
                              <span className="text-[11px] font-semibold">
                                {opt.label}
                              </span>
                              <span className="text-base font-bold sm:text-lg">
                                {opt.day}
                              </span>
                              <span className="text-[11px] font-semibold">
                                {opt.month}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        aria-label="روزهای بعدی"
                        disabled={
                          dateStartIndex >= DATE_OPTIONS.length - VISIBLE_DATES
                        }
                        onClick={() =>
                          setDateStartIndex((i) =>
                            Math.min(
                              DATE_OPTIONS.length - VISIBLE_DATES,
                              i + 1,
                            ),
                          )
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-cocoa-900">
                          انتخاب ساعت
                        </p>

                        {TIME_SLOTS.length > 6 && (
                          <button
                            type="button"
                            onClick={() => setShowAllSlots((prev) => !prev)}
                            className="text-xs font-bold text-sand-500 transition hover:text-sand-600"
                          >
                            {showAllSlots ? "نمایش کمتر" : "نمایش بیشتر"}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(showAllSlots
                          ? TIME_SLOTS
                          : TIME_SLOTS.slice(0, 6)
                        ).map((slot) => {
                          const isSelected = slot === selectedSlot;

                          return (
                            <button
                              key={slot}
                              type="button"
                              dir="ltr"
                              onClick={() => {
                                setSelectedSlot(slot);
                                setError(null);
                              }}
                              className={`rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition ${
                                isSelected
                                  ? "border-sand-500 bg-sand-500 text-white"
                                  : "border-cocoa-900/10 bg-white text-cocoa-900"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {error && (
                      <p className="text-xs font-semibold text-danger-500">
                        {error}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="mt-5 w-full rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  ادامه سفارش
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default OrderTypeModal;
