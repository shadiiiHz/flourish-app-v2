"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Star, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getMyWallet, type MyWallet } from "@/lib/api";

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function MyClubStatus() {
  const { isAuthenticated, isLoading, openAuth } = useAuth();
  const [data, setData] = useState<MyWallet | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyWallet(1, 1)
      .then(setData)
      .catch(() => setData(null));
  }, [isAuthenticated]);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/60 p-5 text-center shadow-sm backdrop-blur-xl sm:flex-row sm:text-start">
        <p className="text-sm font-bold text-cocoa-700">
          برای دیدن امتیاز و سطح خودتان وارد حسابتان شوید یا ثبت‌نام کنید.
        </p>
        <button
          type="button"
          onClick={() => openAuth()}
          className="shrink-0 rounded-full bg-sand-500 px-7 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-sand-400"
        >
          ورود / ثبت‌نام
        </button>
      </div>
    );
  }

  if (!data) return null;
  const { loyalty, balance } = data;
  const { tier, nextTier, pointsToNextTier } = loyalty;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#d6457f]">
            <Crown className="h-3.5 w-3.5" />
            وضعیت شما در باشگاه
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-display text-xl font-extrabold text-cocoa-900">
            <span>
              سطح <bdi>{tier.name}</bdi>
            </span>
            <span aria-hidden="true" className="text-cocoa-600/40">
              |
            </span>
            <span>{fa(tier.cashbackPercent)}٪ کش‌بک</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-cocoa-600">
            {nextTier
              ? `${fa(pointsToNextTier)} امتیاز تا سطح «${nextTier.name}»`
              : "شما در بالاترین سطح هستید 👑"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold text-cocoa-700">
          <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5">
            <Star className="h-4 w-4 text-[#8f72f0]" />
            {fa(loyalty.points)} امتیاز
          </span>
          <Link
            href="/profile?tab=wallet"
            className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 transition hover:bg-white"
          >
            <Wallet className="h-4 w-4 text-sand-400" />
            {balance > 0 ? `${fa(balance)} تومان` : "کیف پول"}
          </Link>
        </div>
      </div>
    </div>
  );
}
