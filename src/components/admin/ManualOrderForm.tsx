"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Minus, Plus, Trash2, UserPlus } from "lucide-react";
import {
  ApiError,
  adminCreateCustomer,
  adminCreateOrder,
  adminGetOrder,
  adminUpdateOrder,
  adminGetCustomer,
  adminGetCustomerUsableDiscountCodes,
  adminGetCustomers,
  adminGetProducts,
  adminGetStockCandidates,
  type AdminCreateOrderPayload,
} from "@/lib/api";
import type { AdminCustomer, AdminDiscountCode, AdminProduct } from "@/types/admin";
import { normalizeDigits, PHONE_REGEX } from "@/utils/phone";
import { digitsOnly, formatThousands } from "@/lib/formatNumber";
import { getDiscountedPrice } from "@/config/siteConfig";

interface OrderLine {
  key: string;
  /** Empty for a line whose catalog product no longer exists — it's re-sent with its recorded title/price. */
  productId: string;
  variantId?: string;
  title: string;
  variantTitle?: string;
  /** Unit price for an instant order and for a preorder — a product's preorder discount can differ from its regular one. */
  instantUnitPrice: number;
  preorderUnitPrice: number;
  quantity: number;
  maxStock?: number | null;
  /** Shared by a parent product and its dependents — together their lines can't exceed the one stock pool. */
  stockGroupId?: string;
  pickupOnly: boolean;
  /** Set on lines carried over from the order being edited, so saving keeps their recorded price. */
  fixedPrice?: number;
}

/** Mirrors the server: a preorderable product's preorder discount (when set) replaces its regular discount on preorders. */
function discountPercentFor(product: AdminProduct, isPreorder: boolean): number | undefined {
  if (isPreorder && product.allowPreorder && product.preorderDiscountPercent != null) {
    return product.preorderDiscountPercent;
  }
  return product.discountPercent ?? undefined;
}

function money(n: number) {
  return `${n.toLocaleString("fa-IR")} تومان`;
}

/** Must match the generic line the server creates for a "total only" order. */
const GENERIC_ITEM_TITLE = "اقلام سفارش (بدون جزئیات)";

