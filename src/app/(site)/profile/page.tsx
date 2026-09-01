"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cake,
  Camera,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gift,
  KeyRound,
  Landmark,
  LogOut,
  MapPin,
  Menu,
  PartyPopper,
  ShoppingBag,
  User,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { normalizeDigits, PHONE_REGEX, toPersianDigits } from "@/utils/phone";
import { getMyOrders, getMyWallet } from "@/lib/api";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  WALLET_TRANSACTION_TYPE_LABELS,
  type Order,
  type PaymentStatus,
  type WalletTransaction,
} from "@/types/order";
import { formatPreorderDateWithWeekday } from "@/lib/preorder";
import { formatOrderNumber } from "@/lib/orderNumber";
import { PERSIAN_MONTHS, daysInJalaliMonth, gregorianToJalali, jalaliToGregorian } from "@/lib/jalali";
import AddressesPanel from "@/components/AddressesPanel";
import ChangePasswordPanel from "@/components/ChangePasswordPanel";
import Preloader from "@/components/Preloader";

type ProfileTab = "info" | "orders" | "addresses" | "transactions" | "wallet" | "password";

const TABS: { id: ProfileTab; label: string; icon: typeof User }[] = [
  { id: "orders", label: "سفارش‌های من", icon: ShoppingBag },
  { id: "addresses", label: "آدرس‌های من", icon: MapPin },
  { id: "transactions", label: "تراکنش‌ها", icon: Landmark },
  { id: "wallet", label: "کیف پول", icon: WalletIcon },
  { id: "info", label: "اطلاعات من", icon: User },
  { id: "password", label: "تغییر کلمه عبور", icon: KeyRound },
];

function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-white/40 bg-white/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-7">
      {children}
    </div>
  );
}

const ORDERS_PAGE_SIZE = 3;

