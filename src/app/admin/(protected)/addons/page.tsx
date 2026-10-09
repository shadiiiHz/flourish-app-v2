"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {
  ApiError,
  adminBulkDeleteAddons,
  adminCreateAddon,
  adminDeleteAddon,
  adminGetAddons,
  adminUpdateAddon,
  revalidateCatalog,
} from "@/lib/api";
import { buildCsv, downloadCsv, fetchAllPages } from "@/lib/csv";
import {
  CustomDataGrid,
  resolveSelectedRowIds,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import ConfirmModal from "@/components/ConfirmModal";
import { digitsOnly, formatThousands } from "@/lib/formatNumber";
import type { AdminAddon } from "@/types/admin";

interface FormValues {
  name: string;
  price: string;
}

const EMPTY_FORM: FormValues = { name: "", price: "" };

const validationSchema = Yup.object({
  name: Yup.string().trim().required("نام افزودنی الزامی است"),
  price: Yup.string().required("قیمت الزامی است"),
});

function AdminAddonsPage() {
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingAddon, setDeletingAddon] = useState<AdminAddon | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectedIds = useMemo(
    () =>
      resolveSelectedRowIds(
        selectionModel,
        addons.map((a) => a.id),
      ),
    [selectionModel, addons],
  );

  const fetchAddons = () =>
    adminGetAddons(page, pageSize, debouncedSearch).then((res) => {
      setAddons(res.items);
      setTotal(res.total);
    });

  const load = () => {
    setLoading(true);
    fetchAddons().finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchAddons().finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    setSelectionModel({ type: "include", ids: new Set() });
  }, [page, pageSize, debouncedSearch]);

  const handleQueryChange = useCallback((query: QueryType) => {
    setPage(query.page + 1);
    setPageSize(query.pageSize);
    setSearch((query.filterModel?.quickFilterValues ?? []).join(" "));
  }, []);

  const formik = useFormik<FormValues>({
    initialValues: EMPTY_FORM,
    validationSchema,
    onSubmit: async (values, helpers) => {
      setError(null);
      const payload = { name: values.name.trim(), price: Number(values.price) || 0 };
      try {
        if (editingId) {
          await adminUpdateAddon(editingId, payload);
        } else {
          await adminCreateAddon(payload);
        }
        closeModal();
        load();
        // Prices/names of offered addons are shown on the cached storefront catalog.
        revalidateCatalog();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const openCreate = () => {
    setEditingId(null);
    formik.resetForm({ values: EMPTY_FORM });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (addon: AdminAddon) => {
    setEditingId(addon.id);
    formik.resetForm({ values: { name: addon.name, price: String(addon.price) } });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteAddon(id);
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف افزودنی");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await adminBulkDeleteAddons(selectedIds);
      setSelectionModel({ type: "include", ids: new Set() });
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const columns = useMemo<GridColDef<AdminAddon>[]>(
    () => [
      {
        field: "name",
        headerName: "نام افزودنی",
        flex: 1,
        minWidth: 180,
        renderCell: ({ row }) => (
          <span className="font-bold text-cocoa-900">{row.name}</span>
        ),
      },
      {
        field: "price",
        headerName: "قیمت",
        width: 160,
        valueGetter: (_, row) => `${row.price.toLocaleString("fa-IR")} تومان`,
      },
      {
        field: "createdAt",
        headerName: "تاریخ ایجاد",
        width: 140,
        valueGetter: (_, row) =>
          new Date(row.createdAt).toLocaleDateString("fa-IR"),
      },
      {
        field: "actions",
        headerName: "عملیات",
        width: 120,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <div className="flex h-full w-full items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="ویرایش"
              title="ویرایش"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingAddon(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 transition hover:bg-danger-50"
              aria-label="حذف"
              title="حذف"
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
    const all = await fetchAllPages((p, ps) =>
      adminGetAddons(p, ps, debouncedSearch),
    );
    downloadCsv("addons.csv", buildCsv(columns, all));
  }, [columns, debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-cocoa-900">
          افزودنی‌ها
        </h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          افزودنی جدید
        </button>
      </div>

      {error && !modalOpen && (
        <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>
      )}

      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminAddon>
          rows={addons}
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
          exportFileName="addons"
          onExportAll={handleExportAll}
          bulkDeleteLabel="حذف گروهی افزودنی‌ها"
          sx={{ border: "none", height: 800 }}
        />
      </div>

      <Dialog open={modalOpen} onClose={closeModal} maxWidth="xs" fullWidth dir="rtl">
        <DialogTitle className="flex items-center justify-between gap-3 font-display text-cocoa-900">
          {editingId ? "ویرایش افزودنی" : "افزودنی جدید"}
          <button
            type="button"
            onClick={closeModal}
            aria-label="بستن"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cocoa-500 transition hover:bg-sand-50 hover:text-cocoa-700"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </DialogTitle>
        <DialogContent dividers>
          <form onSubmit={formik.handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                نام افزودنی
              </label>
              <input
                name="name"
                autoFocus
                placeholder="مثلاً بسته‌بندی هدیه"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {formik.touched.name && formik.errors.name && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {formik.errors.name}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                قیمت (تومان)
              </label>
              <input
                dir="ltr"
                inputMode="numeric"
                name="price"
                placeholder="مثلاً ۲۰,۰۰۰"
                value={formatThousands(formik.values.price)}
                onChange={(e) =>
                  formik.setFieldValue("price", digitsOnly(e.target.value))
                }
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {formik.touched.price && formik.errors.price && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {formik.errors.price}
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs font-semibold text-danger-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={formik.isSubmitting}
              className="flex items-center justify-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {formik.isSubmitting
                ? "در حال ذخیره…"
                : editingId
                  ? "ذخیره تغییرات"
                  : "ثبت"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={!!deletingAddon}
        title="حذف افزودنی"
        description={
          deletingAddon
            ? `آیا مطمئنید می‌خواهید افزودنی «${deletingAddon.name}» را حذف کنید؟ این افزودنی از همه محصولات نیز برداشته می‌شود.`
            : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() =>
          deletingAddon ? handleDelete(deletingAddon.id) : undefined
        }
        onClose={() => setDeletingAddon(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی افزودنی‌ها"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} افزودنی را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

export default AdminAddonsPage;
