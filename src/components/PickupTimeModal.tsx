"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { generatePickupDateOptions, generatePreorderTimeSlots, isSlotPassed } from "@/lib/preorder";
import { toPersianDigits } from "@/lib/formatNumber";

export interface PickupTimeSelection {
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "16:00 - 16:30"
}

interface PickupTimeModalProps {
  isOpen: boolean;
  initial: PickupTimeSelection | null;
  onClose: () => void;
  onConfirm: (selection: PickupTimeSelection) => void;
}

const TIME_SLOTS = generatePreorderTimeSlots();

function PickupTimeModal({ isOpen, initial, onClose, onConfirm }: PickupTimeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [dateOptions, setDateOptions] = useState(generatePickupDateOptions);
  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0].iso);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync draft state whenever the modal opens (also refreshes "today" if the page was left open overnight).
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      const options = generatePickupDateOptions();
      setDateOptions(options);
      const keep = initial && options.some((o) => o.iso === initial.date) ? initial : null;
      setSelectedDate(keep?.date ?? options[0].iso);
      setSelectedSlot(keep?.timeSlot ?? null);
      setError(null);
      setShowAllSlots(false);
    }
  }

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

  // Slots that already started today can't be picked.
  const availableSlots = useMemo(
    () => TIME_SLOTS.filter((slot) => !isSlotPassed(selectedDate, slot)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, isOpen],
  );

  const handleSelectDate = (iso: string) => {
    setSelectedDate(iso);
    setError(null);
    if (selectedSlot && isSlotPassed(iso, selectedSlot)) setSelectedSlot(null);
  };

  const handleConfirm = () => {
    if (!selectedSlot) {
      setError("لطفاً ساعت تحویل را انتخاب کنید");
      return;
    }
    onConfirm({ date: selectedDate, timeSlot: selectedSlot });
  };

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
              aria-labelledby="pickup-time-modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-[1.75rem] border border-white/40 bg-white/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-sand-50 p-5 sm:p-6">
                <h2
                  id="pickup-time-modal-title"
                  className="font-display text-lg font-bold text-cocoa-900"
                >
                  ساعت تحویل حضوری را انتخاب کنید.
                </h2>
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex justify-center gap-2">
                  {dateOptions.map((opt) => {
                    const isSelected = opt.iso === selectedDate;
                    return (
                      <button
                        key={opt.iso}
                        type="button"
                        onClick={() => handleSelectDate(opt.iso)}
                        className={`flex w-20 flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-3 text-center transition ${
                          isSelected
                            ? "border-sand-500 bg-sand-500 text-white"
                            : "border-cocoa-900/10 bg-white text-cocoa-900"
                        }`}
                      >
                        <span className="text-[11px] font-semibold">{opt.label}</span>
                        <span className="text-base font-bold sm:text-lg">
                          {toPersianDigits(opt.day)}
                        </span>
                        <span className="text-[11px] font-semibold">{opt.month}</span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-cocoa-900">انتخاب ساعت</p>
                    {availableSlots.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSlots((prev) => !prev)}
                        className="text-xs font-bold text-sand-500 transition hover:text-sand-600"
                      >
                        {showAllSlots ? "نمایش کمتر" : "نمایش بیشتر"}
                      </button>
                    )}
                  </div>

                  {availableSlots.length === 0 ? (
                    <p className="rounded-xl bg-sand-50 p-3 text-center text-xs font-semibold text-sand-500">
                      برای امروز بازه زمانی باقی نمانده است. لطفاً فردا را انتخاب کنید.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(showAllSlots ? availableSlots : availableSlots.slice(0, 6)).map((slot) => {
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
                            {toPersianDigits(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {error && <p className="text-xs font-semibold text-danger-500">{error}</p>}

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="w-full rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  تأیید و ادامه پرداخت
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

export default PickupTimeModal;
