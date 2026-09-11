"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingBag, Tags, Users } from "lucide-react";
import { adminGetCategories, adminGetCustomers, adminGetOrders, adminGetProducts } from "@/lib/api";
import VisitsLineChart from "@/components/admin/VisitsLineChart";

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: typeof Package;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[1.5rem] border border-sand-100 bg-white p-5 shadow-[0_16px_40px_-24px_rgba(138,84,39,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-24px_rgba(138,84,39,0.5)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold text-cocoa-500">{label}</p>
        <p className="mt-0.5 font-display text-xl font-bold text-cocoa-900">{value}</p>
      </div>
    </Link>
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] border border-sand-100 bg-white p-5 shadow-[0_16px_40px_-24px_rgba(138,84,39,0.35)]">
      <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-sand-50" />
      <div className="flex-1">
        <span className="block h-3 w-16 animate-pulse rounded-full bg-sand-50" />
        <span className="mt-2 block h-5 w-12 animate-pulse rounded-full bg-sand-100" />
      </div>
    </div>
  );
}

interface Stats {
  categories: number;
  products: number;
  orders: number;
  pendingOrders: number;
  customers: number;
}

function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    // Only the `total` count is needed here, so every list is fetched with
    // pageSize=1 instead of pulling the full (potentially huge) dataset.
    Promise.all([
      adminGetCategories(1, 1),
      adminGetProducts(1, 1),
      adminGetOrders("all", 1, 1),
      adminGetOrders("pending", 1, 1),
      adminGetCustomers(1, 1),
    ]).then(([categories, products, orders, pendingOrders, customers]) => {
      setStats({
        categories: categories.total,
        products: products.total,
        orders: orders.total,
        pendingOrders: pendingOrders.total,
        customers: customers.total,
      });
    });
  }, []);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">داشبورد</h1>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {!stats ? (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="محصولات" value={stats.products} icon={Package} href="/admin/products" />
            <StatCard
              label="دسته‌بندی‌ها"
              value={stats.categories}
              icon={Tags}
              href="/admin/categories"
            />
            <StatCard
              label="سفارش‌ها"
              value={`${stats.orders} (${stats.pendingOrders} در انتظار)`}
              icon={ShoppingBag}
              href="/admin/orders"
            />
            <StatCard label="مشتریان" value={stats.customers} icon={Users} href="/admin/customers" />
          </>
        )}
      </div>

      <VisitsLineChart />
    </div>
  );
}

export default AdminDashboardPage;
