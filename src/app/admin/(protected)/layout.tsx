"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Tags,
  TicketPercent,
  Users,
  Wallet,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminGetUnreadMessageCount } from "@/lib/api";
import { toPersianDigits } from "@/lib/formatNumber";
import Preloader from "@/components/Preloader";
import MuiAdminProvider from "@/components/admin/MuiAdminProvider";

const NAV_ITEMS = [
  { href: "/admin", exact: true, label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/messages", exact: false, label: "پیام‌ها", icon: Bell },
  { href: "/admin/products", exact: false, label: "محصولات", icon: Package },
  { href: "/admin/combo", exact: false, label: "کمبو", icon: Gift },
  { href: "/admin/categories", exact: false, label: "دسته‌بندی‌ها", icon: Tags },
  { href: "/admin/orders", exact: false, label: "سفارش‌ها", icon: ShoppingBag },
  { href: "/admin/customers", exact: false, label: "مشتریان", icon: Users },
  { href: "/admin/discount-codes", exact: false, label: "کدهای تخفیف", icon: TicketPercent },
  { href: "/admin/wallet", exact: false, label: "کیف پول", icon: Wallet },
  { href: "/admin/settings", exact: false, label: "تنظیمات", icon: Settings },
];

/** Polls the admin-messages unread count so the nav badge stays current without a page reload. */
const UNREAD_POLL_INTERVAL_MS = 15_000;

const SIDEBAR_COLLAPSED_KEY = "flourish-admin-sidebar-collapsed";

function isActivePath(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const { admin, isAuthenticated, isLoading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = () => {
      adminGetUnreadMessageCount()
        .then(({ count }) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, UNREAD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAuthenticated, pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/admin/login");
  };

  if (isLoading) {
    return <Preloader label="" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <MuiAdminProvider>
    <div dir="rtl" className="relative min-h-svh overflow-x-clip bg-cream text-cocoa-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: "url(/assets/logo.png)",
          backgroundRepeat: "repeat",
          backgroundSize: "100px 100px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full">
        <aside
          className={`relative hidden shrink-0 flex-col gap-1 border-l border-white/40 bg-white/80 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 transition-[width] duration-300 md:flex ${
            collapsed ? "w-20 px-2" : "w-64 px-4"
          }`}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "باز کردن سایدبار" : "جمع کردن سایدبار"}
            className={`absolute top-8 -left-3.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-white text-cocoa-700 shadow-[0_10px_20px_-8px_rgba(74,44,18,0.4)] transition hover:text-sand-500 ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div
            className={`mb-4 flex items-center gap-2 py-2 ${collapsed ? "justify-center px-0" : "px-2"}`}
          >
            <Image
              src="/assets/textLogo.png"
              alt="لوگوی فلوریش"
              width={112}
              height={112}
              className="h-10 w-10 shrink-0 object-contain"
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-cocoa-900">
                  پنل ادمین فلوریش
                </p>
                <p className="truncate text-xs text-cocoa-500">{admin?.name}</p>
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map(({ href, exact, label, icon: Icon }) => {
              const isActive = isActivePath(pathname, href, exact);
              const showBadge = href === "/admin/messages" && unreadCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    collapsed ? "justify-center" : "justify-between"
                  } ${isActive ? "bg-sand-50 text-sand-500" : "text-cocoa-700 hover:bg-sand-50/60"}`}
                >
                  {!collapsed && label}
                  <span className="relative flex shrink-0 items-center">
                    <Icon className="h-4.5 w-4.5" />
                    {showBadge && (
                      <span className="absolute -left-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "۹۹+" : toPersianDigits(String(unreadCount))}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "خروج" : undefined}
            className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold text-danger-500 transition hover:bg-danger-50 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            {!collapsed && "خروج"}
            <LogOut className="h-4.5 w-4.5 shrink-0" />
          </button>
        </aside>

        <div className="flex-1 overflow-x-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-sand-100 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
            <div className="flex items-center gap-2">
              <Image
                src="/assets/textLogo.png"
                alt="لوگوی فلوریش"
                width={112}
                height={112}
                className="h-8 w-8 object-contain"
              />
              <span className="font-display text-base font-bold text-cocoa-900">پنل ادمین</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-danger-500"
            >
              خروج
            </button>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-sand-100 bg-white/80 px-3 py-2 backdrop-blur-xl md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map(({ href, exact, label }) => {
              const isActive = isActivePath(pathname, href, exact);
              const showBadge = href === "/admin/messages" && unreadCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-sand-400 text-white"
                      : "border border-sand-100 bg-white text-cocoa-600"
                  }`}
                >
                  {label}
                  {showBadge && (
                    <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "۹۹+" : toPersianDigits(String(unreadCount))}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
    </MuiAdminProvider>
  );
}
