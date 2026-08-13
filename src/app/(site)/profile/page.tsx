"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Camera,
  KeyRound,
  Landmark,
  LogOut,
  MapPin,
  Menu,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { normalizeDigits, PHONE_REGEX, toPersianDigits } from "@/utils/phone";
import { getMyOrders } from "@/lib/api";
import { ORDER_STATUS_LABELS, type Order } from "@/types/order";
import AddressesPanel from "@/components/AddressesPanel";
import ChangePasswordPanel from "@/components/ChangePasswordPanel";

type ProfileTab =
  | "info"
  | "orders"
  | "addresses"
  | "transactions"
  | "password"
  | "notifications";

const TABS: { id: ProfileTab; label: string; icon: typeof User }[] = [
  { id: "orders", label: "سفارش‌های من", icon: ShoppingBag },
  { id: "addresses", label: "آدرس‌های من", icon: MapPin },
  { id: "transactions", label: "تراکنش‌ها", icon: Landmark },
  { id: "info", label: "اطلاعات من", icon: User },
  { id: "password", label: "تغییر کلمه عبور", icon: KeyRound },
  { id: "notifications", label: "تنظیمات اعلان", icon: Bell },
];

function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-white/40 bg-white/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-7">
      {children}
    </div>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <GlassCard>
      <h2 className="font-display text-lg font-bold text-cocoa-900">{label}</h2>
      <p className="mt-3 text-sm text-cocoa-500">این بخش به‌زودی تکمیل می‌شود.</p>
    </GlassCard>
  );
}

