"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { adminGetCustomer, adminGetCustomers } from "@/lib/api";
import { ORDER_STATUS_LABELS, type AdminCustomer } from "@/types/admin";

function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomer | null>(null);

  useEffect(() => {
    adminGetCustomers()
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (customer: AdminCustomer) => {
    if (expandedId === customer.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(customer.id);
    const full = await adminGetCustomer(customer.id);
    setDetail(full);
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">مشتریان</h1>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-cocoa-500">در حال بارگذاری…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-cocoa-500">مشتری‌ای ثبت نشده است</p>
        ) : (
          customers.map((c) => {
            const expanded = expandedId === c.id;
            const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ");
            return (
              <div key={c.id} className="rounded-[1.5rem] border border-sand-100 bg-white p-4">
                <button
                  type="button"
                  onClick={() => toggleExpand(c)}
                  className="flex w-full items-center justify-between gap-3 text-right"
                >
                  <div>
                    <p className="text-sm font-bold text-cocoa-900">{fullName || "بدون نام"}</p>
                    <p className="mt-0.5 text-xs text-cocoa-500" dir="ltr">
                      {c.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold text-sand-500">
                      {(c._count?.orders ?? 0).toLocaleString("fa-IR")} سفارش
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
                    {!detail || detail.id !== c.id ? (
                      <p className="text-xs text-cocoa-500">در حال بارگذاری…</p>
                    ) : detail.orders && detail.orders.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {detail.orders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between rounded-xl bg-sand-50/60 p-3 text-xs"
                          >
                            <span className="text-cocoa-600">
                              {new Date(order.createdAt).toLocaleDateString("fa-IR")} ·{" "}
                              {ORDER_STATUS_LABELS[order.status]}
                            </span>
                            <span className="font-semibold text-cocoa-900">
                              {order.total.toLocaleString("fa-IR")} تومان
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-cocoa-500">سفارشی ثبت نکرده است</p>
                    )}
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

export default AdminCustomersPage;
