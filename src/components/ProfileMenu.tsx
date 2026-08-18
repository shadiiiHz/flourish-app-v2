"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, MapPin, ShoppingBag, User, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toPersianDigits } from "../utils/phone";

function ProfileMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="پروفایل کاربری"
        aria-expanded={isOpen}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500 transition hover:bg-sand-100 sm:h-11 sm:w-11"
      >
        <User className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="absolute top-full end-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/40 bg-white/95 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_20px_50px_-20px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150"
          >
            <Link
              href="/profile"
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-cocoa-900 transition hover:bg-sand-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
                <User className="h-4 w-4" />
              </span>
              <span dir="ltr">{toPersianDigits(user?.phone ?? "")}</span>
            </Link>

            <div className="my-1 h-px bg-cocoa-900/10" />

            <Link
              href="/profile?tab=wallet"
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-cocoa-500 transition hover:bg-sand-50"
            >
              <Wallet className="h-4 w-4 text-cocoa-400" />
              کیف پول:{" "}
              {(user?.walletBalance ?? 0) > 0
                ? `${user!.walletBalance.toLocaleString("fa-IR")} تومان`
                : "بدون موجودی"}
            </Link>

            <div className="my-1 h-px bg-cocoa-900/10" />

            <Link
              href="/profile?tab=orders"
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-cocoa-700 transition hover:bg-sand-50"
            >
              <ShoppingBag className="h-4 w-4 text-sand-500" />
              سفارش‌های من
            </Link>

            <Link
              href="/profile?tab=addresses"
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-cocoa-700 transition hover:bg-sand-50"
            >
              <MapPin className="h-4 w-4 text-sand-500" />
              آدرس‌های من
            </Link>

            <div className="my-1 h-px bg-cocoa-900/10" />

            <button
              type="button"
              onClick={() => {
                close();
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger-500 transition hover:bg-danger-50"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProfileMenu;
