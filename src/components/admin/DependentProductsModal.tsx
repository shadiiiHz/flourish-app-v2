"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, Search, X } from "lucide-react";
import { apiUploadUrl, type AdminStockCandidate } from "@/lib/api";

interface DependentProductsModalProps {
  isOpen: boolean;
  /** A product that must never be offered (the parent being edited, null while it is still being created). */
  parentId: string | null;
  title?: string;
  description: string;
  /** Pick exactly one product instead of many (used to choose a new parent). */
  single?: boolean;
  confirmLabel?: string;
  /** Why a product can't be picked, or null if it can. Defaults to the rules for dependents of `parentId`. */
  getBlockedReason?: (c: AdminStockCandidate) => string | null;
  candidates: AdminStockCandidate[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

/** Why a product can't become a dependent of `parentId`, or null if it can. */
export function dependentBlockedReason(c: AdminStockCandidate, parentId: string | null): string | null {
  if (c.dependentCount > 0) return "مادر محصولات دیگر است";
  if (c.stockSourceId && c.stockSourceId !== parentId) return "وابسته به محصول مادر دیگری است";
  return null;
}

function DependentProductsModal({
  isOpen,
  parentId,
  title = "محصولات وابسته",
  description,
  single = false,
  confirmLabel = "تأیید انتخاب",
  getBlockedReason,
  candidates,
  selectedIds,
  onConfirm,
  onClose,
}: DependentProductsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Start every opening from the form's current selection, with a clean search box.
  useEffect(() => {
    if (isOpen) {
      setDraft(new Set(selectedIds));
      setQuery("");
    }
  }, [isOpen]);

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => c.id !== parentId)
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          (c.categoryTitle ?? "").toLowerCase().includes(q),
      );
  }, [candidates, parentId, query]);

  const blockedReason = (c: AdminStockCandidate) =>
    getBlockedReason ? getBlockedReason(c) : dependentBlockedReason(c, parentId);
  const selectableVisible = visible.filter((c) => !blockedReason(c));
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((c) => draft.has(c.id));

  const toggle = (id: string) =>
    setDraft((prev) => {
      if (single) return prev.has(id) ? new Set() : new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setDraft((prev) => {
      const next = new Set(prev);
      for (const c of selectableVisible) {
        if (allVisibleSelected) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        // Above MUI's Dialog (z-index 1300) since this opens from inside the product form.
        <motion.div
          className="fixed inset-0 z-[1400] overflow-y-auto"
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
              aria-labelledby="dependent-products-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-white/40 bg-white/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem]"
            >
              <div className="relative shrink-0 border-b border-sand-100 px-6 pb-4 pt-6">
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={onClose}
                  className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sand-600">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="dependent-products-title"
                      className="font-display text-lg font-bold text-cocoa-900"
                    >
                      {title}
                    </h2>
                    <p className="truncate text-xs text-cocoa-500">{description}</p>
                  </div>
                </div>

                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="جستجوی محصول یا دسته‌بندی"
                    className="w-full rounded-full border border-cocoa-900/10 bg-white py-2.5 pl-4 pr-10 text-sm outline-none focus:border-sand-400"
                  />
                </div>

                {!single && (
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={toggleAllVisible}
                      disabled={selectableVisible.length === 0}
                      className="font-bold text-sand-500 transition hover:text-sand-600 disabled:opacity-40"
                    >
                      {allVisibleSelected ? "لغو انتخاب همه" : "انتخاب همه"}
                    </button>
                    <span className="font-semibold text-cocoa-500">
                      {draft.size.toLocaleString("fa-IR")} محصول انتخاب شده
                    </span>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {visible.length === 0 ? (
                  <p className="py-10 text-center text-sm text-cocoa-500">محصولی یافت نشد</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {visible.map((c) => {
                      const reason = blockedReason(c);
                      const checked = draft.has(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={!!reason}
                            onClick={() => toggle(c.id)}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-right transition ${
                              checked
                                ? "border-sand-400 bg-sand-50"
                                : "border-transparent hover:bg-sand-50/60"
                            } ${reason ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center border transition ${single ? "rounded-full" : "rounded-md"} ${
                                checked
                                  ? "border-sand-500 bg-sand-500 text-white"
                                  : "border-cocoa-900/20 bg-white"
                              }`}
                            >
                              {checked && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <img
                              src={c.image ? apiUploadUrl(c.image) : "/assets/placeholder.png"}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-xl border border-sand-100 object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-cocoa-900">
                                {c.title}
                              </span>
                              <span className="block truncate text-xs text-cocoa-500">
                                {[c.categoryTitle, c.variantCount > 0 ? `${c.variantCount.toLocaleString("fa-IR")} نوع` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            {reason && (
                              <span className="shrink-0 rounded-full bg-cocoa-900/5 px-2 py-1 text-[10px] font-semibold text-cocoa-500">
                                {reason}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3 border-t border-sand-100 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border border-sand-200 bg-white px-4 py-3 text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm([...draft]);
                    onClose();
                  }}
                  className="flex-1 rounded-full bg-sand-500 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  {confirmLabel}
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

export default DependentProductsModal;
