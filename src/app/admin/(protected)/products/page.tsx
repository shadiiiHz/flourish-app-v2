"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { GridColDef } from "@mui/x-data-grid";
import {
  ApiError,
  adminCreateProduct,
  adminDeleteProduct,
  adminGetAllCategories,
  adminGetProducts,
  adminUpdateProduct,
  adminUploadImage,
  apiUploadUrl,
} from "@/lib/api";
import {
  CustomDataGrid,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import { digitsOnly, formatThousands } from "@/lib/formatNumber";
import ConfirmModal from "@/components/ConfirmModal";
import type { AdminCategory, AdminProduct, AdminVariant } from "@/types/admin";

type WeightUnit = "گرم" | "کیلوگرم";

interface FormValues {
  categoryId: string;
  title: string;
  description: string;
  price: string;
  images: string[];
  weightValue: string;
  weightUnit: WeightUnit;
  ingredients: string;
  servingSize: string;
  discountPercent: string;
  stock: string;
  isNew: boolean;
  sortOrder: string;
  variants: AdminVariant[];
}

const EMPTY_FORM: FormValues = {
  categoryId: "",
  title: "",
  description: "",
  price: "",
  images: [],
  weightValue: "",
  weightUnit: "گرم",
  ingredients: "",
  servingSize: "",
  discountPercent: "",
  stock: "",
  isNew: false,
  sortOrder: "",
  variants: [],
};

function parseWeight(weight: string | null | undefined): { weightValue: string; weightUnit: WeightUnit } {
  if (!weight) return { weightValue: "", weightUnit: "گرم" };
  const match = weight.match(/[\d.]+/);
  return { weightValue: match ? match[0] : "", weightUnit: weight.includes("کیلو") ? "کیلوگرم" : "گرم" };
}

const validationSchema = Yup.object({
  categoryId: Yup.string().required("ابتدا یک دسته‌بندی ایجاد کنید"),
  title: Yup.string().trim().required("عنوان الزامی است"),
  description: Yup.string().trim().required("توضیحات الزامی است"),
  price: Yup.number()
    .transform((v, orig) => (orig === "" ? undefined : v))
    .typeError("قیمت باید عدد باشد")
    .min(0, "قیمت نمی‌تواند منفی باشد")
    .required("قیمت الزامی است"),
  weightValue: Yup.number()
    .typeError("وزن باید عدد باشد")
    .min(0, "وزن نمی‌تواند منفی باشد")
    .nullable()
    .transform((v, orig) => (orig === "" ? null : v)),
  ingredients: Yup.string().trim().required("ترکیبات الزامی است"),
  servingSize: Yup.string().trim().required("مناسب برای الزامی است"),
  discountPercent: Yup.number()
    .typeError("درصد تخفیف باید عدد باشد")
    .min(0, "حداقل صفر")
    .max(100, "حداکثر ۱۰۰")
    .nullable()
    .transform((v, orig) => (orig === "" ? null : v)),
  stock: Yup.number()
    .typeError("موجودی باید عدد باشد")
    .min(0, "موجودی نمی‌تواند منفی باشد")
    .nullable()
    .transform((v, orig) => (orig === "" ? null : v)),
  sortOrder: Yup.number()
    .typeError("ترتیب نمایش باید عدد باشد")
    .min(0, "ترتیب نمایش نمی‌تواند منفی باشد"),
  variants: Yup.array().of(
    Yup.object({
      title: Yup.string(),
      price: Yup.number()
        .typeError("قیمت باید عدد باشد")
        .min(0, "قیمت نمی‌تواند منفی باشد"),
    }),
  ),
});

function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = () =>
    Promise.all([
      adminGetProducts(page, pageSize, debouncedSearch),
      adminGetAllCategories(),
    ]).then(([p, c]) => {
      setProducts(p.items);
      setTotal(p.total);
      setCategories(c);
      if (!editingId && !formik.values.categoryId) {
        formik.setFieldValue("categoryId", c[0]?.id ?? "");
      }
    });

  const load = () => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
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
    fetchAll().finally(() => setLoading(false));
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
          categoryId: values.categoryId,
          title: values.title.trim(),
          description: values.description.trim(),
          price: Number(values.price) || 0,
          images: values.images,
          weight: values.weightValue.trim() ? `${values.weightValue.trim()} ${values.weightUnit}` : undefined,
          ingredients: values.ingredients.trim() || undefined,
          servingSize: values.servingSize.trim() || undefined,
          discountPercent: values.discountPercent
            ? Number(values.discountPercent)
            : undefined,
          stock: values.stock ? Number(values.stock) : undefined,
          isNew: values.isNew,
          sortOrder: Number(values.sortOrder) || 0,
          variants: values.variants
            .filter((v) => v.title.trim())
            .map((v) => ({
              title: v.title.trim(),
              price: Number(v.price) || 0,
              weight: v.weight || undefined,
              stock:
                v.stock != null && v.stock !== ("" as unknown)
                  ? Number(v.stock)
                  : undefined,
              image: v.image || undefined,
            })),
        };

        if (editingId) {
          await adminUpdateProduct(editingId, payload);
        } else {
          await adminCreateProduct(payload);
        }
        startCreate();
        load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const startCreate = () => {
    setEditingId(null);
    formik.resetForm({
      values: { ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" },
    });
    setError(null);
  };

  const startEdit = (p: AdminProduct) => {
    setEditingId(p.id);
    formik.resetForm({
      values: {
        categoryId: p.categoryId,
        title: p.title,
        description: p.description,
        price: String(p.price),
        images: p.images,
        ...parseWeight(p.weight),
        ingredients: p.ingredients ?? "",
        servingSize: p.servingSize ?? "",
        discountPercent:
          p.discountPercent != null ? String(p.discountPercent) : "",
        stock: p.stock != null ? String(p.stock) : "",
        isNew: p.isNew,
        sortOrder: String(p.sortOrder),
        variants: p.variants,
      },
    });
    setError(null);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await adminUploadImage(file);
      formik.setFieldValue("images", [...formik.values.images, url]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    formik.setFieldValue(
      "images",
      formik.values.images.filter((_, i) => i !== index),
    );
  };

  const addVariant = () => {
    formik.setFieldValue("variants", [
      ...formik.values.variants,
      { title: "", price: 0 },
    ]);
  };

  const updateVariant = (index: number, patch: Partial<AdminVariant>) => {
    formik.setFieldValue(
      "variants",
      formik.values.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      ),
    );
  };

  const removeVariant = (index: number) => {
    formik.setFieldValue(
      "variants",
      formik.values.variants.filter((_, i) => i !== index),
    );
  };

  const handleDelete = async (id: string) => {
    await adminDeleteProduct(id);
    if (editingId === id) startCreate();
    load();
  };

  const categoryTitleById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.title])),
    [categories],
  );

  const columns = useMemo<GridColDef<AdminProduct>[]>(
    () => [
      {
        field: "images",
        headerName: "تصویر",
        width: 80,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) =>
          row.images[0] ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={apiUploadUrl(row.images[0])}
                alt=""
                className="h-12 w-12 rounded-lg border border-sand-100 object-cover"
              />
            </div>
          ) : null,
      },
      { field: "title", headerName: "عنوان", flex: 0.7, minWidth: 120 },
      {
        field: "category",
        headerName: "دسته‌بندی",
        flex: 0.5,
        minWidth: 220,
        valueGetter: (_, row) =>
          row.category?.title ?? categoryTitleById.get(row.categoryId) ?? "—",
      },
      {
        field: "price",
        headerName: "قیمت",
        width: 130,
        valueGetter: (_, row) =>
          row.price > 0
            ? `${row.price.toLocaleString("fa-IR")} تومان`
            : "به‌زودی",
      },
      {
        field: "stock",
        headerName: "موجودی",
        width: 100,
        valueGetter: (_, row) => row.stock ?? "نامحدود",
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
              onClick={() => setDeletingProduct(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 transition hover:bg-danger-50"
              aria-label="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [categoryTitleById],
  );

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">محصولات</h1>

      <form
        onSubmit={formik.handleSubmit}
        className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-cocoa-900">
            {editingId ? "ویرایش محصول" : "افزودن محصول جدید"}
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
              دسته‌بندی
            </label>
            <select
              name="categoryId"
              value={formik.values.categoryId}
              onChange={formik.handleChange}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {formik.touched.categoryId && formik.errors.categoryId && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.categoryId}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              توضیحات
            </label>
            <textarea
              name="description"
              value={formik.values.description}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              rows={2}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.description && formik.errors.description && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.description}
              </p>
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
              placeholder="0"
              name="price"
              value={formatThousands(formik.values.price)}
              onChange={(e) => formik.setFieldValue("price", digitsOnly(e.target.value))}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.price && formik.errors.price && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.price}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              درصد تخفیف
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
            {formik.touched.discountPercent &&
              formik.errors.discountPercent && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {formik.errors.discountPercent}
                </p>
              )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              موجودی
            </label>
            <input
              type="number"
              min={0}
              placeholder="خالی = بدون محدودیت"
              name="stock"
              value={formik.values.stock}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.stock && formik.errors.stock && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.stock}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              وزن
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                name="weightValue"
                value={formik.values.weightValue}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              <select
                name="weightUnit"
                value={formik.values.weightUnit}
                onChange={formik.handleChange}
                className="shrink-0 rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              >
                <option value="گرم">گرم</option>
                <option value="کیلوگرم">کیلوگرم</option>
              </select>
            </div>
            {formik.touched.weightValue && formik.errors.weightValue && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.weightValue}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              ترکیبات
            </label>
            <input
              name="ingredients"
              value={formik.values.ingredients}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.ingredients && formik.errors.ingredients && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.ingredients}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              مناسب برای
            </label>
            <input
              name="servingSize"
              value={formik.values.servingSize}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.servingSize && formik.errors.servingSize && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.servingSize}
              </p>
            )}
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
          <label className="flex items-center gap-2 text-sm font-semibold text-cocoa-700">
            <input
              type="checkbox"
              name="isNew"
              checked={formik.values.isNew}
              onChange={formik.handleChange}
              className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
            />
            نمایش در «آیتم‌های جدید»
          </label>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-cocoa-600">
            تصاویر
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {formik.values.images.map((img, i) => (
              <div key={img + i} className="relative">
                <img
                  src={apiUploadUrl(img)}
                  alt=""
                  className="h-16 w-16 rounded-xl border border-sand-100 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger-500 text-white"
                  aria-label="حذف تصویر"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-cocoa-900/15 text-cocoa-500 transition hover:border-sand-400 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              <span className="text-[10px] font-semibold">
                {uploading ? "…" : "افزودن"}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-cocoa-600">
              انواع محصول (اختیاری — مثلاً سایزهای مختلف)
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
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 rounded-xl border border-sand-100 p-2.5"
              >
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
                  value={formatThousands(String(v.price))}
                  onChange={(e) =>
                    updateVariant(i, { price: Number(digitsOnly(e.target.value)) || 0 })
                  }
                  className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={0}
                    placeholder="وزن"
                    value={parseWeight(v.weight).weightValue}
                    onChange={(e) => {
                      const unit = parseWeight(v.weight).weightUnit;
                      updateVariant(i, { weight: e.target.value ? `${e.target.value} ${unit}` : "" });
                    }}
                    className="w-full rounded-lg border border-cocoa-900/10 px-2 py-2 text-xs outline-none focus:border-sand-400"
                  />
                  <select
                    value={parseWeight(v.weight).weightUnit}
                    onChange={(e) => {
                      const value = parseWeight(v.weight).weightValue;
                      updateVariant(i, { weight: value ? `${value} ${e.target.value}` : "" });
                    }}
                    className="shrink-0 rounded-lg border border-cocoa-900/10 px-1.5 py-2 text-xs outline-none focus:border-sand-400"
                  >
                    <option value="گرم">گرم</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-danger-500 transition hover:bg-danger-50"
                  aria-label="حذف نوع"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="mt-5 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {formik.isSubmitting
            ? "در حال ذخیره…"
            : editingId
              ? "ذخیره تغییرات"
              : "افزودن محصول"}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminProduct>
          rows={products}
          rowCount={total}
          columns={columns}
          loading={loading}
          onQueryChange={handleQueryChange}
          localeText={faDataGridLocaleText}
          filterMode="client"
          sortingMode="client"
          getRowHeight={() => 64}
          sx={{ border: "none", height: 800 }}
        />
      </div>

      <ConfirmModal
        isOpen={!!deletingProduct}
        title="حذف محصول"
        description={
          deletingProduct
            ? `آیا مطمئنید می‌خواهید محصول «${deletingProduct.title}» را حذف کنید؟`
            : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() => {
          if (deletingProduct) handleDelete(deletingProduct.id);
        }}
        onClose={() => setDeletingProduct(null)}
      />
    </div>
  );
}

export default AdminProductsPage;
