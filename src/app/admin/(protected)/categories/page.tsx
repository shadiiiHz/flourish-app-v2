"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import {
  ApiError,
  adminBulkDeleteCategories,
  adminCreateCategory,
  adminDeleteCategory,
  adminGetCategories,
  adminUpdateCategory,
  adminUploadImage,
  apiUploadUrl,
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
import type { AdminCategory, CategoryTabId } from "@/types/admin";

const TAB_LABELS: Record<CategoryTabId, string> = {
  bakery: "نان و شیرینی",
  drinks: "نوشیدنی",
};

interface FormValues {
  slug: string;
  tab: CategoryTabId;
  title: string;
  image: string;
  note: string;
  sortOrder: string;
}

const EMPTY_FORM: FormValues = {
  slug: "",
  tab: "bakery",
  title: "",
  image: "",
  note: "",
  sortOrder: "",
};

/** Categories no longer take a manual slug — a valid, unique one is generated from the group on create. */
function generateSlug(tab: CategoryTabId) {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${tab}-${random}`;
}

const validationSchema = Yup.object({
  title: Yup.string().trim().required("عنوان الزامی است"),
  tab: Yup.mixed<CategoryTabId>().oneOf(["bakery", "drinks"]).required(),
  note: Yup.string(),
  image: Yup.string(),
  sortOrder: Yup.number()
    .typeError("ترتیب نمایش باید عدد باشد")
    .min(0, "ترتیب نمایش نمی‌تواند منفی باشد"),
});

function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingCategory, setDeletingCategory] =
    useState<AdminCategory | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(
    { type: "include", ids: new Set() },
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectedIds = useMemo(
    () =>
      resolveSelectedRowIds(
        selectionModel,
        categories.map((c) => c.id),
      ),
    [selectionModel, categories],
  );

  const fetchCategories = () =>
    adminGetCategories(page, pageSize, debouncedSearch).then((res) => {
      setCategories(res.items);
      setTotal(res.total);
    });

  const load = () => {
    setLoading(true);
    fetchCategories().finally(() => setLoading(false));
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
    fetchCategories().finally(() => setLoading(false));
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
      try {
        const payload = {
          slug: editingId ? values.slug : generateSlug(values.tab),
          tab: values.tab,
          title: values.title.trim(),
          image: values.image || undefined,
          note: values.note.trim() || undefined,
          sortOrder: Number(values.sortOrder) || 0,
        };
        if (editingId) {
          await adminUpdateCategory(editingId, payload);
        } else {
          await adminCreateCategory(payload);
        }
        startCreate();
        load();
        revalidateCatalog();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const startCreate = () => {
    setEditingId(null);
    formik.resetForm({ values: EMPTY_FORM });
    setError(null);
  };

  const startEdit = (cat: AdminCategory) => {
    setEditingId(cat.id);
    formik.resetForm({
      values: {
        slug: cat.slug,
        tab: cat.tab,
        title: cat.title,
        image: cat.image ?? "",
        note: cat.note ?? "",
        sortOrder: String(cat.sortOrder),
      },
    });
    setError(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await adminUploadImage(file);
      formik.setFieldValue("image", url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteCategory(id);
      if (editingId === id) startCreate();
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف دسته‌بندی");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await adminBulkDeleteCategories(selectedIds);
      if (editingId && selectedIds.includes(editingId)) startCreate();
      setSelectionModel({ type: "include", ids: new Set() });
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const columns = useMemo<GridColDef<AdminCategory>[]>(
    () => [
      {
        field: "image",
        headerName: "تصویر",
        width: 80,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) =>
          row.image ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={apiUploadUrl(row.image)}
                alt=""
                className="h-9 w-9 rounded-full border border-sand-100 object-cover"
              />
            </div>
          ) : null,
      },
      { field: "title", headerName: "عنوان", flex: 1, minWidth: 140 },
      {
        field: "tab",
        headerName: "گروه",
        width: 130,
        valueGetter: (_, row) => TAB_LABELS[row.tab],
      },
      {
        field: "productCount",
        headerName: "تعداد محصولات",
        width: 130,
        valueGetter: (_, row) => row._count?.products ?? 0,
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
          <div className="w-full h-full flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => startEdit(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="ویرایش"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingCategory(row)}
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
    const all = await fetchAllPages((p, ps) => adminGetCategories(p, ps, debouncedSearch));
    downloadCsv("categories.csv", buildCsv(columns, all));
  }, [columns, debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-cocoa-900">
          دسته‌بندی‌ها
        </h1>
      </div>

      <form
        onSubmit={formik.handleSubmit}
        className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-cocoa-900">
            {editingId ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی جدید"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-1 text-xs font-semibold text-cocoa-500 hover:text-cocoa-700"
            >
              <X className="h-3.5 w-3.5" /> انصراف از ویرایش
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              عنوان
            </label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.title && formik.errors.title && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.title}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              گروه
            </label>
            <select
              name="tab"
              value={formik.values.tab}
              onChange={formik.handleChange}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            >
              <option value="bakery">نان و شیرینی</option>
              <option value="drinks">نوشیدنی</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              ترتیب نمایش
            </label>
            <input
              type="number"
              placeholder="0"
              name="sortOrder"
              value={formik.values.sortOrder}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.sortOrder && formik.errors.sortOrder && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.sortOrder}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              توضیح (اختیاری)
            </label>
            <input
              name="note"
              value={formik.values.note}
              onChange={formik.handleChange}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              تصویر آیکون
            </label>
            <div className="flex items-center gap-3">
              {formik.values.image && (
                <img
                  src={apiUploadUrl(formik.values.image)}
                  alt=""
                  className="h-12 w-12 rounded-full border border-sand-100 object-cover"
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50 disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "در حال آپلود…" : "آپلود تصویر"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="mt-4 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {formik.isSubmitting
            ? "در حال ذخیره…"
            : editingId
              ? "ذخیره تغییرات"
              : "افزودن دسته‌بندی"}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminCategory>
          rows={categories}
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
          exportFileName="categories"
          onExportAll={handleExportAll}
          bulkDeleteLabel="حذف گروهی دسته‌بندی‌ها"
          sx={{ border: "none", height: 800 }}
        />
      </div>

      <ConfirmModal
        isOpen={!!deletingCategory}
        title="حذف دسته‌بندی"
        description={
          deletingCategory
            ? `آیا مطمئنید می‌خواهید دسته‌بندی «${deletingCategory.title}» و همه محصولات آن را حذف کنید؟`
            : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() => (deletingCategory ? handleDelete(deletingCategory.id) : undefined)}
        onClose={() => setDeletingCategory(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی دسته‌بندی‌ها"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} دسته‌بندی و همه محصولات آن‌ها را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

export default AdminCategoriesPage;
