"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { getDiscountedPrice, type MenuItem } from "../config/siteConfig";
import MarqueeText from "./MarqueeText";

const placeholder = "/assets/placeholder.png";

function CartVariantModal({
  item,
  categoryTitle,
  onClose,
}: {
  item: MenuItem;
  categoryTitle?: string;
  onClose: () => void;
}) {
  const { getQuantity, addToCart, setQuantity, lineKeyFor, totalCount, openCart } = useCart();
  const variants = item.variants ?? [];
  const hasDiscount = !!item.discountPercent;

  const productCount = variants.reduce(
    (sum, variant) => sum + getQuantity(item.id, variant.id),
    0,
  );
  const productPrice = variants.reduce((sum, variant) => {
    const variantPrice = hasDiscount
      ? getDiscountedPrice(variant.price, item.discountPercent)
      : variant.price;
    return sum + getQuantity(item.id, variant.id) * variantPrice;
  }, 0);

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

  const handleCheckout = () => {
    onClose();
    openCart();
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-100 flex items-end justify-center p-0 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-cocoa-900/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-variant-modal-title"
        initial={{ opacity: 0, scale: 0.96, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 30 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative flex max-h-[88svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-white/40 bg-white/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:max-h-[85svh] sm:rounded-[2rem]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-sand-50 p-5 sm:p-6">
          <div>
            {categoryTitle && (
              <span className="mb-1 inline-block rounded-full bg-sand-50 px-3 py-1 text-[11px] font-semibold text-sand-400">
                {categoryTitle}
              </span>
            )}
            <h2
              id="cart-variant-modal-title"
              className="font-display text-lg font-bold text-cocoa-900 sm:text-xl"
            >
              تنوع کالای {item.title}
            </h2>
            <p className="mt-1 text-xs text-cocoa-500 sm:text-sm">
              حالت مورد نظرتان را انتخاب و به سبد خرید اضافه کنید
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

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 sm:p-6">
          {variants.map((variant) => {
            const quantity = getQuantity(item.id, variant.id);
            const finalPrice = hasDiscount
              ? getDiscountedPrice(variant.price, item.discountPercent)
              : variant.price;
            const outOfStock = variant.stock === 0;
            const atMax = variant.stock !== undefined && quantity >= variant.stock;
            const variantDescription = variant.description || item.description;

            return (
              <div
                key={variant.id}
                className="flex items-center gap-3 rounded-2xl border border-sand-100 bg-white p-3 sm:gap-4 sm:p-4"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-50 sm:h-18 sm:w-18">
                  {hasDiscount && (
                    <span className="absolute right-1 top-1 z-10 rounded-full bg-sand-400 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-[0_4px_10px_-4px_rgba(190,18,60,0.7)]">
                      {item.discountPercent!.toLocaleString("fa-IR")}٪
                    </span>
                  )}
                  <img
                    src={variant.image || item.images[0] || placeholder}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-cocoa-900 sm:text-base">
                    {variant.title}
                  </h4>
                  {(variantDescription || variant.weight) && (
                    <MarqueeText
                      text={[variantDescription, variant.weight && `وزن: ${variant.weight}`]
                        .filter(Boolean)
                        .join("، ")}
                      className="text-xs text-cocoa-500"
                    />
                  )}
                  <p className="mt-1 flex items-baseline gap-1.5">
                    {hasDiscount && (
                      <span className="text-xs text-cocoa-500 line-through">
                        {variant.price.toLocaleString("fa-IR")}
                      </span>
                    )}
                    <span className="text-sm font-bold text-sand-400">
                      {finalPrice.toLocaleString("fa-IR")} تومان
                    </span>
                  </p>
                </div>

                {quantity > 0 ? (
                  <div className="flex shrink-0 items-center gap-2 rounded-full border border-sand-100 bg-sand-50 p-1">
                    <button
                      type="button"
                      aria-label="کاهش تعداد"
                      onClick={() => setQuantity(lineKeyFor(item.id, variant.id), quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-cocoa-700 shadow-sm transition active:scale-95"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-4 text-center text-sm font-bold text-cocoa-900">
                      {quantity.toLocaleString("fa-IR")}
                    </span>
                    <button
                      type="button"
                      aria-label="افزایش تعداد"
                      disabled={atMax}
                      onClick={() => addToCart(item, variant, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-cocoa-700 shadow-sm transition active:scale-95 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => addToCart(item, variant, 1)}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-sand-400 px-3.5 py-2 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:text-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    افزودن
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-sand-50 p-5 sm:p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cocoa-600">جمع این محصول</span>
            <span className="font-bold text-cocoa-900">
              {productPrice.toLocaleString("fa-IR")} تومان
              <span className="mr-1 text-xs font-normal text-cocoa-500">
                ({productCount.toLocaleString("fa-IR")} کالا)
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-sand-200 bg-white px-4 py-3 text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
            >
              ادامه خرید
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={totalCount === 0}
              className="flex-1 rounded-full bg-sand-400 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              تکمیل خرید
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default CartVariantModal;
