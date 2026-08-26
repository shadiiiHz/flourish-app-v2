"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Minus, Plus, Trash2, UserPlus } from "lucide-react";
import {
  ApiError,
  adminCreateCustomer,
  adminCreateOrder,
  adminGetCustomer,
  adminGetCustomers,
  adminGetProducts,
  type AdminCreateOrderPayload,
} from "@/lib/api";
import type { AdminCustomer, AdminProduct } from "@/types/admin";
import { normalizeDigits, PHONE_REGEX } from "@/utils/phone";

interface OrderLine {
  key: string;
  productId: string;
  variantId?: string;
  title: string;
  variantTitle?: string;
  unitPrice: number;
  quantity: number;
  maxStock?: number | null;
}

function money(n: number) {
  return `${n.toLocaleString("fa-IR")} تومان`;
}

function AdminNewOrderPage() {
  const router = useRouter();

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

  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("pickup");
  const [addressId, setAddressId] = useState("");
  const [addressText, setAddressText] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">("pending");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      adminGetProducts(1, 8, productSearch).then((res) => setProductResults(res.items));
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

  const addLine = (product: AdminProduct, variant?: AdminProduct["variants"][number]) => {
    const key = variant ? `${product.id}:${variant.id}` : product.id;
    const maxStock = variant ? variant.stock : product.stock;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        if (maxStock != null && existing.quantity >= maxStock) return prev;
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant?.id,
          title: product.title,
          variantTitle: variant?.title,
          unitPrice: variant ? variant.price : product.price,
          quantity: 1,
          maxStock,
        },
      ];
    });
    setProductSearch("");
    setProductResults([]);
  };

  const updateQuantity = (key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          if (delta > 0 && i.maxStock != null && i.quantity >= i.maxStock) return i;
          return { ...i, quantity: i.quantity + delta };
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const subtotal = manualMode
    ? Number(manualSubtotal) || 0
    : items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

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
    if (deliveryMethod === "delivery" && !addressId && !addressText.trim()) {
      setError("برای ارسال، یک آدرس (ثبت‌شده یا دستی) مشخص کنید");
      return;
    }
    setSubmitting(true);
    try {
      const payload: AdminCreateOrderPayload = {
        customerId: selectedCustomer.id,
        ...(manualMode
          ? { manualSubtotal: Number(manualSubtotal) }
          : {
              items: items.map((i) => ({
                productId: i.productId,
                variantId: i.variantId,
                quantity: i.quantity,
              })),
            }),
        deliveryMethod,
        addressId: deliveryMethod === "delivery" && addressId ? addressId : undefined,
        addressText: deliveryMethod === "delivery" && !addressId ? addressText.trim() : undefined,
        shippingCost: shippingCost ? Number(shippingCost) : undefined,
        discountCode: discountCode.trim() || undefined,
        useWallet,
        paymentStatus,
        note: note.trim() || undefined,
      };
      await adminCreateOrder(payload);
      router.push("/admin/orders");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-cocoa-900">ثبت سفارش دستی</h1>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-500 hover:text-cocoa-900"
        >
          بازگشت به سفارش‌ها
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Customer */}
      <div className="mt-5 rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <h2 className="text-sm font-bold text-cocoa-900">مشتری</h2>

        {selectedCustomer ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-sand-50/60 p-3">
            <div>
              <p className="text-sm font-semibold text-cocoa-900">
                {[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(" ") ||
                  "بدون نام"}
              </p>
              <p className="text-xs text-cocoa-500" dir="ltr">
                {selectedCustomer.phone}
              </p>
              {customerDetail && (
                <p className="mt-1 text-xs font-semibold text-sand-500">
                  موجودی کیف پول: {money(customerDetail.walletBalance)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearCustomer}
              className="rounded-full border border-cocoa-900/10 px-3 py-1.5 text-xs font-semibold text-cocoa-700 hover:bg-white"
            >
              تغییر مشتری
            </button>
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
      <div className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5">
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

        {manualMode ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              جمع کل اقلام (تومان)
            </label>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={manualSubtotal}
              onChange={(e) => setManualSubtotal(e.target.value.replace(/\D/g, ""))}
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
                ? product.variants
                    .filter((variant) => variant.stock !== 0)
                    .map((variant) => (
                      <button
                        key={`${product.id}:${variant.id}`}
                        type="button"
                        onClick={() => addLine(product, variant)}
                        className="flex items-center justify-between rounded-xl border border-cocoa-900/10 px-3 py-2 text-right text-sm hover:bg-sand-50"
                      >
                        <span>
                          {product.title} — {variant.title}
                        </span>
                        <span className="text-xs font-semibold text-cocoa-600">
                          {money(variant.price)}
                          {variant.stock != null && ` (موجودی: ${variant.stock.toLocaleString("fa-IR")})`}
                        </span>
                      </button>
                    ))
                : product.stock !== 0 && (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addLine(product)}
                      className="flex items-center justify-between rounded-xl border border-cocoa-900/10 px-3 py-2 text-right text-sm hover:bg-sand-50"
                    >
                      <span>{product.title}</span>
                      <span className="text-xs font-semibold text-cocoa-600">
                        {money(product.price)}
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
                  <p className="text-xs text-cocoa-500">{money(item.unitPrice)}</p>
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
                    disabled={item.maxStock != null && item.quantity >= item.maxStock}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cocoa-900/10 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="w-24 text-left text-sm font-bold text-cocoa-900">
                    {money(item.unitPrice * item.quantity)}
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

      {/* Delivery */}
      <div className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5">
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
      <div className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5">
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
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-cocoa-700">
          <input
            type="checkbox"
            checked={useWallet}
            disabled={!customerDetail || customerDetail.walletBalance <= 0}
            onChange={(e) => setUseWallet(e.target.checked)}
            className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
          />
          استفاده از موجودی کیف پول مشتری
          {customerDetail && customerDetail.walletBalance > 0 && (
            <span className="text-xs text-cocoa-500">
              (موجودی: {money(customerDetail.walletBalance)})
            </span>
          )}
        </label>
      </div>

      {/* Payment status + note */}
      <div className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5">
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

      {error && <p className="mt-4 text-xs font-semibold text-danger-500">{error}</p>}

      <div className="mt-4 flex justify-start">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-sand-500 px-4 py-2 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {submitting ? "در حال ثبت سفارش…" : "ثبت سفارش"}
        </button>
      </div>
    </div>
  );
}

export default AdminNewOrderPage;