function OrdersPanel() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return (
    <GlassCard>
      <h2 className="font-display text-lg font-bold text-cocoa-900">سفارش‌های من</h2>

      {loading ? (
        <p className="mt-3 text-sm text-cocoa-500">در حال بارگذاری…</p>
      ) : orders.length === 0 ? (
        <p className="mt-3 text-sm text-cocoa-500">هنوز سفارشی ثبت نکرده‌اید.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-sand-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-cocoa-500">
                  {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                </span>
                <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold text-sand-500">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="mt-2.5 flex flex-col gap-1">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-cocoa-700">
                      {item.title}
                      {item.variantTitle ? ` (${item.variantTitle})` : ""} ×{" "}
                      {item.quantity.toLocaleString("fa-IR")}
                    </span>
                    <span className="font-semibold text-cocoa-900">
                      {(item.price * item.quantity).toLocaleString("fa-IR")} تومان
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-sand-50 pt-2.5 text-sm">
                <span className="font-bold text-cocoa-700">مجموع</span>
                <span className="font-bold text-cocoa-900">
                  {order.total.toLocaleString("fa-IR")} تومان
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute -top-2.5 right-4 z-10 bg-white/95 px-2 text-xs font-semibold text-sand-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function ProfileInfoPanel() {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatar, setAvatar] = useState(user?.avatar);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizeDigits(phone);
    if (!PHONE_REGEX.test(cleanPhone)) {
      setPhoneError("شماره موبایل را به‌درستی وارد کنید");
      return;
    }
    setPhoneError(null);
    setPhone(cleanPhone);
    updateProfile({ firstName, lastName, email, avatar, phone: cleanPhone });
  };

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 overflow-hidden rounded-full border-2 border-dashed border-cocoa-900/15 bg-sand-50/60 text-cocoa-500 transition hover:border-sand-400 hover:bg-sand-50"
          >
            {avatar ? (
              <img src={avatar} alt="آواتار" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span className="text-[11px] font-semibold">آپلود آواتار</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        <div className="flex w-full flex-col gap-4">
          <InfoField label="نام">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>

          <InfoField label="نام خانوادگی">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>

          <InfoField label="موبایل">
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={toPersianDigits(phone)}
              onChange={(e) => {
                setPhoneError(null);
                setPhone(normalizeDigits(e.target.value));
              }}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>
          {phoneError && (
            <p className="-mt-2 text-xs font-semibold text-danger-500">{phoneError}</p>
          )}

          <InfoField label="ایمیل (اختیاری)">
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </InfoField>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 sm:w-auto sm:self-start sm:px-8"
        >
          اعمال تغییرات
        </button>
      </form>
    </GlassCard>
  );
}

function SidebarNav({
  activeTab,
  onSelect,
  onLogout,
}: {
  activeTab: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  onLogout: () => void;
}) {
  const { user } = useAuth();

  return (
    <>
      <div className="flex items-center gap-3 px-2 py-3">
        <span dir="ltr" className="flex-1 text-sm font-bold text-cocoa-900">
          {toPersianDigits(user?.phone ?? "")}
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-50 text-sand-500">
          <User className="h-5 w-5" />
        </span>
      </div>

      <div className="my-1 h-px bg-cocoa-900/10" />

      <nav className="flex flex-col gap-1 py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`flex items-center justify-between gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
              activeTab === id
                ? "bg-sand-50 text-sand-500"
                : "text-cocoa-700 hover:bg-sand-50/60"
            }`}
          >
            {label}
            <Icon className="h-4.5 w-4.5" />
          </button>
        ))}

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-between gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold text-danger-500 transition hover:bg-danger-50"
        >
          خروج
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </nav>
    </>
  );
}

function SidebarDrawer({
  activeTab,
  onSelect,
  onLogout,
  onClose,
}: {
  activeTab: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  onLogout: () => void;
  onClose: () => void;
}) {
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
      className="fixed inset-0 z-100 flex justify-end md:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-cocoa-900/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative flex h-full w-full max-w-xs flex-col overflow-y-auto border-r border-white/40 bg-white p-3 shadow-[0_40px_80px_-30px_rgba(74,44,18,0.55)]"
      >
        <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <h2 id="profile-drawer-title" className="font-display text-base font-bold text-cocoa-900">
            حساب کاربری
          </h2>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 shadow-sm transition hover:bg-sand-50"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <SidebarNav
          activeTab={activeTab}
          onSelect={(tab) => {
            onSelect(tab);
            onClose();
          }}
          onLogout={onLogout}
        />
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function ProfilePageContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const requestedTab = searchParams.get("tab");
  const activeTab: ProfileTab = TABS.some((t) => t.id === requestedTab)
    ? (requestedTab as ProfileTab)
    : "info";

  useEffect(() => {
    if (!requestedTab) return;
    if (!TABS.some((t) => t.id === requestedTab)) {
      router.replace(pathname, { scroll: false });
    }
  }, [requestedTab, pathname, router]);

  const selectTab = (tab: ProfileTab) => {
    if (tab === "info") router.push(pathname, { scroll: false });
    else router.push(`${pathname}?tab=${tab}`, { scroll: false });
  };

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? "اطلاعات من";

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-5xl px-3 py-8 sm:px-6 sm:py-12">
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="mb-4 flex w-full items-center justify-between gap-2.5 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm font-bold text-cocoa-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_20px_40px_-25px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
      >
        <span className="flex items-center gap-2">
          <Menu className="h-4.5 w-4.5 text-sand-500" />
          {activeLabel}
        </span>
        <span className="text-xs font-semibold text-cocoa-500">حساب کاربری</span>
      </button>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr] md:gap-6">
        <aside className="hidden h-fit rounded-[2rem] border border-white/40 bg-white/80 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 md:block">
          <SidebarNav activeTab={activeTab} onSelect={selectTab} onLogout={logout} />
        </aside>

        <div>
          {activeTab === "info" && <ProfileInfoPanel />}
          {activeTab === "orders" && <OrdersPanel />}
          {activeTab === "addresses" && <AddressesPanel />}
          {activeTab === "transactions" && <PlaceholderPanel label="تراکنش‌ها" />}
          {activeTab === "password" && <ChangePasswordPanel />}
          {activeTab === "notifications" && <PlaceholderPanel label="تنظیمات اعلان" />}
        </div>
      </div>

      <AnimatePresence>
        {isDrawerOpen && (
          <SidebarDrawer
            activeTab={activeTab}
            onSelect={selectTab}
            onLogout={logout}
            onClose={() => setIsDrawerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageContent />
    </Suspense>
  );
}

export default ProfilePage;
