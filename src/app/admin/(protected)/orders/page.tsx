"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ApiError, adminGetOrders, adminUpdateOrderStatus } from "@/lib/api";
import AdminPagination from "@/components/AdminPagination";
import AdminSearchInput from "@/components/AdminSearchInput";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type AdminOrder,
  type OrderStatus,
} from "@/types/admin";

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    adminGetOrders(statusFilter, page, PAGE_SIZE, debouncedSearch)
      .then((res) => {
        setOrders(res.items);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page, debouncedSearch]);

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
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "all");
            setPage(1);
          }}
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

      <div className="mt-4 flex justify-end">
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در نام، موبایل یا شماره سفارش…"
        />
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-sand-100 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="border-b border-sand-100 text-xs font-bold text-cocoa-500">
            <tr>
              <th className="p-3">مشتری</th>
              <th className="p-3">تاریخ</th>
              <th className="p-3">مبلغ</th>
              <th className="p-3">وضعیت پرداخت</th>
              <th className="p-3">وضعیت سفارش</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-cocoa-500">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-cocoa-500">
                  سفارشی یافت نشد
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const expanded = expandedId === order.id;
                return (
                  <Fragment key={order.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                      className="cursor-pointer border-b border-sand-50 last:border-0 hover:bg-sand-50/40"
                    >
                      <td className="p-3">
                        <p className="font-semibold text-cocoa-900">
                          {order.customerName || "مهمان"}
                        </p>
                        <p className="text-xs text-cocoa-500" dir="ltr">
                          {order.customerPhone}
                        </p>
                      </td>
                      <td className="p-3 text-cocoa-600">
                        {new Date(order.createdAt).toLocaleString("fa-IR")}
                      </td>
                      <td className="p-3 font-semibold text-cocoa-900">
                        {order.total.toLocaleString("fa-IR")} تومان
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            order.paymentStatus === "paid"
                              ? "text-sand-500"
                              : order.paymentStatus === "failed"
                                ? "text-danger-500"
                                : "text-cocoa-600"
                          }`}
                        >
                          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="p-3 text-cocoa-500">
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-sand-50 bg-sand-50/30 last:border-0">
                        <td colSpan={6} className="p-4">
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

                          <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3 text-sm">
                            <span className="text-cocoa-600">جمع کالا / مالیات / ارسال</span>
                            <span className="font-semibold text-cocoa-900">
                              {order.subtotal.toLocaleString("fa-IR")} +{" "}
                              {order.tax.toLocaleString("fa-IR")} +{" "}
                              {order.shippingCost.toLocaleString("fa-IR")} تومان
                            </span>
                          </div>

                          {order.addressText && (
                            <div className="mt-2 flex items-start justify-between gap-3 text-sm">
                              <span className="shrink-0 text-cocoa-600">آدرس تحویل</span>
                              <span className="text-left font-semibold text-cocoa-900">
                                {order.addressText}
                                {order.distanceKm != null &&
                                  ` (${order.distanceKm.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلومتر)`}
                              </span>
                            </div>
                          )}

                          {order.note && (
                            <p className="mt-3 rounded-xl bg-white p-3 text-xs text-cocoa-600">
                              {order.note}
                            </p>
                          )}

                          <div
                            className="mt-4 flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}

export default AdminOrdersPage;
