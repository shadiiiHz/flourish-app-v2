"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getDiscountedPrice, type MenuItem, type MenuItemVariant } from "../config/siteConfig";
import { useAuth } from "./AuthContext";
import { useOrderType } from "./OrderTypeContext";
import {
  addMyCartItem,
  apiUploadUrl,
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
  pickupOnly: boolean;
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
    image: item.image ? apiUploadUrl(item.image) : undefined,
    quantity: item.quantity,
    maxQuantity: item.maxQuantity ?? undefined,
    pickupOnly: item.pickupOnly,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, openAuth } = useAuth();
  const { orderType } = useOrderType();
  const [lines, setLines] = useState<CartLineInternal[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** In-flight add-to-cart requests, keyed by line key — lets later updates/removals wait
   *  for the real server-side CartItem id instead of hitting the optimistic placeholder. */
  const pendingCreatesRef = useRef<Map<string, Promise<ApiCartItem>>>(new Map());

  const resolveCartItemId = (key: string, cartItemId: string): Promise<string> => {
    const pending = pendingCreatesRef.current.get(key);
    return pending ? pending.then((created) => created.id) : Promise.resolve(cartItemId);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLines([]);
      return;
    }
    getMyCart(orderType)
      .then((items) => setLines(items.map(mapApiCartItem)))
      .catch(() => setLines([]));
  }, [isAuthenticated, orderType]);

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
    const unlimited = orderType === "preorder" && item.allowPreorder;
    const maxQuantity = unlimited ? undefined : variant ? variant.stock : item.stock;
    const existing = lines.find((line) => line.key === key);

    if (existing) {
      const nextQuantity =
        maxQuantity !== undefined
          ? Math.min(existing.quantity + quantity, maxQuantity)
          : existing.quantity + quantity;
      setLines((prev) =>
        prev.map((line) => (line.key === key ? { ...line, quantity: nextQuantity } : line)),
      );
      resolveCartItemId(key, existing.cartItemId)
        .then((id) => updateMyCartItem(id, nextQuantity, orderType))
        .catch(() => {
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
        pickupOnly: item.pickupOnly,
      },
    ]);
    const createPromise = addMyCartItem({
      productId: item.id,
      variantId: variant?.id,
      quantity: initialQuantity,
      orderType,
    })
      .then((created) => {
        // Keep whatever quantity is currently local — a click that landed while this
        // create was still in flight already bumped it (and queued its own PUT to
        // sync the server); only the id/price/etc. from the server response are new.
        setLines((prev) =>
          prev.map((line) =>
            line.key === key ? { ...mapApiCartItem(created), quantity: line.quantity } : line,
          ),
        );
        return created;
      })
      .catch((err) => {
        notify("افزودن به سبد خرید با خطا مواجه شد");
        setLines((prev) => prev.filter((line) => line.cartItemId !== optimisticId));
        throw err;
      })
      .finally(() => {
        pendingCreatesRef.current.delete(key);
      });
    pendingCreatesRef.current.set(key, createPromise);

    return true;
  };

  const setQuantity = (key: string, quantity: number) => {
    const existing = lines.find((line) => line.key === key);
    if (!existing) return;

    if (quantity <= 0) {
      setLines((prev) => prev.filter((line) => line.key !== key));
      resolveCartItemId(key, existing.cartItemId)
        .then((id) => removeMyCartItem(id))
        .catch(() => {
          notify("حذف از سبد خرید با خطا مواجه شد");
        });
      return;
    }

    const nextQuantity =
      existing.maxQuantity !== undefined ? Math.min(quantity, existing.maxQuantity) : quantity;
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: nextQuantity } : line)),
    );
    resolveCartItemId(key, existing.cartItemId)
      .then((id) => updateMyCartItem(id, nextQuantity, orderType))
      .catch(() => {
        notify("بروزرسانی سبد خرید با خطا مواجه شد");
      });
  };

  const removeLine = (key: string) => {
    const existing = lines.find((line) => line.key === key);
    if (!existing) return;
    setLines((prev) => prev.filter((line) => line.key !== key));
    resolveCartItemId(key, existing.cartItemId)
      .then((id) => removeMyCartItem(id))
      .catch(() => {
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
