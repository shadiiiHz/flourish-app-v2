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
import { getDiscountedPrice, getEffectiveDiscountPercent, type MenuItem, type MenuItemAddon, type MenuItemVariant } from "../config/siteConfig";
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
  /** Addons ticked for this line — each is its own priced row, billed once per unit of `quantity`. */
  addons: MenuItemAddon[];
  /** Unit price of the product itself, excluding addons. */
  price: number;
  image?: string;
  quantity: number;
  /** Units this line may hold. For lines in a shared stock group it already accounts for the group's other lines. */
  maxQuantity?: number;
  /** Shared by every product drawing on the same stock pool (a parent and its dependents). */
  stockGroupId?: string;
  /** The whole pool a grouped line draws on, before other lines' share is subtracted. */
  stockPool?: number;
  pickupOnly: boolean;
  allowPreorder: boolean;
  /** Weekdays (0=Sunday … 6=Saturday) this product can be preordered for. Empty means every day. */
  preorderWeekdays: number[];
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
  lineKeyFor: (itemId: string, variantId?: string, addons?: readonly { id: string }[]) => string;
  getQuantity: (itemId: string, variantId?: string, addons?: readonly { id: string }[]) => number;
  /** True when the item shares a stock pool with other products and the cart already holds all of it. */
  isGroupAtMax: (item: MenuItem) => boolean;
  addToCart: (
    item: MenuItem,
    variant?: MenuItemVariant,
    quantity?: number,
    addons?: MenuItemAddon[],
  ) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  toast: string | null;
  notify: (message: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const TAX_RATE = 0.1;

/** The same product + variant with a different set of addons is a separate cart line. */
const lineKeyFor = (itemId: string, variantId?: string, addons: readonly { id: string }[] = []) => {
  const base = variantId ? `${itemId}:${variantId}` : itemId;
  if (addons.length === 0) return base;
  return `${base}+${addons.map((a) => a.id).sort().join("+")}`;
};

function mapApiCartItem(item: ApiCartItem): CartLineInternal {
  return {
    key: lineKeyFor(item.productId, item.variantId ?? undefined, item.addons),
    cartItemId: item.id,
    itemId: item.productId,
    variantId: item.variantId ?? undefined,
    title: item.title,
    variantTitle: item.variantTitle ?? undefined,
    addons: item.addons ?? [],
    price: item.price,
    image: item.image ? apiUploadUrl(item.image) : undefined,
    quantity: item.quantity,
    maxQuantity: item.maxQuantity ?? undefined,
    stockGroupId: item.stockGroupId ?? undefined,
    stockPool: item.stockPool ?? undefined,
    pickupOnly: item.pickupOnly,
    allowPreorder: item.allowPreorder,
    preorderWeekdays: item.preorderWeekdays ?? [],
  };
}

/** Product price plus all its addons, for one unit. */
export const lineUnitTotal = (line: Pick<CartLine, "price" | "addons">) =>
  line.price + line.addons.reduce((sum, addon) => sum + addon.price, 0);

/** Total units the lines of one stock group hold, optionally leaving one line out. */
const groupQuantity = (lines: CartLine[], groupId: string, exceptKey?: string) =>
  lines
    .filter((line) => line.stockGroupId === groupId && line.key !== exceptKey)
    .reduce((sum, line) => sum + line.quantity, 0);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, openAuth } = useAuth();
  const { orderType } = useOrderType();
  const [rawLines, setLines] = useState<CartLineInternal[]>([]);
  // Lines in a stock group share one pool, so each one's limit shrinks as its group-mates grow.
  const lines = useMemo<CartLineInternal[]>(
    () =>
      rawLines.map((line) =>
        line.stockGroupId && line.stockPool !== undefined
          ? {
              ...line,
              maxQuantity: Math.max(
                0,
                line.stockPool - groupQuantity(rawLines, line.stockGroupId, line.key),
              ),
            }
          : line,
      ),
    [rawLines],
  );
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

  const isGroupAtMax = (item: MenuItem) => {
    if (!item.stockGroupId) return false;
    if (orderType === "preorder" && item.allowPreorder) return false;
    const pool = item.stock;
    return pool !== undefined && groupQuantity(lines, item.stockGroupId) >= pool;
  };

  const getQuantity = (itemId: string, variantId?: string, addons?: readonly { id: string }[]) => {
    const key = lineKeyFor(itemId, variantId, addons);
    return lines.find((line) => line.key === key)?.quantity ?? 0;
  };

  const addToCart = (
    item: MenuItem,
    variant?: MenuItemVariant,
    quantity = 1,
    addons: MenuItemAddon[] = [],
  ) => {
    if (!isAuthenticated) {
      openAuth();
      return false;
    }

    const key = lineKeyFor(item.id, variant?.id, addons);
    const unlimited = orderType === "preorder" && item.allowPreorder;
    // Members of a stock group draw on the product's shared pool, not on their (mirrored) variant stock.
    const stockPool = unlimited
      ? undefined
      : variant && !item.stockGroupId
        ? variant.stock
        : item.stock;
    // A product sharing a stock pool with others can only take what the group's other lines leave.
    const maxQuantity =
      stockPool !== undefined && item.stockGroupId
        ? Math.max(0, stockPool - groupQuantity(lines, item.stockGroupId, key))
        : stockPool;
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
    if (initialQuantity <= 0) {
      if (item.stockGroupId && maxQuantity === 0) notify("موجودی این محصول در سبد شما به سقف رسیده است");
      return true;
    }

    const basePrice = variant ? variant.price : item.price;
    const price = getDiscountedPrice(basePrice, getEffectiveDiscountPercent(item, orderType));
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
        addons,
        price,
        image: variant?.image || item.images[0],
        quantity: initialQuantity,
        maxQuantity,
        stockGroupId: item.stockGroupId,
        stockPool: item.stockGroupId ? stockPool : undefined,
        pickupOnly: item.pickupOnly,
        allowPreorder: item.allowPreorder,
        preorderWeekdays: item.preorderWeekdays,
      },
    ]);
    const createPromise = addMyCartItem({
      productId: item.id,
      variantId: variant?.id,
      addonIds: addons.length > 0 ? addons.map((a) => a.id) : undefined,
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
    () => lines.reduce((sum, line) => sum + line.quantity * lineUnitTotal(line), 0),
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
    isGroupAtMax,
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
