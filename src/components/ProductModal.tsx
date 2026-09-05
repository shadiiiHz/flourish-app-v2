"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import ProductImageSlider from "./ProductImageSlider";
import CartVariantModal from "./CartVariantModal";
import { useCart } from "../context/CartContext";
import { useOrderType } from "../context/OrderTypeContext";
import { getDiscountedPrice, type MenuItem } from "../config/siteConfig";
import { toPersianDigits } from "../lib/formatNumber";

function ProductModal({
  item,
  categoryTitle,
  onClose,
}: {
  item: MenuItem;
  categoryTitle?: string;
  onClose: () => void;
}) {
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const { addToCart, notify, getQuantity, setQuantity, lineKeyFor } = useCart();
  const { orderType } = useOrderType();
  const hasDiscount = !!item.discountPercent && item.price > 0;
  const finalPrice = hasDiscount
    ? getDiscountedPrice(item.price, item.discountPercent)
    : item.price;
  const hasVariants = !!item.variants && item.variants.length > 0;
  const cartQuantity = getQuantity(item.id);
  const notPreorderable = orderType === "preorder" && !item.allowPreorder;
  // Preorderable products are always available with unlimited inventory in preorder mode.
  const unlimitedPreorder = orderType === "preorder" && item.allowPreorder;
  const outOfStock = !unlimitedPreorder && !hasVariants && item.stock === 0;
  const atMax = !unlimitedPreorder && !hasVariants && item.stock !== undefined && cartQuantity >= item.stock;
  const isUnorderable = unlimitedPreorder ? false : !item.isAvailable || notPreorderable;

  const handleAddClick = () => {
    if (hasVariants) {
      setVariantModalOpen(true);
      return;
    }
    if (addToCart(item)) {
      notify(`${item.title} به سبد اضافه شد`);
    }
  };

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
      className="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-6"
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
        aria-labelledby="product-modal-title"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-white/40 bg-white/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:min-h-[28rem] sm:max-h-[85svh] sm:flex-row sm:rounded-[2rem]"
      >
        <button
          type="button"
          aria-label="بستن"
          onClick={onClose}
          className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-cocoa-700 shadow-sm backdrop-blur transition hover:bg-white sm:left-4 sm:top-4"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="relative sm:w-1/2 sm:shrink-0">
          {hasDiscount && (
            <span className="absolute right-3 top-3 z-20 rounded-full bg-sand-400 px-2.5 py-1 text-xs font-bold text-white shadow-[0_6px_16px_-6px_rgba(190,18,60,0.7)]">
              {item.discountPercent!.toLocaleString("fa-IR")}٪ تخفیف
            </span>
          )}
          <ProductImageSlider
            images={item.images}
            alt={item.title}
            aspectClassName="h-64 sm:h-full sm:min-h-[28rem]"
          />
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-7">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {categoryTitle && (
                <span className="inline-block rounded-full bg-sand-50 px-3 py-1 text-[11px] font-semibold text-sand-400">
                  {categoryTitle}
                </span>
              )}
              {item.pickupOnly && (
                <span className="inline-block rounded-full bg-cocoa-700/10 px-3 py-1 text-[11px] font-semibold text-cocoa-700">
                  فقط تحویل حضوری
                </span>
              )}
            </div>
            <h2
              id="product-modal-title"
              className="font-display text-xl font-bold text-cocoa-900 sm:text-2xl"
            >
              {item.title}
            </h2>
            <p className="mt-2 text-sm leading-7 text-cocoa-600">
              {item.description}
            </p>
          </div>

          {(item.weight || item.ingredients || item.servingSize) && (
            <div className="flex flex-col gap-2 border-t border-white/50 pt-4">
              {item.weight && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-cocoa-700">وزن</span>
                  <span className="text-cocoa-600">{toPersianDigits(item.weight)}</span>
                </div>
              )}
              {item.servingSize && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-cocoa-700">مناسب برای</span>
                  <span className="text-cocoa-600">{toPersianDigits(item.servingSize)}</span>
                </div>
              )}
              {item.ingredients && (
                <div className="text-sm leading-6">
                  <span className="font-semibold text-cocoa-700">ترکیبات: </span>
                  <span className="text-cocoa-600">{toPersianDigits(item.ingredients)}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-white/50 pt-4">
            <div className="flex items-baseline gap-2">
              {hasDiscount && (
                <span className="text-sm text-cocoa-500 line-through">
                  {item.price.toLocaleString("fa-IR")}
                </span>
              )}
              <span className="text-lg font-bold text-sand-400">
                {!unlimitedPreorder && !item.isAvailable
                  ? "ناموجود"
                  : notPreorderable
                    ? "غیرقابل پیش‌سفارش"
                    : item.price > 0
                      ? `${finalPrice.toLocaleString("fa-IR")} تومان`
                      : "به‌زودی"}
              </span>
            </div>
            {!hasVariants && cartQuantity > 0 ? (
              <div className="flex shrink-0 items-center gap-3 rounded-full border border-sand-100 bg-sand-50 p-1">
                <button
                  type="button"
                  aria-label="کاهش تعداد"
                  onClick={() => setQuantity(lineKeyFor(item.id), cartQuantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-cocoa-700 shadow-sm transition active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-5 text-center text-sm font-bold text-cocoa-900">
                  {cartQuantity.toLocaleString("fa-IR")}
                </span>
                <button
                  type="button"
                  aria-label="افزایش تعداد"
                  disabled={atMax || isUnorderable}
                  onClick={() => addToCart(item)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-cocoa-700 shadow-sm transition active:scale-95 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label={`افزودن ${item.title}`}
                onClick={handleAddClick}
                disabled={outOfStock || atMax || isUnorderable}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-400 text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {variantModalOpen && (
          <CartVariantModal
            item={item}
            categoryTitle={categoryTitle}
            onClose={() => setVariantModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

export default ProductModal;
