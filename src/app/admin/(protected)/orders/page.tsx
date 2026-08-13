"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ApiError, adminGetOrders, adminUpdateOrderStatus } from "@/lib/api";
import { ORDER_STATUS_LABELS, type AdminOrder, type OrderStatus } from "@/types/admin";

const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-sand-50 text-sand-500",
  confirmed: "bg-sand-100 text-sand-500",
  preparing: "bg-sand-100 text-sand-500",
  ready: "bg-sand-200 text-cocoa-900",
  delivered: "bg-cocoa-700/10 text-cocoa-700",
  cancelled: "bg-danger-50 text-danger-500",
};

function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminGetOrders(statusFilter)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    setError(null);
    try {
      await adminUpdateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در بروزرسانی وضعیت");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-cocoa-900">سفارش‌ها</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
          className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-bold text-cocoa-700"
        >
          <option value="all">همه وضعیت‌ها</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-cocoa-500">در حال بارگذاری…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-cocoa-500">سفارشی یافت نشد</p>
        ) : (
          orders.map((order) => {
            const expanded = expandedId === order.id;
            return (
              <div key={order.id} className="rounded-[1.5rem] border border-sand-100 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="flex w-full items-center justify-between gap-3 text-right"
                >
                  <div>
                    <p className="text-sm font-bold text-cocoa-900">
                      {order.customerName || "مهمان"} · {order.customerPhone}
                    </p>
                    <p className="mt-0.5 text-xs text-cocoa-500">
                      {new Date(order.createdAt).toLocaleString("fa-IR")} ·{" "}
                      {order.total.toLocaleString("fa-IR")} تومان
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[order.status]}`}
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-cocoa-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-cocoa-500" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 border-t border-sand-50 pt-4">
                    <div className="flex flex-col gap-2">
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

                    <div className="mt-3 flex items-center justify-between border-t border-sand-50 pt-3 text-sm">
                      <span className="text-cocoa-600">جمع کل / مالیات</span>
                      <span className="font-semibold text-cocoa-900">
                        {order.subtotal.toLocaleString("fa-IR")} + {order.tax.toLocaleString("fa-IR")}{" "}
                        تومان
                      </span>
                    </div>

                    {order.note && (
                      <p className="mt-3 rounded-xl bg-sand-50/60 p-3 text-xs text-cocoa-600">
                        {order.note}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs font-semibold text-cocoa-600">تغییر وضعیت:</span>
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                        className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-bold text-cocoa-700"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AdminOrdersPage;