function OrdersPanel() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    getMyOrders(page, ORDERS_PAGE_SIZE)
      .then((result) => {
        setOrders(result.items);
        setTotalPages(result.totalPages);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, page]);

  return (
    <GlassCard>
      <h2 className="font-display text-lg font-bold text-cocoa-900">
        سفارش‌های من
      </h2>

      {loading ? (
        <Preloader fullScreen={false} />
      ) : orders.length === 0 ? (
        <p className="mt-3 text-sm text-cocoa-500">
          هنوز سفارشی ثبت نکرده‌اید.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-sand-100 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-cocoa-900">
                    سفارش {formatOrderNumber(order.orderNumber)}
                  </span>
                  <span className="text-xs text-cocoa-500">
                    {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                  </span>
                </div>
                <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold text-sand-500">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              {order.orderType === "preorder" && order.scheduledDate && (
                <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-sand-50 px-3 py-2 text-xs font-semibold text-sand-500">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  پیش‌سفارش برای{" "}
                  {formatPreorderDateWithWeekday(order.scheduledDate.slice(0, 10))}
                  {order.scheduledTimeSlot ? ` ساعت ${order.scheduledTimeSlot}` : ""}
                </div>
              )}
              <div className="mt-2.5 flex flex-col gap-1">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-cocoa-700">
                      {item.title}
                      {item.variantTitle
                        ? ` (${item.variantTitle})`
                        : ""} × {item.quantity.toLocaleString("fa-IR")}
                    </span>
                    <span className="font-semibold text-cocoa-900">
                      {(item.price * item.quantity).toLocaleString("fa-IR")}{" "}
                      تومان
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex flex-col gap-1 border-t border-sand-50 pt-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-cocoa-600">جمع کالا</span>
                  <span className="font-semibold text-cocoa-900">
                    {order.subtotal.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
                {!!order.discountAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-cocoa-600">
                      تخفیف {order.discountCode && `(${order.discountCode})`}
                    </span>
                    <span className="font-semibold text-danger-500">
                      {order.discountAmount.toLocaleString("fa-IR")}- تومان
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-cocoa-600">مالیات</span>
                  <span className="font-semibold text-cocoa-900">
                    {order.tax.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
                {order.deliveryMethod !== "pickup" && (
                  <div className="flex items-center justify-between">
                    <span className="text-cocoa-600">هزینه ارسال</span>
                    <span className="font-semibold text-cocoa-900">
                      {order.shippingCost.toLocaleString("fa-IR")} تومان
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between border-t border-sand-50 pt-1.5">
                  <span className="font-bold text-cocoa-700">مجموع</span>
                  <span className="font-bold text-cocoa-900">
                    {order.total.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="صفحه قبل"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                n === page
                  ? "bg-sand-500 text-white"
                  : "text-cocoa-700 hover:bg-sand-50"
              }`}
            >
              {n.toLocaleString("fa-IR")}
            </button>
          ))}

          <button
            type="button"
            aria-label="صفحه بعد"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </GlassCard>
  );
}

const TRANSACTIONS_PAGE_SIZE = ORDERS_PAGE_SIZE;

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: "bg-sand-50 text-sand-500",
  failed: "bg-danger-50 text-danger-500",
  pending: "bg-cocoa-700/10 text-cocoa-600",
};

function TransactionsPanel() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    getMyOrders(page, TRANSACTIONS_PAGE_SIZE)
      .then((result) => {
        setOrders(result.items);
        setTotalPages(result.totalPages);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, page]);

  return (
    <GlassCard>
      <h2 className="font-display text-lg font-bold text-cocoa-900">
        تراکنش‌ها
      </h2>

      {loading ? (
        <Preloader fullScreen={false} />
      ) : orders.length === 0 ? (
        <p className="mt-3 text-sm text-cocoa-500">
          هنوز تراکنشی ثبت نشده است.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-sand-100 p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-cocoa-900">
                  سفارش {formatOrderNumber(order.orderNumber)}
                </span>
                <span className="text-xs text-cocoa-500">
                  {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                </span>
                {order.paymentStatus === "paid" && order.paymentRefId && (
                  <span dir="ltr" className="text-xs text-cocoa-500">
                    کد پیگیری: {toPersianDigits(order.paymentRefId)}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-sm font-bold text-cocoa-900">
                  {order.total.toLocaleString("fa-IR")} تومان
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${PAYMENT_STATUS_STYLES[order.paymentStatus]}`}
                >
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="صفحه قبل"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                n === page
                  ? "bg-sand-500 text-white"
                  : "text-cocoa-700 hover:bg-sand-50"
              }`}
            >
              {n.toLocaleString("fa-IR")}
            </button>
          ))}

          <button
            type="button"
            aria-label="صفحه بعد"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </GlassCard>
  );
}

const WALLET_PAGE_SIZE = ORDERS_PAGE_SIZE;

function WalletPanel() {
  const { isAuthenticated } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    getMyWallet(page, WALLET_PAGE_SIZE)
      .then((result) => {
        setBalance(result.balance);
        setTransactions(result.transactions.items);
        setTotalPages(result.transactions.totalPages);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, page]);

  return (
    <GlassCard>
      <h2 className="font-display text-lg font-bold text-cocoa-900">کیف پول</h2>

      <div className="mt-4 rounded-2xl bg-sand-50/60 p-4 text-center">
        <p className="text-xs font-semibold text-cocoa-600">موجودی کیف پول</p>
        <p className="mt-1 font-display text-xl font-bold text-sand-500">
          {balance.toLocaleString("fa-IR")} تومان
        </p>
      </div>

      {loading ? (
        <Preloader fullScreen={false} />
      ) : transactions.length === 0 ? (
        <p className="mt-3 text-sm text-cocoa-500">هنوز تراکنشی در کیف پول ثبت نشده است.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-sand-100 p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-cocoa-900">
                  {WALLET_TRANSACTION_TYPE_LABELS[tx.type]}
                </span>
                <span className="text-xs text-cocoa-500">
                  {new Date(tx.createdAt).toLocaleDateString("fa-IR")}
                </span>
              </div>
              <span
                className={`text-sm font-bold ${tx.amount >= 0 ? "text-sand-500" : "text-danger-500"}`}
              >
                {tx.amount.toLocaleString("fa-IR")}
                {tx.amount >= 0 ? "+" : ""} تومان
              </span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="صفحه قبل"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                n === page
                  ? "bg-sand-500 text-white"
                  : "text-cocoa-700 hover:bg-sand-50"
              }`}
            >
              {n.toLocaleString("fa-IR")}
            </button>
          ))}

          <button
            type="button"
            aria-label="صفحه بعد"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 transition hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </GlassCard>
  );
}

