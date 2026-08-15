"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import type { GridColDef } from "@mui/x-data-grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import { adminGetCustomer, adminGetCustomers } from "@/lib/api";
import {
  CustomDataGrid,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import { ORDER_STATUS_LABELS, type AdminCustomer } from "@/types/admin";

function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomer | null>(null);
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
    adminGetCustomers(page, pageSize, debouncedSearch)
      .then((res) => {
        setCustomers(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch]);

  const handleQueryChange = useCallback((query: QueryType) => {
    setPage(query.page + 1);
    setPageSize(query.pageSize);
    setSearch((query.filterModel?.quickFilterValues ?? []).join(" "));
  }, []);

  const openDetail = async (customer: AdminCustomer) => {
    setSelectedId(customer.id);
    setDetail(null);
    const full = await adminGetCustomer(customer.id);
    setDetail(full);
  };

  const selectedCustomer = customers.find((c) => c.id === selectedId) ?? null;

  const columns = useMemo<GridColDef<AdminCustomer>[]>(
    () => [
      {
        field: "name",
        headerName: "نام",
        flex: 1,
        minWidth: 140,
        valueGetter: (_, row) =>
          [row.firstName, row.lastName].filter(Boolean).join(" ") || "بدون نام",
      },
      {
        field: "phone",
        headerName: "موبایل",
        width: 150,
        renderCell: ({ row }) => <span dir="ltr">{row.phone}</span>,
      },
      {
        field: "orderCount",
        headerName: "تعداد سفارش",
        width: 140,
        renderCell: ({ row }) => (
          <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold text-sand-500">
            {(row._count?.orders ?? 0).toLocaleString("fa-IR")} سفارش
          </span>
        ),
      },
      {
        field: "actions",
        headerName: "جزئیات",
        width: 90,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <div className="flex h-full w-full items-center justify-center">
            <button
              type="button"
              onClick={() => openDetail(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="مشاهده جزئیات"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">مشتریان</h1>

      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminCustomer>
          rows={customers}
          rowCount={total}
          columns={columns}
          loading={loading}
          onQueryChange={handleQueryChange}
          localeText={faDataGridLocaleText}
          filterMode="client"
          sortingMode="client"
          getRowHeight={() => 56}
          sx={{ border: "none", height: 720 }}
        />
      </div>

      <Dialog
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        maxWidth="sm"
        fullWidth
        dir="rtl"
      >
        {selectedCustomer && (
          <>
            <DialogTitle className="font-display text-cocoa-900">
              سفارش‌های{" "}
              {[selectedCustomer.firstName, selectedCustomer.lastName]
                .filter(Boolean)
                .join(" ") || "بدون نام"}
            </DialogTitle>
            <DialogContent dividers>
              {!detail ? (
                <p className="text-xs text-cocoa-500">در حال بارگذاری…</p>
              ) : detail.orders && detail.orders.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {detail.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-xl bg-sand-50/60 p-3 text-xs"
                    >
                      <span className="text-cocoa-600">
                        {new Date(order.createdAt).toLocaleDateString("fa-IR")}{" "}
                        · {ORDER_STATUS_LABELS[order.status]}
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
            </DialogContent>
          </>
        )}
      </Dialog>
    </div>
  );
}

export default AdminCustomersPage;
