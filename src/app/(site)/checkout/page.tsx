"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, MapPin, Pencil, Plus, ShoppingBag, SquarePen, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useAddresses, type Address } from "@/context/AddressContext";
import { useOrderType } from "@/context/OrderTypeContext";
import { useSiteStatus } from "@/context/SiteStatusContext";
import { ApiError, createOrder, getShippingEstimate } from "@/lib/api";
import AddressModal from "@/components/AddressModal";
import Preloader from "@/components/Preloader";
import { formatPreorderDateLong } from "@/lib/preorder";

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-white/40 bg-white/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-7">
      {children}
    </div>
  );
}

function CheckoutPage() {
  const router = useRouter();
  const { lines, totalCount, totalPrice, taxAmount, closeCart } = useCart();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addresses, isLoading: addressesLoading, updateAddress } = useAddresses();
  const { orderType, preorder, openModal, setInstant } = useOrderType();
  const { siteClosed } = useSiteStatus();
  const blockedByClosure = siteClosed && orderType === "instant";

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [note, setNote] = useState("");

  const [shipping, setShipping] = useState<{ distanceKm: number; shippingCost: number } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    closeCart();
  }, [closeCart]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (lines.length === 0) router.replace("/menu");
  }, [lines.length, router]);

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
  }, [user]);

  useEffect(() => {
    if (addressesLoading || addresses.length === 0) return;
    if (selectedAddressId && addresses.some((a) => a.id === selectedAddressId)) return;
    setSelectedAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0].id);
  }, [addresses, addressesLoading, selectedAddressId]);

  useEffect(() => {
    if (!selectedAddressId) {
      setShipping(null);
      return;
    }
    setShippingLoading(true);
    setError(null);
    getShippingEstimate(selectedAddressId)
      .then(setShipping)
      .catch((err) => {
        setShipping(null);
        setError(err instanceof ApiError ? err.message : "خطا در محاسبه هزینه ارسال");
      })
      .finally(() => setShippingLoading(false));
  }, [selectedAddressId]);

  const grandTotal = useMemo(
    () => totalPrice + taxAmount + (shipping?.shippingCost ?? 0),
    [totalPrice, taxAmount, shipping],
  );

  const openNewAddressModal = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const openEditAddressModal = (item: Address) => {
    setEditingAddress(item);
    setIsModalOpen(true);
  };

  const selectAddress = (item: Address) => {
    setSelectedAddressId(item.id);
    if (!item.isDefault) {
      updateAddress(item.id, {
        address: item.address,
        details: item.details,
        phone: item.phone,
        title: item.title,
        lat: item.lat,
        lng: item.lng,
        isDefault: true,
      });
    }
  };

  const handleSubmit = async () => {
    if (blockedByClosure) {
      setError("امروز فلوریش تعطیل است و فقط ثبت پیش‌سفارش امکان‌پذیر است");
      return;
    }
    if (!selectedAddressId) {
      setError("لطفاً یک آدرس برای ارسال انتخاب کنید");
      return;
    }
    if (orderType === "preorder" && !preorder) {
      setError("لطفاً تاریخ و ساعت پیش‌سفارش را انتخاب کنید");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const customerName = [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;
      const { paymentUrl } = await createOrder({
        addressId: selectedAddressId,
        customerName,
        note: note.trim() || undefined,
        orderType,
        scheduledDate: orderType === "preorder" ? preorder?.date : undefined,
        scheduledTimeSlot: orderType === "preorder" ? preorder?.timeSlot : undefined,
      });
      setInstant();
      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ثبت سفارش با خطا مواجه شد");
      setSubmitting(false);
    }
  };

  if (authLoading || lines.length === 0) return <Preloader />;
  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-5xl px-3 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 font-display text-xl font-bold text-cocoa-900 sm:text-2xl">
        تکمیل سفارش
      </h1>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_320px] md:gap-6">
        <div className="flex flex-col gap-5">
          {orderType === "preorder" && preorder && (
            <GlassCard>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-sand-500">پیش‌سفارش</h2>
                <button
                  type="button"
                  onClick={openModal}
                  aria-label="ویرایش پیش‌سفارش"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 transition hover:bg-sand-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-7 text-cocoa-700">
                این سفارش در تاریخ {formatPreorderDateLong(preorder.date)} ساعت{" "}
                {preorder.timeSlot} آماده‌سازی و تحویل خواهد شد.
              </p>
            </GlassCard>
          )}

          <GlassCard>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cocoa-900">
                آدرس‌های من
                <MapPin className="h-5 w-5 text-sand-500" />
              </h2>
              <button
                type="button"
                onClick={openNewAddressModal}
                className="flex items-center gap-1.5 rounded-full bg-sand-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="h-4 w-4" />
                ثبت آدرس جدید
              </button>
            </div>

            {addressesLoading ? (
              <Preloader fullScreen={false} />
            ) : addresses.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-sand-500">
                آدرسی ثبت نشده است، لطفا آدرس خود را ثبت نمایید.
              </p>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                {addresses.map((item) => {
                  const isSelected = item.id === selectedAddressId;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectAddress(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectAddress(item);
                        }
                      }}
                      className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 text-right transition ${
                        isSelected ? "border-sand-400 bg-sand-50/60" : "border-sand-100 bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-cocoa-900">
                          {item.title || "بدون عنوان"}
                        </p>
                        <p className="mt-0.5 text-sm text-cocoa-700">
                          {item.address}
                          {item.details && ` — ${item.details}`}
                        </p>
                        {isSelected && (
                          <p className="mt-1 text-xs font-semibold text-sand-500">
                            {shippingLoading
                              ? "در حال محاسبه فاصله…"
                              : shipping
                                ? `این آدرس ${shipping.distanceKm.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلومتر با فلوریش فاصله دارد`
                                : null}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditAddressModal(item);
                          }}
                          className="mt-2 inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          ویرایش آدرس
                        </button>
                      </div>
                      <span
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? "border-sand-500 bg-sand-500" : "border-cocoa-900/20"
                        }`}
                      >
                        {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <AddressModal
              isOpen={isModalOpen}
              editingAddress={editingAddress}
              onClose={() => setIsModalOpen(false)}
            />
          </GlassCard>

          <GlassCard>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cocoa-900">
              مشخصات گیرنده
              <User className="h-5 w-5 text-sand-500" />
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="نام"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
              />
              <input
                type="text"
                placeholder="نام خانوادگی"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
              />
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cocoa-900">
              توضیحات
              <SquarePen className="h-5 w-5 text-sand-500" />
            </h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="توضیحات (اختیاری)"
              className="mt-4 w-full resize-none rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </GlassCard>
        </div>

        <div className="flex flex-col gap-5">
          <GlassCard>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-cocoa-600">
                  تعداد کل ({totalCount.toLocaleString("fa-IR")} کالا)
                </span>
                <span className="font-semibold text-cocoa-900">
                  {totalPrice.toLocaleString("fa-IR")} تومان
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cocoa-600">مالیات (۱۰٪)</span>
                <span className="font-semibold text-cocoa-900">
                  {taxAmount.toLocaleString("fa-IR")} تومان
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cocoa-600">هزینه ارسال</span>
                <span className="font-semibold text-cocoa-900">
                  {shippingLoading
                    ? "…"
                    : shipping
                      ? `${shipping.shippingCost.toLocaleString("fa-IR")} تومان`
                      : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-sand-50 pt-2.5">
                <span className="font-bold text-cocoa-700">جمع کل</span>
                <span className="text-lg font-bold text-cocoa-900">
                  {grandTotal.toLocaleString("fa-IR")} تومان
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className="text-sm font-bold text-cocoa-900">
                پرداخت آنلاین از طریق درگاه زرین‌پال
              </span>
            </div>
          </GlassCard>

          {blockedByClosure && (
            <div className="flex flex-col gap-2 rounded-2xl bg-danger-50 p-3 text-center text-xs font-semibold text-danger-500">
              امروز فلوریش تعطیل است و فقط ثبت پیش‌سفارش امکان‌پذیر است.
              <button
                type="button"
                onClick={openModal}
                className="rounded-full bg-danger-500 px-3 py-1.5 text-white transition hover:opacity-90"
              >
                تبدیل به پیش‌سفارش
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-danger-50 p-3 text-center text-xs font-semibold text-danger-500">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedAddressId || shippingLoading || blockedByClosure}
            className="flex items-center justify-center gap-2 rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60"
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            {submitting ? "در حال انتقال به درگاه پرداخت…" : `پرداخت ${grandTotal.toLocaleString("fa-IR")} تومان`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
