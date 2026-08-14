"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { adminGetCustomer, adminGetCustomers } from "@/lib/api";
import AdminPagination from "@/components/AdminPagination";
import { ORDER_STATUS_LABELS, type AdminCustomer } from "@/types/admin";

const PAGE_SIZE = 10;

function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomer | null>(null);

  useEffect(() => {
    setLoading(true);
    adminGetCustomers(page, PAGE_SIZE)
      .then((res) => {
        setCustomers(res.items);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

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

      <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-sand-100 bg-white">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead className="border-b border-sand-100 text-xs font-bold text-cocoa-500">
            <tr>
              <th className="p-3">نام</th>
              <th className="p-3">موبایل</th>
              <th className="p-3">تعداد سفارش</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-cocoa-500">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-cocoa-500">
                  مشتری‌ای ثبت نشده است
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const expanded = expandedId === c.id;
                const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ");
                return (
                  <Fragment key={c.id}>
                    <tr
                      onClick={() => toggleExpand(c)}
                      className="cursor-pointer border-b border-sand-50 last:border-0 hover:bg-sand-50/40"
                    >
                      <td className="p-3 font-semibold text-cocoa-900">{fullName || "بدون نام"}</td>
                      <td className="p-3 text-cocoa-600" dir="ltr">
                        {c.phone}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold text-sand-500">
                          {(c._count?.orders ?? 0).toLocaleString("fa-IR")} سفارش
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
                        <td colSpan={4} className="p-4">
                          {!detail || detail.id !== c.id ? (
                            <p className="text-xs text-cocoa-500">در حال بارگذاری…</p>
                          ) : detail.orders && detail.orders.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {detail.orders.map((order) => (
                                <div
                                  key={order.id}
                                  className="flex items-center justify-between rounded-xl bg-white p-3 text-xs"
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

export default AdminCustomersPage;
