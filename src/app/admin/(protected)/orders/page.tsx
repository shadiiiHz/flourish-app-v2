"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import {
  ApiError,
  adminBulkDeleteOrders,
  adminGetOrders,
  adminUpdateOrderStatus,
} from "@/lib/api";
import {
  CustomDataGrid,
  resolveSelectedRowIds,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import ConfirmModal from "@/components/ConfirmModal";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type AdminOrder,
  type OrderStatus,
} from "@/types/admin";

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
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(
    { type: "include", ids: new Set() },
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectedIds = useMemo(
    () =>
      resolveSelectedRowIds(
        selectionModel,
        orders.map((o) => o.id),
      ),
    [selectionModel, orders],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(() => {
    setLoading(true);
    adminGetOrders(statusFilter, page, pageSize, debouncedSearch)
      .then((res) => {
        setOrders(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page, pageSize, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectionModel({ type: "include", ids: new Set() });
  }, [statusFilter, page, pageSize, debouncedSearch]);

  const handleQueryChange = useCallback((query: QueryType) => {
    setPage(query.page + 1);
    setPageSize(query.pageSize);
    setSearch((query.filterModel?.quickFilterValues ?? []).join(" "));
  }, []);

  const handleBulkDelete = async () => {
    setError(null);
    try {
      await adminBulkDeleteOrders(selectedIds);
      setSelectionModel({ type: "include", ids: new Set() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    setError(null);
    try {
      await adminUpdateOrderStatus(id, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o)),
      );
      setSelectedOrder((prev) =>
        prev && prev.id === id ? { ...prev, status } : prev,
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "خطا در بروزرسانی وضعیت",
      );
    }
  };

  const columns = useMemo<GridColDef<AdminOrder>[]>(
    () => [
      {
        field: "customer",
        headerName: "مشتری",
        flex: 1,
        minWidth: 160,
        renderCell: ({ row }) => (
          <div className="py-1.5">
            <p className="font-semibold text-cocoa-900">
              {row.customerName || "بدون نام"}
            </p>
            <p className="text-xs text-cocoa-500" dir="ltr">
              {row.customerPhone}
            </p>
          </div>
        ),
      },
      {
        field: "createdAt",
        headerName: "تاریخ",
        width: 170,
        valueGetter: (_, row) =>
          new Date(row.createdAt).toLocaleString("fa-IR"),
      },
      {
        field: "orderType",
        headerName: "نوع سفارش",
        width: 130,
        renderCell: ({ row }) =>
          row.orderType === "preorder" ? (
            <Tooltip
              title={
                row.scheduledDate
                  ? `پیش‌سفارش برای ${new Date(row.scheduledDate).toLocaleDateString("fa-IR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}${row.scheduledTimeSlot ? ` — ساعت ${row.scheduledTimeSlot}` : ""}`
                  : "پیش‌سفارش"
              }
              arrow
            >
              <span className="cursor-default rounded-full bg-sand-100 px-3 py-1 text-xs font-bold text-cocoa-900">
                پیش‌سفارش
              </span>
            </Tooltip>
          ) : (
            <span className="text-xs text-cocoa-500">فوری</span>
          ),
      },
      {
        field: "total",
        headerName: "مبلغ",
        width: 140,
        valueGetter: (_, row) => `${row.total.toLocaleString("fa-IR")} تومان`,
      },
      {
        field: "paymentStatus",
        headerName: "وضعیت پرداخت",
        width: 130,
        renderCell: ({ row }) => (
          <span
            className={`font-semibold ${
              row.paymentStatus === "paid"
                ? "text-sand-500"
                : row.paymentStatus === "failed"
                  ? "text-danger-500"
                  : "text-cocoa-600"
            }`}
          >
            {PAYMENT_STATUS_LABELS[row.paymentStatus]}
          </span>
        ),
      },
      {
        field: "status",
        headerName: "وضعیت سفارش",
        width: 150,
        renderCell: ({ row }) => (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[row.status]}`}
          >
            {ORDER_STATUS_LABELS[row.status]}
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
              onClick={() => setSelectedOrder(row)}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-cocoa-900">
          سفارش‌ها
        </h1>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "all");
              setPage(1);
            }}
            sx={{ borderRadius: 999, fontSize: 13, fontWeight: 700 }}
          >
            <MenuItem value="all">همه وضعیت‌ها</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {error && (
        <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>
      )}

      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminOrder>
          rows={orders}
          rowCount={total}
          columns={columns}
          loading={loading}
          onQueryChange={handleQueryChange}
          localeText={faDataGridLocaleText}
          filterMode="client"
          sortingMode="client"
          getRowHeight={() => 64}
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          selectedCount={selectedIds.length}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          bulkDeleteLabel="حذف گروهی سفارش‌ها"
          sx={{ border: "none", height: 800 }}
        />
      </div>

      <Dialog
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        maxWidth="sm"
        fullWidth
        dir="rtl"
      >
        {selectedOrder && (
          <>
            <DialogTitle className="font-display text-cocoa-900">
              سفارش {selectedOrder.customerName || "مهمان"}
            </DialogTitle>
            <DialogContent dividers>
              {selectedOrder.orderType === "preorder" && selectedOrder.scheduledDate && (
                <div className="mb-3 rounded-xl bg-sand-50 p-3 text-sm font-semibold text-cocoa-900">
                  پیش‌سفارش برای{" "}
                  {new Date(selectedOrder.scheduledDate).toLocaleDateString("fa-IR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  {selectedOrder.scheduledTimeSlot &&
                    ` — ساعت ${selectedOrder.scheduledTimeSlot}`}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-cocoa-700">
                      {item.title}
                      {item.variantTitle
                        ? ` (${item.variantTitle})`
                        : ""} × {item.quantity.toLocaleString("fa-IR")}
                    </span>
                    <span className="font-semibold text-cocoa-900">
                      {(item.price * item.quantity).toLocaleString("fa-IR")}{" "}
                      تومان
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3 text-sm">
                <span className="text-cocoa-600">
                  جمع کالا / مالیات / ارسال
                </span>
                <span className="font-semibold text-cocoa-900">
                  {selectedOrder.subtotal.toLocaleString("fa-IR")} +{" "}
                  {selectedOrder.tax.toLocaleString("fa-IR")} +{" "}
                  {selectedOrder.shippingCost.toLocaleString("fa-IR")} تومان
                </span>
              </div>

              {selectedOrder.addressText && (
                <div className="mt-2 flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-cocoa-600">آدرس تحویل</span>
                  <span className="text-left font-semibold text-cocoa-900">
                    {selectedOrder.addressText}
                    {selectedOrder.distanceKm != null &&
                      ` (${selectedOrder.distanceKm.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلومتر)`}
                  </span>
                </div>
              )}

              {selectedOrder.note && (
                <p className="mt-3 rounded-xl bg-sand-50/60 p-3 text-xs text-cocoa-600">
                  {selectedOrder.note}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-semibold text-cocoa-600 shrink-0">
                  تغییر وضعیت:
                </span>
                <FormControl size="small" fullWidth>
                  <Select
                    value={selectedOrder.status}
                    onChange={(e) =>
                      updateStatus(
                        selectedOrder.id,
                        e.target.value as OrderStatus,
                      )
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {ORDER_STATUS_LABELS[s]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </DialogContent>
          </>
        )}
      </Dialog>

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی سفارش‌ها"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} سفارش را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

export default AdminOrdersPage;
