"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart, type CartLine } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { siteConfig } from "../config/siteConfig";
import { createOrder } from "../lib/api";

const placeholder = "/assets/placeholder.png";

function submitOrder(lines: CartLine[], customerName: string | undefined) {
  createOrder({
    customerName,
    items: lines.map((line) => ({
      productId: line.itemId,
      variantId: line.variantId,
      title: line.title,
      variantTitle: line.variantTitle,
      price: line.price,
      quantity: line.quantity,
    })),
  }).catch(() => {
    // best-effort: WhatsApp remains the actual order channel, so a failed
    // sync here shouldn't block checkout
  });
}

function buildWhatsappMessage(
  lines: { title: string; variantTitle?: string; price: number; quantity: number }[],
  totalPrice: number,
  taxAmount: number,
  grandTotal: number,
) {
  const header = "سلام، می‌خواهم سفارش زیر را ثبت کنم:";
  const rows = lines.map((line) => {
    const name = line.variantTitle ? `${line.title} (${line.variantTitle})` : line.title;
    const lineTotal = (line.price * line.quantity).toLocaleString("fa-IR");
    return `• ${name} × ${line.quantity.toLocaleString("fa-IR")} = ${lineTotal} تومان`;
  });
  const footer = [
    `جمع کل: ${totalPrice.toLocaleString("fa-IR")} تومان`,
    `مالیات (۱۰٪): ${taxAmount.toLocaleString("fa-IR")} تومان`,
    `پرداختی: ${grandTotal.toLocaleString("fa-IR")} تومان`,
  ].join("\n");
  return [header, "", ...rows, "", footer].join("\n");
}

function CartDrawer() {
  const { lines, totalCount, totalPrice, taxAmount, grandTotal, closeCart, setQuantity, removeLine, clearCart } =
    useCart();
  const { user } = useAuth();
  const router = useRouter();

  const goToMenu = () => {
    // The drawer's own unmount (and its overflow-lock cleanup) is delayed by
    // its exit animation, which would race with the menu page's scroll-to-hash
    // effect. Clear the lock synchronously so that scroll isn't blocked.
    document.body.style.overflow = "";
    closeCart();
    router.push("/menu");
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeCart]);

  const whatsappHref =
    lines.length > 0
      ? `https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(
          buildWhatsappMessage(lines, totalPrice, taxAmount, grandTotal),
        )}`
      : undefined;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-100 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-cocoa-900/40 backdrop-blur-sm" onClick={closeCart} />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative flex h-full w-full max-w-md flex-col border-r border-white/40 bg-white shadow-[0_40px_80px_-30px_rgba(74,44,18,0.55)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-sand-50 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sand-50 text-sand-500">
              <ShoppingBag className="h-4.5 w-4.5" />
            </span>
            <h2 id="cart-drawer-title" className="font-display text-lg font-bold text-cocoa-900">
              سبد خرید
            </h2>
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={closeCart}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 shadow-sm transition hover:bg-sand-50"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sand-50 text-sand-300">
              <ShoppingBag className="h-7 w-7" />
            </span>
            <p className="text-sm font-semibold text-cocoa-700">سبد خرید شما خالی است</p>
            <p className="text-xs text-cocoa-500">محصولی که دوست دارید را به سبد اضافه کنید</p>
            <button
              type="button"
              onClick={goToMenu}
              className="mt-2 rounded-full bg-sand-400 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-105 active:scale-95"
            >
              مشاهده منو
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 sm:p-6">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center gap-3 rounded-2xl border border-sand-100 bg-white p-3"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-50">
                    <img
                      src={line.image || placeholder}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-cocoa-900">{line.title}</h4>
                    {line.variantTitle && (
                      <p className="text-xs text-cocoa-500">{line.variantTitle}</p>
                    )}
                    <p className="mt-1 text-sm font-bold text-sand-400">
                      {line.price.toLocaleString("fa-IR")} تومان
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      aria-label={`حذف ${line.title}`}
                      onClick={() => removeLine(line.key)}
                      className="text-cocoa-400 transition hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2 rounded-full border border-sand-100 bg-sand-50 p-1">
                      <button
                        type="button"
                        aria-label="کاهش تعداد"
                        onClick={() => setQuantity(line.key, line.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-cocoa-700 shadow-sm transition active:scale-95"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-cocoa-900">
                        {line.quantity.toLocaleString("fa-IR")}
                      </span>
                      <button
                        type="button"
                        aria-label="افزایش تعداد"
                        disabled={line.maxQuantity !== undefined && line.quantity >= line.maxQuantity}
                        onClick={() => setQuantity(line.key, line.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-cocoa-700 shadow-sm transition active:scale-95 disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-sand-50 p-5 sm:p-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-cocoa-600">جمع کل ({totalCount.toLocaleString("fa-IR")} کالا)</span>
                  <span className="font-semibold text-cocoa-900">
                    {totalPrice.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-cocoa-600">مالیات (۱۰٪)</span>
                  <span className="font-semibold text-cocoa-900">
                    {taxAmount.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-sand-50 pt-1.5 text-sm">
                  <span className="font-bold text-cocoa-700">پرداختی</span>
                  <span className="text-lg font-bold text-cocoa-900">
                    {grandTotal.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (user) {
                    submitOrder(lines, [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined);
                  }
                  clearCart();
                }}
                className="flex items-center justify-center rounded-full bg-sand-400 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                تکمیل خرید و ارسال سفارش
              </a>
              <button
                type="button"
                onClick={closeCart}
                className="rounded-full border border-sand-200 bg-white px-4 py-3 text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
              >
                ادامه خرید
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default CartDrawer;
