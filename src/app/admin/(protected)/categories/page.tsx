"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  ApiError,
  adminCreateCategory,
  adminDeleteCategory,
  adminGetCategories,
  adminUpdateCategory,
  adminUploadImage,
  apiUploadUrl,
} from "@/lib/api";
import type { AdminCategory, CategoryTabId } from "@/types/admin";

const TAB_LABELS: Record<CategoryTabId, string> = {
  bakery: "نان و شیرینی",
  drinks: "نوشیدنی",
};

interface FormState {
  slug: string;
  tab: CategoryTabId;
  title: string;
  image: string;
  note: string;
  sortOrder: string;
}

const EMPTY_FORM: FormState = { slug: "", tab: "bakery", title: "", image: "", note: "", sortOrder: "0" };

function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = () => adminGetCategories().then(setCategories);

  const load = () => {
    setLoading(true);
    fetchCategories().finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories().finally(() => setLoading(false));
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const startEdit = (cat: AdminCategory) => {
    setEditingId(cat.id);
    setForm({
      slug: cat.slug,
      tab: cat.tab,
      title: cat.title,
      image: cat.image ?? "",
      note: cat.note ?? "",
      sortOrder: String(cat.sortOrder),
    });
    setError(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await adminUploadImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        slug: form.slug.trim(),
        tab: form.tab,
        title: form.title.trim(),
        image: form.image || undefined,
        note: form.note.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editingId) {
        await adminUpdateCategory(editingId, payload);
      } else {
        await adminCreateCategory(payload);
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
    if (!confirm("این دسته‌بندی و همه محصولات آن حذف شود؟")) return;
    await adminDeleteCategory(id);
    if (editingId === id) startCreate();
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-cocoa-900">دسته‌بندی‌ها</h1>
      </div>

      <form
        onSubmit={handleSubmit}
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
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">عنوان</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">اسلاگ (شناسه یکتا)</label>
            <input
              required
              dir="ltr"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">گروه</label>
            <select
              value={form.tab}
              onChange={(e) => setForm((f) => ({ ...f, tab: e.target.value as CategoryTabId }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            >
              <option value="bakery">نان و شیرینی</option>
              <option value="drinks">نوشیدنی</option>
            </select>
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">توضیح (اختیاری)</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">تصویر آیکون</label>
            <div className="flex items-center gap-3">
              {form.image && (
                <img
                  src={apiUploadUrl(form.image)}
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

        {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {submitting ? "در حال ذخیره…" : editingId ? "ذخیره تغییرات" : "افزودن دسته‌بندی"}
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-sand-100 bg-white">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="border-b border-sand-100 text-xs font-bold text-cocoa-500">
            <tr>
              <th className="p-3">تصویر</th>
              <th className="p-3">عنوان</th>
              <th className="p-3">گروه</th>
              <th className="p-3">تعداد محصولات</th>
              <th className="p-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-cocoa-500">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-cocoa-500">
                  دسته‌بندی‌ای ثبت نشده است
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-sand-50 last:border-0">
                  <td className="p-3">
                    {cat.image && (
                      <img
                        src={apiUploadUrl(cat.image)}
                        alt=""
                        className="h-9 w-9 rounded-full border border-sand-100 object-cover"
                      />
                    )}
                  </td>
                  <td className="p-3 font-semibold text-cocoa-900">{cat.title}</td>
                  <td className="p-3 text-cocoa-600">{TAB_LABELS[cat.tab]}</td>
                  <td className="p-3 text-cocoa-600">{cat._count?.products ?? 0}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
                        aria-label="ویرایش"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
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
    </div>
  );
}

export default AdminCategoriesPage;
