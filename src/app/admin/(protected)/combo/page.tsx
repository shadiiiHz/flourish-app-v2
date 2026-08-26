"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { CalendarClock, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import {
  ApiError,
  adminBulkDeleteComboProducts,
  adminCreateComboProduct,
  adminDeleteComboProduct,
  adminGetComboProducts,
  adminUpdateComboProduct,
  adminUploadImage,
  apiUploadUrl,
  revalidateCatalog,
} from "@/lib/api";
import { digitsOnly, formatThousands } from "@/lib/formatNumber";
import { getDiscountedPrice } from "@/config/siteConfig";
import {
  CustomDataGrid,
  resolveSelectedRowIds,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import { buildCsv, downloadCsv, fetchAllPages } from "@/lib/csv";
import ConfirmModal from "@/components/ConfirmModal";
import type { AdminComboProduct, AdminVariant } from "@/types/admin";

interface FormValues {
  title: string;
  description: string;
  price: string;
  discountPercent: string;
  image: string;
  noExpiry: boolean;
  expiresAt: string;
  showExpiryBadge: boolean;
  variants: AdminVariant[];
}

const EMPTY_FORM: FormValues = {
  title: "",
  description: "",
  price: "",
  discountPercent: "",
  image: "",
  noExpiry: true,
  expiresAt: "",
  showExpiryBadge: false,
  variants: [],
};

const validationSchema = Yup.object({
  title: Yup.string().trim().required("عنوان الزامی است"),
  description: Yup.string(),
  price: Yup.number().typeError("قیمت باید عدد باشد").min(0, "قیمت نمی‌تواند منفی باشد"),
  discountPercent: Yup.number()
    .typeError("درصد تخفیف باید عدد باشد")
    .min(0, "حداقل صفر")
    .max(100, "حداکثر ۱۰۰"),
  expiresAt: Yup.string().when("noExpiry", {
    is: false,
    then: (schema) => schema.required("تاریخ و ساعت انقضا را وارد کنید"),
  }),
  variants: Yup.array().of(
    Yup.object({
      title: Yup.string(),
      price: Yup.number()
        .typeError("قیمت باید عدد باشد")
        .min(0, "قیمت نمی‌تواند منفی باشد"),
    }),
  ),
});

/** Converts a <input type="datetime-local"> value (browser-local, no timezone) into a UTC ISO string. */
function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Converts a stored ISO datetime back into the format <input type="datetime-local"> expects. */
function isoToLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatExpiry(value: string | null | undefined): string {
  if (!value) return "بدون تاریخ انقضا";
  const d = new Date(value);
  const isExpired = d.getTime() <= Date.now();
  const label = `${d.toLocaleDateString("fa-IR")} — ${d.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  return isExpired ? `منقضی‌شده (${label})` : `تا ${label}`;
}

function AdminComboPage() {
  const [items, setItems] = useState<AdminComboProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingItem, setDeletingItem] = useState<AdminComboProduct | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(
    { type: "include", ids: new Set() },
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectedIds = useMemo(
    () => resolveSelectedRowIds(selectionModel, items.map((i) => i.id)),
    [selectionModel, items],
  );

  const fetchItems = () =>
    adminGetComboProducts(page, pageSize, debouncedSearch).then((res) => {
      setItems(res.items);
      setTotal(res.total);
    });

  const load = () => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
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
    fetchItems().finally(() => setLoading(false));
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
          title: values.title.trim(),
          description: values.description.trim(),
          price: Number(values.price) || 0,
          discountPercent: values.discountPercent ? Number(values.discountPercent) : null,
          images: values.image ? [values.image] : [],
          comboExpiresAt: values.noExpiry ? null : localDateTimeToIso(values.expiresAt),
          comboShowExpiryBadge: !values.noExpiry && values.showExpiryBadge,
          variants: values.variants
            .filter((v) => v.title.trim())
            .map((v) => ({
              title: v.title.trim(),
              description: v.description?.trim() || undefined,
              price: Number(v.price) || 0,
              stock:
                v.stock != null && v.stock !== ("" as unknown) ? Number(v.stock) : undefined,
              image: v.image || undefined,
            })),
        };
        if (editingId) {
          await adminUpdateComboProduct(editingId, payload);
        } else {
          await adminCreateComboProduct(payload);
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

  const startEdit = (item: AdminComboProduct) => {
    setEditingId(item.id);
    formik.resetForm({
      values: {
        title: item.title,
        description: item.description,
        price: String(item.price),
        discountPercent: item.discountPercent ? String(item.discountPercent) : "",
        image: item.images[0] ?? "",
        noExpiry: !item.comboExpiresAt,
        expiresAt: isoToLocalDateTime(item.comboExpiresAt),
        showExpiryBadge: !!item.comboShowExpiryBadge,
        variants: item.variants,
      },
    });
    setError(null);
  };

  const addVariant = () => {
    formik.setFieldValue("variants", [
      ...formik.values.variants,
      { title: "", description: "", price: 0 },
    ]);
  };

  const updateVariant = (index: number, patch: Partial<AdminVariant>) => {
    formik.setFieldValue(
      "variants",
      formik.values.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );
  };

  const removeVariant = (index: number) => {
    formik.setFieldValue(
      "variants",
      formik.values.variants.filter((_, i) => i !== index),
    );
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
      await adminDeleteComboProduct(id);
      if (editingId === id) startCreate();
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف کمبو");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await adminBulkDeleteComboProducts(selectedIds);
      if (editingId && selectedIds.includes(editingId)) startCreate();
      setSelectionModel({ type: "include", ids: new Set() });
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const columns = useMemo<GridColDef<AdminComboProduct>[]>(
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
          row.images[0] ? (
            <div className="flex h-full w-full items-center justify-center">
              <img
                src={apiUploadUrl(row.images[0])}
                alt=""
                className="h-9 w-9 rounded-lg border border-sand-100 object-cover"
              />
            </div>
          ) : null,
      },
      { field: "title", headerName: "عنوان", flex: 1, minWidth: 160 },
      {
        field: "price",
        headerName: "قیمت",
        width: 170,
        valueGetter: (_, row) =>
          row.discountPercent ? getDiscountedPrice(row.price, row.discountPercent) : row.price,
        renderCell: ({ row }) =>
          row.discountPercent ? (
            <div className="flex h-full items-baseline gap-1.5">
              <span className="text-xs text-cocoa-400 line-through">
                {row.price.toLocaleString("fa-IR")}
              </span>
              <span className="font-semibold text-sand-500">
                {getDiscountedPrice(row.price, row.discountPercent).toLocaleString("fa-IR")}
              </span>
            </div>
          ) : (
            `${row.price.toLocaleString("fa-IR")} تومان`
          ),
      },
      {
        field: "variants",
        headerName: "انواع کمبو",
        valueGetter: (_, row) => (row.variants.length > 0 ? "دارد" : "ندارد"),
      },
      {
        field: "comboExpiresAt",
        headerName: "انقضا",
        width: 200,
        valueGetter: (_, row) => formatExpiry(row.comboExpiresAt),
        renderCell: ({ row }) => {
          const isExpired =
            !!row.comboExpiresAt && new Date(row.comboExpiresAt).getTime() <= Date.now();
          return (
            <span className={isExpired ? "font-semibold text-danger-500" : "text-cocoa-600"}>
              {formatExpiry(row.comboExpiresAt)}
            </span>
          );
        },
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
              onClick={() => startEdit(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="ویرایش"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingItem(row)}
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
    const all = await fetchAllPages((p, ps) => adminGetComboProducts(p, ps, debouncedSearch));
    downloadCsv("combo.csv", buildCsv(columns, all));
  }, [columns, debouncedSearch]);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">کمبو</h1>
      <p className="mt-1 text-sm text-cocoa-500">
        محصولاتی که در بخش «کمبو» زیر «آیتم‌های جدید» در صفحه اصلی سایت نمایش داده می‌شوند —
        نه در صفحه منو، چون کتگوری خاصی ندارند. وقتی هیچ کمبوی فعالی نباشد، کل این بخش
        (همراه با تیترش) از صفحه اصلی برداشته می‌شود.
      </p>

      <form
        onSubmit={formik.handleSubmit}
        className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-cocoa-900">
            {editingId ? "ویرایش کمبو" : "افزودن کمبوی جدید"}
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
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">عنوان</label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.title && formik.errors.title && (
              <p className="mt-1 text-xs font-semibold text-danger-500">{formik.errors.title}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              قیمت (تومان)
            </label>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              name="price"
              value={formatThousands(formik.values.price)}
              onChange={(e) => formik.setFieldValue("price", digitsOnly(e.target.value))}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.price && formik.errors.price && (
              <p className="mt-1 text-xs font-semibold text-danger-500">{formik.errors.price}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              درصد تخفیف (اختیاری)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              name="discountPercent"
              value={formik.values.discountPercent}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.discountPercent && formik.errors.discountPercent && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.discountPercent}
              </p>
            )}
            {!!Number(formik.values.discountPercent) && !!Number(formik.values.price) && (
              <p className="mt-1.5 flex items-baseline gap-1.5 text-xs">
                <span className="text-cocoa-400 line-through">
                  {Number(formik.values.price).toLocaleString("fa-IR")}
                </span>
                <span className="font-bold text-sand-500">
                  {getDiscountedPrice(
                    Number(formik.values.price),
                    Number(formik.values.discountPercent),
                  ).toLocaleString("fa-IR")}{" "}
                  تومان
                </span>
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              توضیح (اختیاری)
            </label>
            <input
              name="description"
              value={formik.values.description}
              onChange={formik.handleChange}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">تصویر</label>
            <div className="flex items-center gap-3">
              {formik.values.image && (
                <img
                  src={apiUploadUrl(formik.values.image)}
                  alt=""
                  className="h-12 w-12 rounded-xl border border-sand-100 object-cover"
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

          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-cocoa-600">
              <CalendarClock className="h-3.5 w-3.5 text-sand-500" />
              مدت نمایش در صفحه اصلی
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-cocoa-700">
              <input
                type="checkbox"
                checked={formik.values.noExpiry}
                onChange={(e) => {
                  const checked = e.target.checked;
                  formik.setFieldValue("noExpiry", checked);
                  if (checked) formik.setFieldValue("showExpiryBadge", false);
                }}
                className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
              />
              بدون تاریخ انقضا — تا زمانی که خودم حذفش کنم
            </label>
            {!formik.values.noExpiry && (
              <div className="mt-2">
                <input
                  type="datetime-local"
                  dir="ltr"
                  name="expiresAt"
                  value={formik.values.expiresAt}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="w-full max-w-xs rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400 sm:w-auto"
                />
                {formik.touched.expiresAt && formik.errors.expiresAt && (
                  <p className="mt-1 text-xs font-semibold text-danger-500">
                    {formik.errors.expiresAt}
                  </p>
                )}
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-cocoa-700">
                  <input
                    type="checkbox"
                    checked={formik.values.showExpiryBadge}
                    onChange={(e) => formik.setFieldValue("showExpiryBadge", e.target.checked)}
                    className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
                  />
                  نمایش برچسب «چند روز مانده» روی کارت کمبو (گوشه‌ی بالا-چپ)
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-cocoa-600">
              انواع کمبو (اختیاری — مثلاً سایزهای مختلف)
            </label>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-1 text-xs font-bold text-sand-500 hover:text-sand-600"
            >
              <Plus className="h-3.5 w-3.5" /> افزودن نوع
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {formik.values.variants.map((v, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-sand-100 p-2.5">
                <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <input
                    placeholder="عنوان"
                    value={v.title}
                    onChange={(e) => updateVariant(i, { title: e.target.value })}
                    className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="قیمت"
                    value={v.price ? formatThousands(String(v.price)) : ""}
                    onChange={(e) =>
                      updateVariant(i, { price: Number(digitsOnly(e.target.value)) || 0 })
                    }
                    className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-danger-500 transition hover:bg-danger-50"
                    aria-label="حذف نوع"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  placeholder="توضیحات این نوع (اختیاری)"
                  value={v.description ?? ""}
                  onChange={(e) => updateVariant(i, { description: e.target.value })}
                  className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="mt-4 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {formik.isSubmitting ? "در حال ذخیره…" : editingId ? "ذخیره تغییرات" : "افزودن کمبو"}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminComboProduct>
          rows={items}
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
          exportFileName="combo"
          onExportAll={handleExportAll}
          bulkDeleteLabel="حذف گروهی کمبوها"
          sx={{ border: "none", height: 600 }}
        />
      </div>

      <ConfirmModal
        isOpen={!!deletingItem}
        title="حذف کمبو"
        description={
          deletingItem ? `آیا مطمئنید می‌خواهید «${deletingItem.title}» را حذف کنید؟` : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() => (deletingItem ? handleDelete(deletingItem.id) : undefined)}
        onClose={() => setDeletingItem(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی کمبوها"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} کمبو را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

export default AdminComboPage;
