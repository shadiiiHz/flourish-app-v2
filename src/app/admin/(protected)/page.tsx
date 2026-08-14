"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingBag, Tags, Users } from "lucide-react";
import { adminGetCategories, adminGetCustomers, adminGetOrders, adminGetProducts } from "@/lib/api";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Package;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] border border-sand-100 bg-white p-5 shadow-[0_16px_40px_-24px_rgba(138,84,39,0.35)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold text-cocoa-500">{label}</p>
        <p className="mt-0.5 font-display text-xl font-bold text-cocoa-900">{value}</p>
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
      {!stats ? (
        <p className="mt-4 text-sm text-cocoa-500">در حال بارگذاری…</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="محصولات" value={stats.products} icon={Package} />
          <StatCard label="دسته‌بندی‌ها" value={stats.categories} icon={Tags} />
          <StatCard
            label="سفارش‌ها"
            value={`${stats.orders} (${stats.pendingOrders} در انتظار)`}
            icon={ShoppingBag}
          />
          <StatCard label="مشتریان" value={stats.customers} icon={Users} />
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
