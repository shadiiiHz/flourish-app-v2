"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingBag, Tags, Users } from "lucide-react";
import { adminGetCategories, adminGetCustomers, adminGetOrders, adminGetProducts } from "@/lib/api";
import type { AdminCategory, AdminCustomer, AdminOrder, AdminProduct } from "@/types/admin";

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

function AdminDashboardPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminGetCategories(),
      adminGetProducts(),
      adminGetOrders(),
      adminGetCustomers(),
    ])
      .then(([c, p, o, cu]) => {
        setCategories(c);
        setProducts(p);
        setOrders(o);
        setCustomers(cu);
      })
      .finally(() => setLoading(false));
  }, []);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">داشبورد</h1>
      {loading ? (
        <p className="mt-4 text-sm text-cocoa-500">در حال بارگذاری…</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="محصولات" value={products.length} icon={Package} />
          <StatCard label="دسته‌بندی‌ها" value={categories.length} icon={Tags} />
          <StatCard
            label="سفارش‌ها"
            value={`${orders.length} (${pendingOrders} در انتظار)`}
            icon={ShoppingBag}
          />
          <StatCard label="مشتریان" value={customers.length} icon={Users} />
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