function InfoField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <span className="absolute -top-2.5 right-4 z-10 bg-white/95 px-2 text-xs font-semibold text-sand-500">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Reads a stored ISO birthdate as Jalali year/month/day — via UTC getters since a date-only string is anchored to UTC midnight. */
function isoToJalaliParts(iso: string | null | undefined): { jy: string; jm: string; jd: string } {
  if (!iso) return { jy: "", jm: "", jd: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { jy: "", jm: "", jd: "" };
  const { jy, jm, jd } = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return { jy: String(jy), jm: String(jm), jd: String(jd) };
}

/** Formats a stored ISO birthdate as a Persian (Jalali) calendar date, e.g. "۵ شهریور ۱۴۰۴". */
function formatJalaliDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Formats a real ISO timestamp as a Persian (Jalali) calendar date in Tehran time, e.g. "۵ شهریور ۱۴۰۴". */
function formatJalaliDateTehran(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

const BIRTHDAY_BURST_EMOJIS = ["🎉", "🎂", "🎈", "🥳", "✨", "🎁"];

/** A one-time confetti-style emoji burst from the center of the screen, shown once when the birthday banner first appears. */
function BirthdayBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
        const distance = 110 + Math.random() * 150;
        return {
          id: i,
          emoji: BIRTHDAY_BURST_EMOJIS[i % BIRTHDAY_BURST_EMOJIS.length],
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          rotate: (Math.random() - 0.5) * 180,
          delay: Math.random() * 0.15,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute text-3xl sm:text-4xl"
          initial={{ opacity: 1, scale: 0.4, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, scale: 1, x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}

function BirthdayDiscountBanner() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showBurst, setShowBurst] = useState(true);
  const discount = user?.birthdayDiscount;

  useEffect(() => {
    if (!discount) return;
    const timer = window.setTimeout(() => setShowBurst(false), 1800);
    return () => window.clearTimeout(timer);
  }, [discount]);

  if (!discount) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(discount.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
    <AnimatePresence>{showBurst && <BirthdayBurst />}</AnimatePresence>
    <div className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-sand-200/70 bg-gradient-to-br from-sand-50 via-cream to-sand-100 p-5 shadow-[0_20px_50px_-30px_rgba(164,72,25,0.45)] sm:rounded-[2rem] sm:p-6">
      <PartyPopper className="pointer-events-none absolute -left-4 -top-4 h-24 w-24 rotate-12 text-sand-300/40" />
      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sand-500 text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)]">
            <Cake className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-cocoa-900 sm:text-base">
              کد تخفیف تولدت آماده‌ست! 🎂
            </p>
            <p className="mt-0.5 text-xs text-cocoa-600 sm:text-sm">
              فلوریش {toPersianDigits(String(discount.percent))}٪ تخفیف تولد بهت هدیه داده — فقط
              یک‌بار قابل استفاده‌ست و تا {formatJalaliDateTehran(discount.expiresAt)} اعتبار داره.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          dir="ltr"
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-full border-2 border-dashed border-sand-400 bg-white/70 px-4 py-2.5 text-sm font-bold text-cocoa-900 transition hover:bg-white sm:w-auto"
        >
          <Copy className="h-3.5 w-3.5 text-sand-500" />
          {discount.code}
          {copied && <span className="text-xs font-semibold text-sand-500">(کپی شد)</span>}
        </button>
      </div>
    </div>
    </>
  );
}

