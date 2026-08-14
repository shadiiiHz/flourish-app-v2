"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDiscountedPrice, type MenuItem, type MenuItemVariant } from "../config/siteConfig";
import { useAuth } from "./AuthContext";
import {
  addMyCartItem,
  clearMyCart,
  getMyCart,
  removeMyCartItem,
  updateMyCartItem,
  type ApiCartItem,
} from "../lib/api";

export interface CartLine {
  key: string;
  itemId: string;
  variantId?: string;
  title: string;
  variantTitle?: string;
  price: number;
  image?: string;
  quantity: number;
  maxQuantity?: number;
}

interface CartLineInternal extends CartLine {
  /** The server-side CartItem id; a synthetic placeholder until the initial add-to-cart request resolves. */
  cartItemId: string;
}

interface CartContextValue {
  lines: CartLine[];
  totalCount: number;
  totalPrice: number;
  taxAmount: number;
  grandTotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  lineKeyFor: (itemId: string, variantId?: string) => string;
  getQuantity: (itemId: string, variantId?: string) => number;
  addToCart: (item: MenuItem, variant?: MenuItemVariant, quantity?: number) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  toast: string | null;
  notify: (message: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const TAX_RATE = 0.1;

const lineKeyFor = (itemId: string, variantId?: string) =>
  variantId ? `${itemId}:${variantId}` : itemId;

function mapApiCartItem(item: ApiCartItem): CartLineInternal {
  return {
    key: lineKeyFor(item.productId, item.variantId ?? undefined),
    cartItemId: item.id,
    itemId: item.productId,
    variantId: item.variantId ?? undefined,
    title: item.title,
    variantTitle: item.variantTitle ?? undefined,
    price: item.price,
    image: item.image ?? undefined,
    quantity: item.quantity,
    maxQuantity: item.maxQuantity ?? undefined,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, openAuth } = useAuth();
  const [lines, setLines] = useState<CartLineInternal[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLines([]);
      return;
    }
    getMyCart()
      .then((items) => setLines(items.map(mapApiCartItem)))
      .catch(() => setLines([]));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);

  const getQuantity = (itemId: string, variantId?: string) => {
    const key = lineKeyFor(itemId, variantId);
    return lines.find((line) => line.key === key)?.quantity ?? 0;
  };

  const addToCart = (item: MenuItem, variant?: MenuItemVariant, quantity = 1) => {
    if (!isAuthenticated) {
      openAuth();
      return false;
    }

    const key = lineKeyFor(item.id, variant?.id);
    const maxQuantity = variant ? variant.stock : item.stock;
    const existing = lines.find((line) => line.key === key);

    if (existing) {
      const nextQuantity =
        maxQuantity !== undefined
          ? Math.min(existing.quantity + quantity, maxQuantity)
          : existing.quantity + quantity;
      setLines((prev) =>
        prev.map((line) => (line.key === key ? { ...line, quantity: nextQuantity } : line)),
      );
      updateMyCartItem(existing.cartItemId, nextQuantity).catch(() => {
        notify("بروزرسانی سبد خرید با خطا مواجه شد");
      });
      return true;
    }

    const initialQuantity = maxQuantity !== undefined ? Math.min(quantity, maxQuantity) : quantity;
    if (initialQuantity <= 0) return true;

    const basePrice = variant ? variant.price : item.price;
    const price = getDiscountedPrice(basePrice, item.discountPercent);
    const optimisticId = `pending-${key}`;
    setLines((prev) => [
      ...prev,
      {
        key,
        cartItemId: optimisticId,
        itemId: item.id,
        variantId: variant?.id,
        title: item.title,
        variantTitle: variant?.title,
        price,
        image: variant?.image || item.images[0],
        quantity: initialQuantity,
        maxQuantity,
      },
    ]);
    addMyCartItem({ productId: item.id, variantId: variant?.id, quantity: initialQuantity })
      .then((created) => {
        setLines((prev) => prev.map((line) => (line.key === key ? mapApiCartItem(created) : line)));
      })
      .catch(() => {
        notify("افزودن به سبد خرید با خطا مواجه شد");
        setLines((prev) => prev.filter((line) => line.cartItemId !== optimisticId));
      });

    return true;
  };

  const setQuantity = (key: string, quantity: number) => {
    const existing = lines.find((line) => line.key === key);
    if (!existing) return;

    if (quantity <= 0) {
      setLines((prev) => prev.filter((line) => line.key !== key));
      removeMyCartItem(existing.cartItemId).catch(() => {
        notify("حذف از سبد خرید با خطا مواجه شد");
      });
      return;
    }

    const nextQuantity =
      existing.maxQuantity !== undefined ? Math.min(quantity, existing.maxQuantity) : quantity;
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: nextQuantity } : line)),
    );
    updateMyCartItem(existing.cartItemId, nextQuantity).catch(() => {
      notify("بروزرسانی سبد خرید با خطا مواجه شد");
    });
  };

  const removeLine = (key: string) => {
    const existing = lines.find((line) => line.key === key);
    if (!existing) return;
    setLines((prev) => prev.filter((line) => line.key !== key));
    removeMyCartItem(existing.cartItemId).catch(() => {
      notify("حذف از سبد خرید با خطا مواجه شد");
    });
  };

  const clearCart = () => {
    setLines([]);
    clearMyCart().catch(() => {
      // best-effort — local state is already cleared
    });
  };

  const totalCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );
  const totalPrice = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.price, 0),
    [lines],
  );
  const taxAmount = useMemo(() => Math.round(totalPrice * TAX_RATE), [totalPrice]);
  const grandTotal = useMemo(() => totalPrice + taxAmount, [totalPrice, taxAmount]);

  const value: CartContextValue = {
    lines,
    totalCount,
    totalPrice,
    taxAmount,
    grandTotal,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    lineKeyFor,
    getQuantity,
    addToCart,
    setQuantity,
    removeLine,
    clearCart,
    toast,
    notify,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
