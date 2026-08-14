"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
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
import AdminPagination from "@/components/AdminPagination";
import ConfirmModal from "@/components/ConfirmModal";
import type { AdminCategory, AdminProduct, AdminVariant } from "@/types/admin";

const PAGE_SIZE = 10;

interface FormState {
  categoryId: string;
  title: string;
  description: string;
  price: string;
  images: string[];
  weight: string;
  ingredients: string;
  servingSize: string;
  discountPercent: string;
  stock: string;
  isNew: boolean;
  sortOrder: string;
  variants: AdminVariant[];
}

const EMPTY_FORM: FormState = {
  categoryId: "",
  title: "",
  description: "",
  price: "0",
  images: [],
  weight: "",
  ingredients: "",
  servingSize: "",
  discountPercent: "",
  stock: "",
  isNew: false,
  sortOrder: "0",
  variants: [],
};

function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<AdminProduct | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = () =>
    Promise.all([adminGetProducts(page, PAGE_SIZE), adminGetAllCategories()]).then(([p, c]) => {
      setProducts(p.items);
      setTotalPages(p.totalPages);
      setTotal(p.total);
      setCategories(c);
      setForm((f) => (f.categoryId ? f : { ...f, categoryId: c[0]?.id ?? "" }));
    });

  const load = () => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [page]);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setError(null);
  };

  const startEdit = (p: AdminProduct) => {
    setEditingId(p.id);
    setForm({
      categoryId: p.categoryId,
      title: p.title,
      description: p.description,
      price: String(p.price),
      images: p.images,
      weight: p.weight ?? "",
      ingredients: p.ingredients ?? "",
      servingSize: p.servingSize ?? "",
      discountPercent: p.discountPercent != null ? String(p.discountPercent) : "",
      stock: p.stock != null ? String(p.stock) : "",
      isNew: p.isNew,
      sortOrder: String(p.sortOrder),
      variants: p.variants,
    });
    setError(null);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await adminUploadImage(file);
      setForm((f) => ({ ...f, images: [...f.images, url] }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  };

  const addVariant = () => {
    setForm((f) => ({ ...f, variants: [...f.variants, { title: "", price: 0 }] }));
  };

  const updateVariant = (index: number, patch: Partial<AdminVariant>) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  const removeVariant = (index: number) => {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.categoryId) {
      setError("ابتدا یک دسته‌بندی ایجاد کنید");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        categoryId: form.categoryId,
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price) || 0,
        images: form.images,
        weight: form.weight.trim() || undefined,
        ingredients: form.ingredients.trim() || undefined,
        servingSize: form.servingSize.trim() || undefined,
        discountPercent: form.discountPercent ? Number(form.discountPercent) : undefined,
        stock: form.stock ? Number(form.stock) : undefined,
        isNew: form.isNew,
        sortOrder: Number(form.sortOrder) || 0,
        variants: form.variants
          .filter((v) => v.title.trim())
          .map((v) => ({
            title: v.title.trim(),
            price: Number(v.price) || 0,
            weight: v.weight || undefined,
            stock: v.stock != null && v.stock !== ("" as unknown) ? Number(v.stock) : undefined,
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
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await adminDeleteProduct(id);
    if (editingId === id) startCreate();
    if (products.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">محصولات</h1>

      <form onSubmit={handleSubmit} className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5">
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
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">عنوان</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">دسته‌بندی</label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">توضیحات</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">قیمت پایه (تومان)</label>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">درصد تخفیف</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">موجودی</label>
            <input
              type="number"
              min={0}
              placeholder="خالی = بدون محدودیت"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">وزن</label>
            <input
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">مواد اولیه</label>
            <input
              value={form.ingredients}
              onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">سایز سرو</label>
            <input
              value={form.servingSize}
              onChange={(e) => setForm((f) => ({ ...f, servingSize: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">ترتیب نمایش</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-cocoa-700">
            <input
              type="checkbox"
              checked={form.isNew}
              onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))}
              className="h-4 w-4 rounded border-cocoa-900/20"
            />
            نمایش در «آیتم‌های جدید»
          </label>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-cocoa-600">تصاویر</label>
          <div className="flex flex-wrap items-center gap-3">
            {form.images.map((img, i) => (
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
            {form.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 rounded-xl border border-sand-100 p-2.5">
                <input
                  placeholder="عنوان"
                  value={v.title}
                  onChange={(e) => updateVariant(i, { title: e.target.value })}
                  className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                />
                <input
                  type="number"
                  placeholder="قیمت"
                  value={v.price}
                  onChange={(e) => updateVariant(i, { price: Number(e.target.value) })}
                  className="rounded-lg border border-cocoa-900/10 px-2.5 py-2 text-xs outline-none focus:border-sand-400"
                />
                <input
                  placeholder="وزن"
                  value={v.weight ?? ""}
                  onChange={(e) => updateVariant(i, { weight: e.target.value })}
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
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {submitting ? "در حال ذخیره…" : editingId ? "ذخیره تغییرات" : "افزودن محصول"}
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-sand-100 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="border-b border-sand-100 text-xs font-bold text-cocoa-500">
            <tr>
              <th className="p-3">تصویر</th>
              <th className="p-3">عنوان</th>
              <th className="p-3">دسته‌بندی</th>
              <th className="p-3">قیمت</th>
              <th className="p-3">موجودی</th>
              <th className="p-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-cocoa-500">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-cocoa-500">
                  محصولی ثبت نشده است
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-sand-50 last:border-0">
                  <td className="p-3">
                    {p.images[0] && (
                      <img
                        src={apiUploadUrl(p.images[0])}
                        alt=""
                        className="h-9 w-9 rounded-lg border border-sand-100 object-cover"
                      />
                    )}
                  </td>
                  <td className="p-3 font-semibold text-cocoa-900">{p.title}</td>
                  <td className="p-3 text-cocoa-600">{p.category?.title ?? "—"}</td>
                  <td className="p-3 text-cocoa-600">
                    {p.price > 0 ? `${p.price.toLocaleString("fa-IR")} تومان` : "به‌زودی"}
                  </td>
                  <td className="p-3 text-cocoa-600">{p.stock ?? "نامحدود"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
                        aria-label="ویرایش"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingProduct(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 transition hover:bg-danger-50"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <ConfirmModal
        isOpen={!!deletingProduct}
        title="حذف محصول"
        description={
          deletingProduct ? `آیا مطمئنید می‌خواهید محصول «${deletingProduct.title}» را حذف کنید؟` : undefined
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