function ProfileInfoPanel() {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const initialJalali = isoToJalaliParts(user?.birthDate);
  const [birthYear, setBirthYear] = useState(initialJalali.jy);
  const [birthMonth, setBirthMonth] = useState(initialJalali.jm);
  const [birthDay, setBirthDay] = useState(initialJalali.jd);
  const [avatar, setAvatar] = useState(user?.avatar);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentJalaliYear = (() => {
    const now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()).jy;
  })();
  const jalaliYears = Array.from({ length: 100 }, (_, i) => currentJalaliYear - i);
  const maxDay = birthMonth
    ? daysInJalaliMonth(Number(birthYear) || currentJalaliYear, Number(birthMonth))
    : 31;
  const jalaliDays = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handleMonthChange = (value: string) => {
    setBirthMonth(value);
    const max = daysInJalaliMonth(Number(birthYear) || currentJalaliYear, Number(value));
    if (birthDay && Number(birthDay) > max) setBirthDay("");
  };

  const handleYearChange = (value: string) => {
    setBirthYear(value);
    if (birthMonth) {
      const max = daysInJalaliMonth(Number(value), Number(birthMonth));
      if (birthDay && Number(birthDay) > max) setBirthDay("");
    }
  };

  const birthDateIso =
    birthYear && birthMonth && birthDay
      ? (() => {
          const { gy, gm, gd } = jalaliToGregorian(Number(birthYear), Number(birthMonth), Number(birthDay));
          return new Date(Date.UTC(gy, gm - 1, gd)).toISOString();
        })()
      : null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizeDigits(phone);
    if (!PHONE_REGEX.test(cleanPhone)) {
      setPhoneError("شماره موبایل را به‌درستی وارد کنید");
      return;
    }
    setPhoneError(null);
    setPhone(cleanPhone);
    updateProfile({
      firstName,
      lastName,
      email,
      avatar,
      phone: cleanPhone,
      // Once set, the birthdate is locked — omit it so re-submitting the rest of the
      // form (name, phone, ...) doesn't hit the backend's "already set" rejection.
      ...(user?.birthDate ? {} : { birthDate: birthDateIso }),
    });
  };

  return (
    <>
      <BirthdayDiscountBanner />
      <GlassCard>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 overflow-hidden rounded-full border-2 border-dashed border-cocoa-900/15 bg-sand-50/60 text-cocoa-500 transition hover:border-sand-400 hover:bg-sand-50"
          >
            {avatar ? (
              <img
                src={avatar}
                alt="آواتار"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span className="text-[11px] font-semibold">آپلود آواتار</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        <div className="flex w-full flex-col gap-4">
          <InfoField label="نام">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>

          <InfoField label="نام خانوادگی">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>

          <InfoField label="موبایل">
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={toPersianDigits(phone)}
              onChange={(e) => {
                setPhoneError(null);
                setPhone(normalizeDigits(e.target.value));
              }}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>
          {phoneError && (
            <p className="-mt-2 text-xs font-semibold text-danger-500">
              {phoneError}
            </p>
          )}

          <InfoField label="ایمیل (اختیاری)">
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>

          <div>
            <InfoField label="تاریخ تولد (اختیاری)">
              {user?.birthDate ? (
                <div className="relative">
                  <Cake className="pointer-events-none absolute right-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-sand-400" />
                  <div className="w-full rounded-2xl border border-cocoa-900/10 bg-sand-50/60 py-3.5 pl-4 pr-11 text-right text-base text-cocoa-500">
                    {formatJalaliDate(user.birthDate)}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="w-1/3 rounded-2xl border border-cocoa-900/10 bg-white px-2 py-3.5 text-center text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
                  >
                    <option value="">روز</option>
                    {jalaliDays.map((d) => (
                      <option key={d} value={d}>
                        {toPersianDigits(String(d))}
                      </option>
                    ))}
                  </select>
                  <select
                    value={birthMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="w-1/3 rounded-2xl border border-cocoa-900/10 bg-white px-2 py-3.5 text-center text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
                  >
                    <option value="">ماه</option>
                    {PERSIAN_MONTHS.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={birthYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-1/3 rounded-2xl border border-cocoa-900/10 bg-white px-2 py-3.5 text-center text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
                  >
                    <option value="">سال</option>
                    {jalaliYears.map((y) => (
                      <option key={y} value={y}>
                        {toPersianDigits(String(y))}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </InfoField>
            <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-cocoa-500">
              <Gift className="h-3.5 w-3.5 shrink-0 text-sand-400" />
              {user?.birthDate
                ? "تاریخ تولد یک‌بار ثبت می‌شه و دیگه قابل ویرایش نیست"
                : "روز تولدت یه کد تخفیف ویژه از فلوریش برات فعال می‌شه 🎂 — بعد از ثبت، دیگه قابل تغییر نیست"}
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 sm:w-auto sm:self-start sm:px-8"
        >
          اعمال تغییرات
        </button>
      </form>
      </GlassCard>
    </>
  );
}

function SidebarNav({
  activeTab,
  onSelect,
  onLogout,
}: {
  activeTab: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  onLogout: () => void;
}) {
  const { user } = useAuth();

  return (
    <>
      <div className="flex items-center gap-3 px-2 py-3">
        <span dir="ltr" className="flex-1 text-sm font-bold text-cocoa-900">
          {toPersianDigits(user?.phone ?? "")}
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-50 text-sand-500">
          <User className="h-5 w-5" />
        </span>
      </div>

      <div className="my-1 h-px bg-cocoa-900/10" />

      <nav className="flex flex-col gap-1 py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`flex items-center justify-between gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
              activeTab === id
                ? "bg-sand-50 text-sand-500"
                : "text-cocoa-700 hover:bg-sand-50/60"
            }`}
          >
            {label}
            <Icon className="h-4.5 w-4.5" />
          </button>
        ))}

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-between gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold text-danger-500 transition hover:bg-danger-50"
        >
          خروج
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </nav>
    </>
  );
}

function SidebarDrawer({
  activeTab,
  onSelect,
  onLogout,
  onClose,
}: {
  activeTab: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  onLogout: () => void;
  onClose: () => void;
}) {
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

  return createPortal(
    <motion.div
      className="fixed inset-0 z-100 flex justify-end md:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="absolute inset-0 bg-cocoa-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative flex h-full w-full max-w-xs flex-col overflow-y-auto border-r border-white/40 bg-white p-3 shadow-[0_40px_80px_-30px_rgba(74,44,18,0.55)]"
      >
        <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <h2
            id="profile-drawer-title"
            className="font-display text-base font-bold text-cocoa-900"
          >
            حساب کاربری
          </h2>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 shadow-sm transition hover:bg-sand-50"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <SidebarNav
          activeTab={activeTab}
          onSelect={(tab) => {
            onSelect(tab);
            onClose();
          }}
          onLogout={onLogout}
        />
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function ProfilePageContent() {
  const { isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const requestedTab = searchParams.get("tab");
  const activeTab: ProfileTab = TABS.some((t) => t.id === requestedTab)
    ? (requestedTab as ProfileTab)
    : "info";

  useEffect(() => {
    if (!requestedTab) return;
    if (!TABS.some((t) => t.id === requestedTab)) {
      router.replace(pathname, { scroll: false });
    }
  }, [requestedTab, pathname, router]);

  const selectTab = (tab: ProfileTab) => {
    // AuthProvider only fetches /me once, on the very first page load — so
    // anything that changed on the account since then (a birthday code the
    // admin just generated, an updated wallet balance, ...) wouldn't show up
    // without a manual browser refresh. Re-checking on every tab switch
    // keeps it current without needing a full reload.
    refreshUser();
    if (tab === "info") router.push(pathname, { scroll: false });
    else router.push(`${pathname}?tab=${tab}`, { scroll: false });
  };

  const activeLabel =
    TABS.find((t) => t.id === activeTab)?.label ?? "اطلاعات من";

  if (isLoading) return <Preloader />;
  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-5xl px-3 py-8 sm:px-6 sm:py-12">
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="mb-4 flex w-full items-center justify-between gap-2.5 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm font-bold text-cocoa-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_20px_40px_-25px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
      >
        <span className="flex items-center gap-2">
          <Menu className="h-4.5 w-4.5 text-sand-500" />
          {activeLabel}
        </span>
        <span className="text-xs font-semibold text-cocoa-500">
          حساب کاربری
        </span>
      </button>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr] md:gap-6">
        <aside className="hidden h-fit rounded-[2rem] border border-white/40 bg-white/80 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 md:block">
          <SidebarNav
            activeTab={activeTab}
            onSelect={selectTab}
            onLogout={logout}
          />
        </aside>

        <div>
          {activeTab === "info" && <ProfileInfoPanel />}
          {activeTab === "orders" && <OrdersPanel />}
          {activeTab === "addresses" && <AddressesPanel />}
          {activeTab === "transactions" && <TransactionsPanel />}
          {activeTab === "wallet" && <WalletPanel />}
          {activeTab === "password" && <ChangePasswordPanel />}
        </div>
      </div>

      <AnimatePresence>
        {isDrawerOpen && (
          <SidebarDrawer
            activeTab={activeTab}
            onSelect={selectTab}
            onLogout={logout}
            onClose={() => setIsDrawerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageContent />
    </Suspense>
  );
}

export default ProfilePage;
