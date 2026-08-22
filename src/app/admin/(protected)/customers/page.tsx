"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Eye, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {
  ApiError,
  adminBulkDeleteCustomers,
  adminCreateCustomer,
  adminDeleteCustomer,
  adminGetCustomer,
  adminGetCustomers,
} from "@/lib/api";
import { buildCsv, downloadCsv, fetchAllPages } from "@/lib/csv";
import {
  CustomDataGrid,
  resolveSelectedRowIds,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import ConfirmModal from "@/components/ConfirmModal";
import { ORDER_STATUS_LABELS, type AdminCustomer } from "@/types/admin";
import { normalizeDigits, PHONE_REGEX } from "@/utils/phone";

interface NewCustomerForm {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
}

const NEW_CUSTOMER_FORM: NewCustomerForm = {
  phone: "",
  firstName: "",
  lastName: "",
  email: "",
};

const newCustomerSchema = Yup.object({
  phone: Yup.string()
    .transform((v) => normalizeDigits(v ?? ""))
    .matches(PHONE_REGEX, "شماره موبایل معتبر نیست")
    .required("شماره موبایل الزامی است"),
  firstName: Yup.string(),
  lastName: Yup.string(),
  email: Yup.string().email("ایمیل معتبر نیست"),
});

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
  const [deletingCustomer, setDeletingCustomer] =
    useState<AdminCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(
    { type: "include", ids: new Set() },
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const selectedIds = useMemo(
    () =>
      resolveSelectedRowIds(
        selectionModel,
        customers.map((c) => c.id),
      ),
    [selectionModel, customers],
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
    adminGetCustomers(page, pageSize, debouncedSearch)
      .then((res) => {
        setCustomers(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await adminDeleteCustomer(id);
      if (selectedId === id) setSelectedId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف مشتری");
    }
  };

  const handleBulkDelete = async () => {
    setError(null);
    try {
      await adminBulkDeleteCustomers(selectedIds);
      setSelectionModel({ type: "include", ids: new Set() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedId) ?? null;

  const createFormik = useFormik<NewCustomerForm>({
    initialValues: NEW_CUSTOMER_FORM,
    validationSchema: newCustomerSchema,
    onSubmit: async (values, helpers) => {
      try {
        await adminCreateCustomer({
          phone: normalizeDigits(values.phone),
          firstName: values.firstName || undefined,
          lastName: values.lastName || undefined,
          email: values.email || undefined,
        });
        helpers.resetForm();
        setCreateOpen(false);
        load();
      } catch (err) {
        helpers.setStatus(err instanceof ApiError ? err.message : "خطا در ثبت مشتری");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

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
        headerName: "عملیات",
        width: 110,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <div className="flex h-full w-full items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openDetail(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="مشاهده جزئیات"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingCustomer(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 transition hover:bg-danger-50"
              aria-label="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const handleExportAll = useCallback(async () => {
    const all = await fetchAllPages((p, ps) => adminGetCustomers(p, ps, debouncedSearch));
    downloadCsv("customers.csv", buildCsv(columns, all));
  }, [columns, debouncedSearch]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-cocoa-900">مشتریان</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders/new"
            className="flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            ثبت سفارش دستی
          </Link>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-sand-500 px-4 py-2 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن مشتری
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>
      )}

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
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          selectedCount={selectedIds.length}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          exportFileName="customers"
          onExportAll={handleExportAll}
          bulkDeleteLabel="حذف گروهی مشتریان"
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

      <ConfirmModal
        isOpen={!!deletingCustomer}
        title="حذف مشتری"
        description={
          deletingCustomer
            ? `آیا مطمئنید می‌خواهید «${
                [deletingCustomer.firstName, deletingCustomer.lastName]
                  .filter(Boolean)
                  .join(" ") || "این مشتری"
              }» را حذف کنید؟ سفارش‌های ثبت‌شده حذف نمی‌شوند.`
            : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() =>
          deletingCustomer ? handleDelete(deletingCustomer.id) : undefined
        }
        onClose={() => setDeletingCustomer(null)}
      />

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        dir="rtl"
      >
        <DialogTitle className="font-display text-cocoa-900">افزودن مشتری</DialogTitle>
        <DialogContent dividers>
          <form onSubmit={createFormik.handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                شماره موبایل
              </label>
              <input
                type="text"
                dir="ltr"
                name="phone"
                value={createFormik.values.phone}
                onChange={(e) =>
                  createFormik.setFieldValue("phone", normalizeDigits(e.target.value))
                }
                onBlur={createFormik.handleBlur}
                placeholder="09xxxxxxxxx"
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {createFormik.touched.phone && createFormik.errors.phone && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {createFormik.errors.phone}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-cocoa-600">نام</label>
                <input
                  type="text"
                  name="firstName"
                  value={createFormik.values.firstName}
                  onChange={createFormik.handleChange}
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                  نام خانوادگی
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={createFormik.values.lastName}
                  onChange={createFormik.handleChange}
                  className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                ایمیل (اختیاری)
              </label>
              <input
                type="email"
                dir="ltr"
                name="email"
                value={createFormik.values.email}
                onChange={createFormik.handleChange}
                onBlur={createFormik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {createFormik.touched.email && createFormik.errors.email && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {createFormik.errors.email}
                </p>
              )}
            </div>

            {createFormik.status && (
              <p className="text-xs font-semibold text-danger-500">{createFormik.status}</p>
            )}

            <button
              type="submit"
              disabled={createFormik.isSubmitting}
              className="mt-1 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {createFormik.isSubmitting ? "در حال ثبت…" : "ثبت مشتری"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی مشتریان"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} مشتری را حذف کنید؟ سفارش‌های ثبت‌شده حذف نمی‌شوند.`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

export default AdminCustomersPage;
