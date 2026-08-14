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

const STORAGE_KEY = "flourish-cart";
const TAX_RATE = 0.1;

const lineKeyFor = (itemId: string, variantId?: string) =>
  variantId ? `${itemId}:${variantId}` : itemId;

function loadInitialLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, openAuth } = useAuth();
  const [lines, setLines] = useState<CartLine[]>(loadInitialLines);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

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
    const basePrice = variant ? variant.price : item.price;
    const price = getDiscountedPrice(basePrice, item.discountPercent);
    const maxQuantity = variant ? variant.stock : item.stock;

    setLines((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        const nextQuantity =
          maxQuantity !== undefined
            ? Math.min(existing.quantity + quantity, maxQuantity)
            : existing.quantity + quantity;
        return prev.map((line) =>
          line.key === key ? { ...line, quantity: nextQuantity } : line,
        );
      }

      const initialQuantity =
        maxQuantity !== undefined ? Math.min(quantity, maxQuantity) : quantity;
      if (initialQuantity <= 0) return prev;

      const newLine: CartLine = {
        key,
        itemId: item.id,
        variantId: variant?.id,
        title: item.title,
        variantTitle: variant?.title,
        price,
        image: variant?.image || item.images[0],
        quantity: initialQuantity,
        maxQuantity,
      };
      return [...prev, newLine];
    });

    return true;
  };

  const setQuantity = (key: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((line) => line.key !== key);
      return prev.map((line) =>
        line.key === key
          ? {
              ...line,
              quantity:
                line.maxQuantity !== undefined
                  ? Math.min(quantity, line.maxQuantity)
                  : quantity,
            }
          : line,
      );
    });
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key));
  };

  const clearCart = () => setLines([]);

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
