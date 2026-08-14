"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  Tags,
  Users,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Preloader from "@/components/Preloader";

const NAV_ITEMS = [
  { href: "/admin", exact: true, label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/products", exact: false, label: "محصولات", icon: Package },
  { href: "/admin/categories", exact: false, label: "دسته‌بندی‌ها", icon: Tags },
  { href: "/admin/orders", exact: false, label: "سفارش‌ها", icon: ShoppingBag },
  { href: "/admin/customers", exact: false, label: "مشتریان", icon: Users },
];

function isActivePath(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const { admin, isAuthenticated, isLoading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

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
    <div dir="rtl" className="min-h-svh bg-cream text-cocoa-900">
      <div className="mx-auto flex min-h-svh max-w-7xl">
        <aside className="hidden w-64 shrink-0 flex-col gap-1 border-l border-sand-100 bg-white p-4 md:flex">
          <div className="mb-4 px-2 py-2">
            <p className="font-display text-lg font-bold text-cocoa-900">پنل ادمین فلوریش</p>
            <p className="mt-0.5 text-xs text-cocoa-500">{admin?.name}</p>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map(({ href, exact, label, icon: Icon }) => {
              const isActive = isActivePath(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    isActive ? "bg-sand-50 text-sand-500" : "text-cocoa-700 hover:bg-sand-50/60"
                  }`}
                >
                  {label}
                  <Icon className="h-4.5 w-4.5" />
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-between gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-bold text-danger-500 transition hover:bg-danger-50"
          >
            خروج
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </aside>

        <div className="flex-1 overflow-x-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-sand-100 bg-white px-4 py-3 md:hidden">
            <span className="font-display text-base font-bold text-cocoa-900">پنل ادمین</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-danger-500"
            >
              خروج
            </button>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-sand-100 bg-white px-3 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map(({ href, exact, label }) => {
              const isActive = isActivePath(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-sand-400 text-white"
                      : "border border-sand-100 bg-white text-cocoa-600"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
