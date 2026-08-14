"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { getOrder } from "@/lib/api";
import type { Order } from "@/types/order";
import Preloader from "@/components/Preloader";

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-white/40 bg-white/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-7">
      {children}
    </div>
  );
}

function CheckoutResultContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const orderId = searchParams.get("orderId");
  const isPaid = status === "paid";

  const { clearCart } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(!!orderId);

  useEffect(() => {
    if (isPaid) clearCart();
  }, [isPaid, clearCart]);

  useEffect(() => {
    if (!orderId) return;
    getOrder(orderId)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="mx-auto max-w-lg px-3 py-10 sm:px-6 sm:py-16">
      <GlassCard>
        <div className="flex flex-col items-center gap-3 text-center">
          {isPaid ? (
            <CircleCheck className="h-14 w-14 text-sand-500" />
          ) : (
            <CircleX className="h-14 w-14 text-danger-500" />
          )}
          <h1 className="font-display text-lg font-bold text-cocoa-900">
            {isPaid ? "پرداخت با موفقیت انجام شد" : "پرداخت ناموفق بود"}
          </h1>
          <p className="text-sm text-cocoa-500">
            {isPaid
              ? "سفارش شما ثبت شد و به‌زودی آماده‌سازی می‌شود."
              : "متأسفانه پرداخت انجام نشد. سبد خرید شما همچنان حفظ شده و می‌توانید دوباره تلاش کنید."}
          </p>

          {loading ? (
            <Preloader fullScreen={false} />
          ) : order ? (
            <div className="mt-2 w-full rounded-2xl border border-sand-100 bg-white p-4 text-right">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cocoa-600">شماره سفارش</span>
                <span dir="ltr" className="font-semibold text-cocoa-900">
                  {order.id}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-cocoa-600">مبلغ پرداختی</span>
                <span className="font-bold text-cocoa-900">
                  {order.total.toLocaleString("fa-IR")} تومان
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row">
            {isPaid ? (
              <Link
                href="/profile?tab=orders"
                className="flex-1 rounded-full bg-sand-500 px-4 py-3 text-center text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                مشاهده سفارش‌های من
              </Link>
            ) : (
              <Link
                href="/checkout"
                className="flex-1 rounded-full bg-sand-500 px-4 py-3 text-center text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                تلاش مجدد
              </Link>
            )}
            <Link
              href="/menu"
              className="flex-1 rounded-full border border-sand-200 bg-white px-4 py-3 text-center text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
            >
              بازگشت به منو
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function CheckoutResultPage() {
  return (
    <Suspense fallback={<Preloader />}>
      <CheckoutResultContent />
    </Suspense>
  );
}

export default CheckoutResultPage;
