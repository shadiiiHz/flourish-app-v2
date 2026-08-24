"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { FileUp, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {
  ApiError,
  adminBulkDeleteProducts,
  adminBulkImportProducts,
  adminCreateProduct,
  adminDeleteProduct,
  adminGetAllCategories,
  adminGetProducts,
  adminUpdateProduct,
  adminUploadImage,
  apiUploadUrl,
  revalidateCatalog,
  type BulkImportResult,
} from "@/lib/api";
import { buildCsv, downloadCsv, fetchAllPages } from "@/lib/csv";
import {
  CustomDataGrid,
  resolveSelectedRowIds,
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
  isAvailable: boolean;
  allowPreorder: boolean;
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
  isAvailable: true,
  allowPreorder: true,
  sortOrder: "",
  variants: [],
};

function parseWeight(weight: string | null | undefined): {
  weightValue: string;
  weightUnit: WeightUnit;
} {
  if (!weight) return { weightValue: "", weightUnit: "گرم" };
  const match = weight.match(/[\d.]+/);
  return {
    weightValue: match ? match[0] : "",
    weightUnit: weight.includes("کیلو") ? "کیلوگرم" : "گرم",
  };
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
  ingredients: Yup.string().trim(),
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
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportResult, setBulkImportResult] =
    useState<BulkImportResult | null>(null);
  const bulkImportFileInputRef = useRef<HTMLInputElement>(null);
  const selectedIds = useMemo(
    () =>
      resolveSelectedRowIds(
        selectionModel,
        products.map((p) => p.id),
      ),
    [selectionModel, products],
  );

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
          categoryId: values.categoryId,
          title: values.title.trim(),
          description: values.description.trim(),
          price: Number(values.price) || 0,
          images: values.images,
          weight: String(values.weightValue).trim()
            ? `${String(values.weightValue).trim()} ${values.weightUnit}`
            : undefined,
          ingredients: values.ingredients.trim() || undefined,
          servingSize: values.servingSize.trim() || undefined,
          discountPercent: values.discountPercent
            ? Number(values.discountPercent)
            : undefined,
          stock: values.stock ? Number(values.stock) : null,
          isNew: values.isNew,
          isAvailable: values.isAvailable,
          allowPreorder: values.allowPreorder,
          sortOrder: Number(values.sortOrder) || 0,
          variants: values.variants
            .filter((v) => v.title.trim())
            .map((v) => ({
              title: v.title.trim(),
              description: v.description?.trim() || undefined,
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
        stock: p.isAvailable ? (p.stock != null ? String(p.stock) : "") : "0",
        isNew: p.isNew,
        isAvailable: p.isAvailable,
        allowPreorder: p.allowPreorder,
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
      { title: "", description: "", price: 0 },
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
    try {
      await adminDeleteProduct(id);
      if (editingId === id) startCreate();
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف محصول");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await adminBulkDeleteProducts(selectedIds);
      if (editingId && selectedIds.includes(editingId)) startCreate();
      setSelectionModel({ type: "include", ids: new Set() });
      load();
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const openBulkImport = () => {
    setBulkImportFile(null);
    setBulkImportError(null);
    setBulkImportResult(null);
    setBulkImportOpen(true);
  };

  const closeBulkImport = () => {
    setBulkImportOpen(false);
    setBulkImportFile(null);
    setBulkImportError(null);
    setBulkImportResult(null);
  };

  const handleBulkImportSubmit = async () => {
    if (!bulkImportFile) return;
    setBulkImportLoading(true);
    setBulkImportError(null);
    setBulkImportResult(null);
    try {
      const result = await adminBulkImportProducts(bulkImportFile);
      setBulkImportResult(result);
      if (result.createdCount > 0) {
        load();
        revalidateCatalog();
      }
    } catch (err) {
      setBulkImportError(
        err instanceof ApiError ? err.message : "خطا در آپلود فایل",
      );
    } finally {
      setBulkImportLoading(false);
    }
  };

  const downloadSampleCsv = () => {
    const exampleCategory = categories[0]?.title ?? "نوشیدنی";
    const header = [
      "عنوان",
      "دسته‌بندی",
      "قیمت",
      "توضیحات",
      "وزن",
      "ترکیبات",
      "مناسب برای",
      "درصد تخفیف",
      "موجودی",
      "جدید",
      "موجود",
      "پیش‌سفارش",
      "انواع محصول",
    ];
    const example = [
      "لاته وانیل",
      exampleCategory,
      "120000",
      "قهوه با شیر و شربت وانیل",
      "",
      "قهوه، شیر، شربت وانیل",
      "۱ نفر",
      "0",
      "",
      "بله",
      "بله",
      "بله",
      "کوچک:100000:200 گرم:15;بزرگ:130000:350 گرم:10",
    ];
    // Only quote a field when it actually contains the delimiter, a quote, or a
    // newline — RFC4180 escaping is the exception, not the default, so a
    // manually-edited row normally never needs quotes at all.
    const csvField = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = `${header.map(csvField).join(",")}\n${example.map(csvField).join(",")}\n`;
    const blob = new Blob([String.fromCharCode(0xfeff) + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "نمونه-محصولات.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryTitleById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.title])),
    [categories],
  );

  const categorySlugById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.slug])),
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
        field: "isAvailable",
        headerName: "وضعیت",
        width: 110,
        align: "center",
        headerAlign: "center",
        valueFormatter: (_, row) => (row.isAvailable ? "موجود" : "ناموجود"),
        renderCell: ({ row }) => (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              row.isAvailable
                ? "bg-sand-50 text-sand-500"
                : "bg-danger-50 text-danger-500"
            }`}
          >
            {row.isAvailable ? "موجود" : "ناموجود"}
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

  // Separate from the on-screen `columns` above: this is the exact column set
  // "آپلود گروهی محصولات" (POST /api/admin/products/bulk-import) expects, so
  // exporting the table and re-uploading the file works as a round-trip.
  const csvExportColumns = useMemo<GridColDef<AdminProduct>[]>(
    () => [
      { field: "title", headerName: "عنوان", valueGetter: (_, row) => row.title },
      {
        field: "category",
        headerName: "دسته‌بندی",
        valueGetter: (_, row) => row.category?.slug ?? categorySlugById.get(row.categoryId) ?? "",
      },
      { field: "price", headerName: "قیمت", valueGetter: (_, row) => row.price },
      {
        field: "discountPercent",
        headerName: "درصد تخفیف",
        valueGetter: (_, row) => row.discountPercent ?? "",
      },
      { field: "weight", headerName: "وزن", valueGetter: (_, row) => row.weight ?? "" },
      {
        field: "variants",
        headerName: "انواع محصول",
        valueGetter: (_, row) =>
          row.variants
            .map((v) => [v.title, v.price, v.weight ?? "", v.stock ?? ""].join(":"))
            .join(";"),
      },
      { field: "description", headerName: "توضیحات", valueGetter: (_, row) => row.description ?? "" },
      { field: "ingredients", headerName: "ترکیبات", valueGetter: (_, row) => row.ingredients ?? "" },
      {
        field: "servingSize",
        headerName: "مناسب برای",
        valueGetter: (_, row) => row.servingSize ?? "",
      },
      { field: "stock", headerName: "موجودی", valueGetter: (_, row) => row.stock ?? "" },
      { field: "isNew", headerName: "جدید", valueGetter: (_, row) => (row.isNew ? "بله" : "خیر") },
      {
        field: "isAvailable",
        headerName: "موجود",
        valueGetter: (_, row) => (row.isAvailable ? "بله" : "خیر"),
      },
      {
        field: "allowPreorder",
        headerName: "پیش‌سفارش",
        valueGetter: (_, row) => (row.allowPreorder ? "بله" : "خیر"),
      },
    ],
    [categorySlugById],
  );

  const handleExportAll = useCallback(async () => {
    const all = await fetchAllPages((p, ps) => adminGetProducts(p, ps, debouncedSearch));
    downloadCsv("products.csv", buildCsv(csvExportColumns, all));
  }, [csvExportColumns, debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-cocoa-900">
          محصولات
        </h1>
        <button
          type="button"
          onClick={openBulkImport}
          className="flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-4 py-2.5 text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
        >
          <FileUp className="h-4 w-4 text-sand-500" />
          آپلود گروهی
        </button>
      </div>

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
              onChange={(e) => {
                const value = e.target.value;
                formik.setFieldValue("stock", value);
                if (value !== "" && Number(value) === 0) {
                  formik.setFieldValue("isAvailable", false);
                }
              }}
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
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-cocoa-700">
              <input
                type="checkbox"
                name="isAvailable"
                checked={formik.values.isAvailable}
                disabled={formik.values.stock !== "" && Number(formik.values.stock) === 0}
                onChange={(e) => {
                  const checked = e.target.checked;
                  formik.setFieldValue("isAvailable", checked);
                  if (!checked) formik.setFieldValue("stock", "0");
                }}
                className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              موجود و قابل سفارش در سایت
            </label>
            {formik.values.stock !== "" && Number(formik.values.stock) === 0 && (
              <p className="mt-1 text-xs text-cocoa-500">
                موجودی صفره — برای فعال کردن این گزینه، اول یه عدد بزرگ‌تر از صفر یا خالی (بدون محدودیت) برای موجودی وارد کنید.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-cocoa-700">
            <input
              type="checkbox"
              name="allowPreorder"
              checked={formik.values.allowPreorder}
              onChange={formik.handleChange}
              className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
            />
            قابل پیش‌سفارش
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
                className="flex flex-col gap-2 rounded-xl border border-sand-100 p-2.5"
              >
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                  <input
                    placeholder="عنوان"
                    value={v.title}
                    onChange={(e) =>
                      updateVariant(i, { title: e.target.value })
                    }
                    className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="قیمت"
                    value={v.price ? formatThousands(String(v.price)) : ""}
                    onChange={(e) =>
                      updateVariant(i, {
                        price: Number(digitsOnly(e.target.value)) || 0,
                      })
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
                        updateVariant(i, {
                          weight: e.target.value
                            ? `${e.target.value} ${unit}`
                            : "",
                        });
                      }}
                      className="w-full rounded-lg border border-cocoa-900/10 px-2 py-2 text-xs outline-none focus:border-sand-400"
                    />
                    <select
                      value={parseWeight(v.weight).weightUnit}
                      onChange={(e) => {
                        const value = parseWeight(v.weight).weightValue;
                        updateVariant(i, {
                          weight: value ? `${value} ${e.target.value}` : "",
                        });
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
                <input
                  placeholder="توضیحات این نوع (اختیاری)"
                  value={v.description ?? ""}
                  onChange={(e) =>
                    updateVariant(i, { description: e.target.value })
                  }
                  className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                />
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
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          selectedCount={selectedIds.length}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          exportColumns={csvExportColumns}
          exportFileName="products"
          onExportAll={handleExportAll}
          bulkDeleteLabel="حذف گروهی محصولات"
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
        onConfirm={() =>
          deletingProduct ? handleDelete(deletingProduct.id) : undefined
        }
        onClose={() => setDeletingProduct(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی محصولات"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} محصول را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

      <Dialog
        open={bulkImportOpen}
        onClose={closeBulkImport}
        maxWidth="sm"
        fullWidth
        dir="rtl"
        scroll="body"
        sx={{
          "& .MuiDialog-container": {
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(74,44,18,0.25) transparent",
            "&::-webkit-scrollbar": { width: 8 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              backdropFilter: "blur(4px)",
              borderRadius: 999,
            },
          },
        }}
      >
        <DialogTitle className="flex items-center justify-between gap-3 font-display text-cocoa-900">
          آپلود گروهی محصولات
          <button
            type="button"
            onClick={closeBulkImport}
            aria-label="بستن"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cocoa-500 transition hover:bg-sand-50 hover:text-cocoa-700"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </DialogTitle>
        <DialogContent dividers>
          <p className="text-xs leading-6 text-cocoa-600">
            یک فایل CSV با ستون‌های زیر آپلود کنید: عنوان، دسته‌بندی، قیمت،
            توضیحات، وزن، ترکیبات، مناسب برای، درصد تخفیف، موجودی، جدید، موجود،
            پیش‌سفارش، انواع محصول. فقط عنوان، دسته‌بندی و قیمت الزامی هستند.
            تصویر محصولات از طریق این فایل قابل افزودن نیست — بعد از آپلود، از
            فرم ویرایش هر محصول اضافه کنید. ستون وزن (چه برای خود محصول چه برای
            انواع آن) فقط به شکل «عدد گرم» یا «عدد کیلوگرم» پذیرفته می‌شود،
            مثلاً «۲۵۰ گرم». نیازی به گذاشتن دورنویس (") دور مقادیر نیست — فقط
            مقداری که خودش شامل ویرگول انگلیسی (,) باشد باید داخل دورنویس نوشته
            شود.
          </p>
          <p className="mt-2 text-xs leading-6 text-cocoa-600">
            برای «انواع محصول» (مثل سایزهای مختلف)، هر نوع را به شکل
            <span dir="ltr" className="mx-1 font-mono">
              عنوان:قیمت:وزن:موجودی
            </span>
            بنویسید و انواع مختلف را با{" "}
            <span dir="ltr" className="font-mono">
              ;
            </span>
            از هم جدا کنید — وزن و موجودی اختیاری هستند. مثال:
            <span dir="ltr" className="mx-1 font-mono">
              کوچک:100000:200 گرم:15;بزرگ:130000:350 گرم:10
            </span>
          </p>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="mt-3 text-xs font-bold text-sand-500 hover:text-sand-600"
          >
            دانلود نمونه CSV
          </button>

          <div className="mt-4 flex items-center gap-3">
            <input
              ref={bulkImportFileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                setBulkImportFile(e.target.files?.[0] ?? null);
                setBulkImportResult(null);
                setBulkImportError(null);
              }}
            />
            <button
              type="button"
              onClick={() => bulkImportFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50"
            >
              <Upload className="h-3.5 w-3.5 text-sand-500" />
              انتخاب فایل
            </button>
            <span className="truncate text-xs text-cocoa-600">
              {bulkImportFile ? bulkImportFile.name : "فایلی انتخاب نشده"}
            </span>
          </div>

          {bulkImportError && (
            <p className="mt-3 text-xs font-semibold text-danger-500">
              {bulkImportError}
            </p>
          )}

          {bulkImportResult && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs font-bold text-sand-500">
                {bulkImportResult.createdCount.toLocaleString("fa-IR")} محصول با
                موفقیت اضافه شد.
              </p>
              {bulkImportResult.errors.length > 0 && (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-danger-50 p-3">
                  {bulkImportResult.errors.map((e) => (
                    <p
                      key={e.row}
                      className="text-xs font-semibold text-danger-500"
                    >
                      ردیف {e.row.toLocaleString("fa-IR")}: {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkImportSubmit}
              disabled={!bulkImportFile || bulkImportLoading}
              className="rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {bulkImportLoading ? "در حال آپلود…" : "شروع آپلود"}
            </button>
            <button
              type="button"
              onClick={closeBulkImport}
              className="rounded-full border border-sand-200 bg-white px-5 py-2.5 text-sm font-bold text-cocoa-700 transition hover:bg-sand-50"
            >
              بستن
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminProductsPage;