/** Create form for a manual order, or — given an `orderId` — the edit form for an existing one. */
function ManualOrderFormInner({ orderId }: { orderId?: string }) {
  const isEdit = !!orderId;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<AdminCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomer | null>(null);

  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<AdminProduct[]>([]);
  const [items, setItems] = useState<OrderLine[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualSubtotal, setManualSubtotal] = useState("");
  // Preorder mode: stock stops being a concern entirely — any product/quantity
  // can be added, and the order never decrements stock (mirrors how customer
  // preorders already work).
  const [isPreorder, setIsPreorder] = useState(false);
  // productId -> stock group id, for products linked through a parent/dependent stock relation.
  const [stockGroups, setStockGroups] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    adminGetStockCandidates()
      .then((all) =>
        setStockGroups(
          new Map(
            all.flatMap((c): [string, string][] => {
              const groupId = c.stockSourceId ?? (c.dependentCount > 0 ? c.id : null);
              return groupId ? [[c.id, groupId]] : [];
            }),
          ),
        ),
      )
      .catch(() => {
        // Without it the server still enforces the shared stock when the order is saved.
      });
  }, []);

  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("pickup");
  const [addressId, setAddressId] = useState("");
  const [addressText, setAddressText] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [walletMode, setWalletMode] = useState<"full" | "partial">("full");
  const [walletAmount, setWalletAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">("paid");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(isEdit);
  // Wallet money this order already holds — it is refunded when the edit is saved,
  // so it counts as available again while editing.
  const [heldWallet, setHeldWallet] = useState(0);
  // This order's own unspent cashback — clawed back on save, so it isn't spendable here.
  const [heldCashback, setHeldCashback] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const order = await adminGetOrder(orderId);
        if (cancelled) return;
        if (order.source !== "admin") {
          setError("فقط سفارش‌های دستی قابل ویرایش هستند");
          return;
        }
        if (order.status === "cancelled") {
          setError("سفارش لغو شده قابل ویرایش نیست");
          return;
        }
        if (!order.customerId) {
          setError("مشتری این سفارش دیگر وجود ندارد");
          return;
        }
        const customer = await adminGetCustomer(order.customerId);
        if (cancelled) return;
        setSelectedCustomer(customer);
        setCustomerDetail(customer);
        setHeldWallet(order.walletAmountUsed);
        setHeldCashback(order.walletCashbackRemaining ?? 0);

        const preorder = order.orderType === "preorder";
        setIsPreorder(preorder);
        if (order.items.length === 1 && !order.items[0].productId && order.items[0].title === GENERIC_ITEM_TITLE) {
          setManualMode(true);
          setManualSubtotal(String(order.items[0].price));
        } else {
          setItems(
            order.items.map((i, idx) => ({
              key: i.id ?? String(idx),
              productId: i.productId ?? "",
              variantId: i.variantId ?? undefined,
              title: i.title,
              variantTitle: i.variantTitle ?? undefined,
              instantUnitPrice: i.price,
              preorderUnitPrice: i.price,
              quantity: i.quantity,
              maxStock: null,
              pickupOnly: false,
              fixedPrice: i.price,
            })),
          );
        }

        setDeliveryMethod(order.deliveryMethod);
        if (order.deliveryMethod === "delivery") {
          if (order.addressId) {
            setAddressId(order.addressId);
          } else {
            setAddressText(order.addressText ?? "");
            setShippingCost(order.shippingCost ? String(order.shippingCost) : "");
          }
        }
        setDiscountCode(order.discountCode ?? "");
        if (order.walletAmountUsed > 0) {
          setUseWallet(true);
          setWalletMode("partial");
          setWalletAmount(String(order.walletAmountUsed));
        }
        setPaymentStatus(order.paymentStatus === "paid" ? "paid" : "pending");
        setNote(order.note ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "خطا در بارگذاری سفارش");
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Codes still redeemable for this customer (their personal ones and general ones), offered as one-click picks.
  const [customerCodes, setCustomerCodes] = useState<AdminDiscountCode[]>([]);
  const selectedCustomerId = selectedCustomer?.id;
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerCodes([]);
      return;
    }
    let cancelled = false;
    adminGetCustomerUsableDiscountCodes(selectedCustomerId)
      .then((res) => {
        if (!cancelled) setCustomerCodes(res.items);
      })
      .catch(() => {
        if (!cancelled) setCustomerCodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  const walletBalance = customerDetail ? Math.max(0, customerDetail.walletBalance + heldWallet - heldCashback) : 0;

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      adminGetCustomers(1, 8, customerSearch).then((res) => setCustomerResults(res.items));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      adminGetProducts(1, 8, productSearch, "", undefined, true).then((res) =>
        setProductResults(res.items),
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const selectCustomer = async (customer: AdminCustomer) => {
    setSelectedCustomer(customer);
    setCustomerResults([]);
    setCustomerSearch("");
    setCustomerDetail(null);
    setAddressId("");
    setUseWallet(false);
    const full = await adminGetCustomer(customer.id);
    setCustomerDetail(full);
  };

  // Deep-linked from the customers table's "ثبت سفارش دستی" row action
  // ("?customerId=...") — pre-selects that customer instead of making the
  // admin search for them again.
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (!customerId || isEdit) return;
    adminGetCustomer(customerId).then(selectCustomer).catch(() => {});
  }, [searchParams, isEdit]);

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerDetail(null);
    setAddressId("");
    setUseWallet(false);
  };

  const handleCreateCustomer = async () => {
    setCustomerError(null);
    const phone = normalizeDigits(newPhone);
    if (!PHONE_REGEX.test(phone)) {
      setCustomerError("شماره موبایل معتبر نیست");
      return;
    }
    setCreatingCustomer(true);
    try {
      const customer = await adminCreateCustomer({ phone, firstName: newName.trim() || undefined });
      await selectCustomer(customer);
      setNewPhone("");
      setNewName("");
    } catch (err) {
      setCustomerError(err instanceof ApiError ? err.message : "خطا در ثبت مشتری");
    } finally {
      setCreatingCustomer(false);
    }
  };

  // Out-of-stock products still show up in search (so the admin isn't
  // confused about why they're missing) but can't actually be added — and a
  // product that does have stock can't be ordered past it. Both search
  // buttons and the "+" stepper enforce the same maxStock cap. In preorder
  // mode none of this applies — stock is not a concern at all.
  const unitPriceOf = (line: OrderLine) =>
    line.fixedPrice ?? (isPreorder ? line.preorderUnitPrice : line.instantUnitPrice);

  /** The stock a product/variant draws on. A stock-group member always uses the product's own (shared pool) stock. */
  const stockOf = (product: AdminProduct, variant?: AdminProduct["variants"][number]) =>
    variant && !stockGroups.has(product.id) ? variant.stock : product.stock;

  /** Units already placed on lines of the given stock group (or just the one line when it has no group). */
  const heldInGroup = (lines: OrderLine[], groupId: string | undefined, key: string) =>
    lines
      .filter((i) => (groupId ? i.stockGroupId === groupId : i.key === key))
      .reduce((sum, i) => sum + i.quantity, 0);

  const isSoldOut = (product: AdminProduct, variant?: AdminProduct["variants"][number]) => {
    const stock = stockOf(product, variant);
    if (stock == null) return false;
    const key = variant ? `${product.id}:${variant.id}` : product.id;
    return stock <= 0 || heldInGroup(items, stockGroups.get(product.id), key) >= stock;
  };

  const addLine = (product: AdminProduct, variant?: AdminProduct["variants"][number]) => {
    const key = variant ? `${product.id}:${variant.id}` : product.id;
    const maxStock = stockOf(product, variant);
    const stockGroupId = stockGroups.get(product.id);
    if (!isPreorder && maxStock != null && maxStock <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        if (!isPreorder && maxStock != null && heldInGroup(prev, stockGroupId, key) >= maxStock) return prev;
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      // A new line joins a group that may already be using up the shared pool.
      if (!isPreorder && maxStock != null && heldInGroup(prev, stockGroupId, key) >= maxStock) return prev;
      const basePrice = variant ? variant.price : product.price;
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant?.id,
          title: product.title,
          variantTitle: variant?.title,
          instantUnitPrice: getDiscountedPrice(basePrice, discountPercentFor(product, false)),
          preorderUnitPrice: getDiscountedPrice(basePrice, discountPercentFor(product, true)),
          quantity: 1,
          maxStock,
          stockGroupId,
          pickupOnly: product.pickupOnly,
        },
      ];
    });
    setProductSearch("");
    setProductResults([]);
  };

  /** True when the line can't take one more unit: its own stock, or its whole stock group's, is used up. */
  const lineAtMax = (lines: OrderLine[], line: OrderLine) =>
    !isPreorder &&
    line.maxStock != null &&
    heldInGroup(lines, line.stockGroupId, line.key) >= line.maxStock;

  const updateQuantity = (key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          if (delta > 0 && lineAtMax(prev, i)) return i;
          return { ...i, quantity: i.quantity + delta };
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const subtotal = manualMode
    ? Number(manualSubtotal) || 0
    : items.reduce((sum, i) => sum + unitPriceOf(i) * i.quantity, 0);

  const handleSubmit = async () => {
    setError(null);
    if (!selectedCustomer) {
      setError("یک مشتری انتخاب کنید");
      return;
    }
    if (manualMode) {
      if (!manualSubtotal || Number(manualSubtotal) <= 0) {
        setError("جمع کل اقلام را وارد کنید");
        return;
      }
    } else if (items.length === 0) {
      setError("حداقل یک محصول اضافه کنید");
      return;
    }
    if (deliveryMethod === "delivery" && !manualMode) {
      const pickupOnlyItems = items.filter((i) => i.pickupOnly);
      if (pickupOnlyItems.length > 0) {
        const names = pickupOnlyItems.map((i) => `«${i.title}»`).join("، ");
        const verb = pickupOnlyItems.length > 1 ? "هستند" : "است";
        setError(`${names} فقط با تحویل حضوری قابل سفارش ${verb}`);
        return;
      }
    }
    if (deliveryMethod === "delivery" && !addressId && !addressText.trim()) {
      setError("برای ارسال، یک آدرس (ثبت‌شده یا دستی) مشخص کنید");
      return;
    }
    let walletAmountToUse: number | undefined;
    if (useWallet && customerDetail) {
      if (walletMode === "full") {
        walletAmountToUse = walletBalance;
      } else {
        const entered = Number(walletAmount);
        if (!walletAmount || entered <= 0) {
          setError("مبلغی که می‌خوای از کیف پول استفاده بشه را وارد کن");
          return;
        }
        if (entered > walletBalance) {
          setError("مبلغ وارد شده از موجودی کیف پول مشتری بیشتر است");
          return;
        }
        walletAmountToUse = entered;
      }
    }
    setSubmitting(true);
    try {
      const payload: AdminCreateOrderPayload = {
        customerId: selectedCustomer.id,
        ...(manualMode
          ? { manualSubtotal: Number(manualSubtotal) }
          : {
              items: items.map((i) => ({
                productId: i.productId || undefined,
                variantId: i.variantId,
                quantity: i.quantity,
                unitPrice: i.fixedPrice,
                // Only needed for a line with no catalog product.
                title: i.productId ? undefined : i.title,
                variantTitle: i.productId ? undefined : i.variantTitle,
              })),
            }),
        deliveryMethod,
        addressId: deliveryMethod === "delivery" && addressId ? addressId : undefined,
        addressText: deliveryMethod === "delivery" && !addressId ? addressText.trim() : undefined,
        shippingCost: shippingCost ? Number(shippingCost) : undefined,
        discountCode: discountCode.trim() || undefined,
        walletAmount: walletAmountToUse,
        paymentStatus,
        note: note.trim() || undefined,
        orderType: isPreorder ? "preorder" : "instant",
      };
      if (orderId) {
        await adminUpdateOrder(orderId, payload);
      } else {
        await adminCreateOrder(payload);
      }
      router.push("/admin/orders");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : isEdit ? "خطا در ویرایش سفارش" : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOrder) {
    return <p className="text-sm text-cocoa-500">در حال بارگذاری سفارش…</p>;
  }
  if (isEdit && !selectedCustomer) {
    return (
      <div className="max-w-6xl">
        <p className="text-sm font-semibold text-danger-500">{error ?? "سفارش یافت نشد"}</p>
        <Link href="/admin/orders" className="mt-3 inline-block text-xs font-semibold text-cocoa-500 hover:text-cocoa-900">
          بازگشت به سفارش‌ها
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-cocoa-900">
          {isEdit ? "ویرایش سفارش دستی" : "ثبت سفارش دستی"}
        </h1>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-500 hover:text-cocoa-900"
        >
          بازگشت به سفارش‌ها
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-2">

      {/* Customer */}
      <div className="rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <h2 className="text-sm font-bold text-cocoa-900">مشتری</h2>

        {selectedCustomer ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-sand-50/60 p-3">
            <div>
              <p className="text-sm font-semibold text-cocoa-900">
                {[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(" ") ||
                  "بدون نام"}
              </p>
              <p className="mt-1 text-xs text-cocoa-500">
                {selectedCustomer.phone}
              </p>
              {customerDetail && (
                <p className="mt-1 text-xs font-semibold text-sand-500">
                  موجودی کیف پول: {money(walletBalance)}
                </p>
              )}
            </div>
            {!isEdit && (
              <button
                type="button"
                onClick={clearCustomer}
                className="rounded-full border border-cocoa-900/10 px-3 py-1.5 text-xs font-semibold text-cocoa-700 hover:bg-white"
              >
                تغییر مشتری
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="جستجو بر اساس نام یا موبایل…"
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {customerResults.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="flex items-center justify-between rounded-xl border border-cocoa-900/10 px-3 py-2 text-right text-sm hover:bg-sand-50"
                  >
                    <span>{[c.firstName, c.lastName].filter(Boolean).join(" ") || "بدون نام"}</span>
                    <span dir="ltr" className="text-xs text-cocoa-500">
                      {c.phone}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="my-4 h-px bg-cocoa-900/10" />

            <p className="mb-2 text-xs font-semibold text-cocoa-600">یا یک مشتری جدید بساز:</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <input
                  type="text"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(normalizeDigits(e.target.value))}
                  placeholder="09xxxxxxxxx"
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="نام (اختیاری)"
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={creatingCustomer}
                className="flex items-center gap-1.5 rounded-full bg-sand-500 px-4 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {creatingCustomer ? "در حال ثبت…" : "ساخت و انتخاب"}
              </button>
            </div>
            {customerError && (
              <p className="mt-2 text-xs font-semibold text-danger-500">{customerError}</p>
            )}
          </div>
        )}
      </div>

      {/* Products */}
      <div className="rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-cocoa-900">محصولات</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                setManualSubtotal("");
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                !manualMode ? "bg-sand-500 text-white" : "border border-cocoa-900/10 text-cocoa-700"
              }`}
            >
              افزودن محصول به محصول
            </button>
            <button
              type="button"
              onClick={() => {
                setManualMode(true);
                setItems([]);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                manualMode ? "bg-sand-500 text-white" : "border border-cocoa-900/10 text-cocoa-700"
              }`}
            >
              فقط جمع کل اقلام
            </button>
          </div>
        </div>

        {!manualMode && (
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-cocoa-600">
            <input
              type="checkbox"
              checked={isPreorder}
              onChange={(e) => setIsPreorder(e.target.checked)}
              className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
            />
            پیش‌سفارش (بدون بررسی موجودی — هر محصول و هر تعدادی قابل انتخاب است)
          </label>
        )}

        {manualMode ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              جمع کل اقلام (تومان)
            </label>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={formatThousands(manualSubtotal)}
              onChange={(e) => setManualSubtotal(digitsOnly(e.target.value))}
              placeholder="0"
              className="w-full max-w-xs rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            <p className="mt-1.5 text-xs text-cocoa-500">
              بدون انتخاب تک‌تک محصولات — یک قلم عمومی با همین مبلغ در سفارش ثبت می‌شود. مالیات و
              تخفیف طبق معمول روی همین مبلغ حساب می‌شود.
            </p>
          </div>
        ) : (
          <>
        <input
          type="text"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="جستجوی محصول…"
          className="mt-3 w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
        />
        {productResults.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {productResults.map((product) =>
              product.variants.length > 0
                ? product.variants.map((variant) => (
                      <button
                        key={`${product.id}:${variant.id}`}
                        type="button"
                        onClick={() => addLine(product, variant)}
                        disabled={!isPreorder && isSoldOut(product, variant)}
                        className="flex items-center justify-between rounded-xl border border-cocoa-900/10 px-3 py-2 text-right text-sm hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <span>
                          {product.title} — {variant.title}
                          {product.pickupOnly && (
                            <span className="mr-1.5 text-xs font-semibold text-cocoa-500">
                              (فقط حضوری)
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-semibold text-cocoa-600">
                          {money(getDiscountedPrice(variant.price, discountPercentFor(product, isPreorder)))}
                          {variant.stock != null && ` (موجودی: ${variant.stock.toLocaleString("fa-IR")})`}
                        </span>
                      </button>
                    ))
                : (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addLine(product)}
                      disabled={!isPreorder && isSoldOut(product)}
                      className="flex items-center justify-between rounded-xl border border-cocoa-900/10 px-3 py-2 text-right text-sm hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span>
                        {product.title}
                        {product.pickupOnly && (
                          <span className="mr-1.5 text-xs font-semibold text-cocoa-500">
                            (فقط حضوری)
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-semibold text-cocoa-600">
                        {money(getDiscountedPrice(product.price, discountPercentFor(product, isPreorder)))}
                        {product.stock != null && ` (موجودی: ${product.stock.toLocaleString("fa-IR")})`}
                      </span>
                    </button>
                  ),
            )}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-xl bg-sand-50/60 p-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-cocoa-900">
                    {item.title}
                    {item.variantTitle ? ` — ${item.variantTitle}` : ""}
                  </p>
                  <p className="text-xs text-cocoa-500">{money(unitPriceOf(item))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.key, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cocoa-900/10 hover:bg-white"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">
                    {item.quantity.toLocaleString("fa-IR")}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.key, 1)}
                    disabled={lineAtMax(items, item)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cocoa-900/10 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="w-24 text-left text-sm font-bold text-cocoa-900">
                    {money(unitPriceOf(item) * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-danger-500 hover:bg-danger-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between text-sm font-bold text-cocoa-900">
              <span>جمع اقلام</span>
              <span>{money(subtotal)}</span>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-3">

      {/* Delivery */}
      <div className="rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <h2 className="text-sm font-bold text-cocoa-900">تحویل</h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMethod("pickup")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              deliveryMethod === "pickup"
                ? "bg-sand-500 text-white"
                : "border border-cocoa-900/10 text-cocoa-700"
            }`}
          >
            مراجعه حضوری
          </button>
          <button
            type="button"
            onClick={() => setDeliveryMethod("delivery")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              deliveryMethod === "delivery"
                ? "bg-sand-500 text-white"
                : "border border-cocoa-900/10 text-cocoa-700"
            }`}
          >
            ارسال
          </button>
        </div>

        {deliveryMethod === "delivery" && (
          <div className="mt-3 flex flex-col gap-3">
            {customerDetail?.addresses && customerDetail.addresses.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                  آدرس ثبت‌شده‌ی مشتری
                </label>
                <select
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                >
                  <option value="">— انتخاب کنید —</option>
                  {customerDetail.addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {[addr.title, addr.address].filter(Boolean).join(" — ")}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-cocoa-500">
                  هزینه‌ی ارسال برای آدرس ثبت‌شده به‌صورت خودکار محاسبه می‌شود.
                </p>
              </div>
            )}

            {!addressId && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                  یا آدرس دستی
                </label>
                <textarea
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
                <label className="mb-1 mt-2 block text-xs font-semibold text-cocoa-600">
                  هزینه‌ی ارسال (تومان)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discount + wallet */}
      <div className="rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <h2 className="text-sm font-bold text-cocoa-900">تخفیف و کیف پول</h2>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-cocoa-600">کد تخفیف</label>
          <input
            type="text"
            dir="ltr"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            className="w-full max-w-xs rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
          />
          {customerCodes.length > 0 && (
            <div className="mt-2">
              <p className="mb-1.5 text-xs font-semibold text-cocoa-600">
                کدهای تخفیف فعال قابل استفاده (برای انتخاب کلیک کنید):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {customerCodes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDiscountCode(discountCode === c.code ? "" : c.code)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      discountCode === c.code
                        ? "bg-sand-500 text-white"
                        : "border border-cocoa-900/10 text-cocoa-700 hover:bg-sand-50"
                    }`}
                  >
                    <span dir="ltr" className="font-mono">
                      {c.code}
                    </span>{" "}
                    — {c.percent.toLocaleString("fa-IR")}٪{" "}
                    <span className="font-semibold opacity-70">
                      ({c.customerId ? "اختصاصی" : "عمومی"})
                    </span>
                    {c.expiresAt &&
                      ` (تا ${new Date(c.expiresAt).toLocaleDateString("fa-IR")})`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-cocoa-700">
          <input
            type="checkbox"
            checked={useWallet}
            disabled={!customerDetail || walletBalance <= 0}
            onChange={(e) => setUseWallet(e.target.checked)}
            className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
          />
          استفاده از موجودی کیف پول مشتری
          {customerDetail && walletBalance > 0 && (
            <span className="text-xs text-cocoa-500">
              (موجودی: {money(walletBalance)})
            </span>
          )}
        </label>

        {useWallet && customerDetail && walletBalance > 0 && (
          <div className="mt-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWalletMode("full")}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  walletMode === "full"
                    ? "bg-sand-500 text-white"
                    : "border border-cocoa-900/10 text-cocoa-700"
                }`}
              >
                استفاده از کل موجودی
              </button>
              <button
                type="button"
                onClick={() => setWalletMode("partial")}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  walletMode === "partial"
                    ? "bg-sand-500 text-white"
                    : "border border-cocoa-900/10 text-cocoa-700"
                }`}
              >
                استفاده از بخشی از آن
              </button>
            </div>
            {walletMode === "partial" && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                  مبلغ مصرفی از کیف پول (تومان)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={formatThousands(walletAmount)}
                  onChange={(e) => setWalletAmount(digitsOnly(e.target.value))}
                  placeholder="0"
                  className="w-full max-w-xs rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
                <p className="mt-1.5 text-xs text-cocoa-500">
                  حداکثر {money(walletBalance)} — باقی‌مانده در کیف پول مشتری می‌ماند.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment status + note */}
      <div className="rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <h2 className="text-sm font-bold text-cocoa-900">وضعیت پرداخت</h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentStatus("pending")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              paymentStatus === "pending"
                ? "bg-sand-500 text-white"
                : "border border-cocoa-900/10 text-cocoa-700"
            }`}
          >
            پرداخت‌نشده
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus("paid")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              paymentStatus === "paid"
                ? "bg-sand-500 text-white"
                : "border border-cocoa-900/10 text-cocoa-700"
            }`}
          >
            پرداخت‌شده (نقدی/حضوری)
          </button>
        </div>
        <p className="mt-2 text-xs text-cocoa-500">
          توجه: پاداش کیف پول این سفارش فقط زمانی به حساب مشتری اضافه می‌شود که وضعیت سفارش
          هم «تحویل داده شده» و هم «پرداخت‌شده» باشد. اگر الان وضعیت پرداخت را «پرداخت‌نشده»
          می‌گذاری، بعداً از صفحه‌ی سفارش‌ها باید آن را به «پرداخت‌شده» تغییر بدهی تا پاداش
          محاسبه شود.
        </p>

        <label className="mb-1 mt-4 block text-xs font-semibold text-cocoa-600">
          یادداشت (اختیاری)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
        />
      </div>

      </div>

      {error && <p className="mt-4 text-xs font-semibold text-danger-500">{error}</p>}

      <div className="mt-4 flex justify-start">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-sand-500 px-4 py-2 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {submitting
            ? isEdit
              ? "در حال ذخیره…"
              : "در حال ثبت سفارش…"
            : isEdit
              ? "ذخیره تغییرات"
              : "ثبت سفارش"}
        </button>
      </div>
    </div>
  );
}

export default function ManualOrderForm({ orderId }: { orderId?: string }) {
  return (
    <Suspense fallback={null}>
      <ManualOrderFormInner orderId={orderId} />
    </Suspense>
  );
}
