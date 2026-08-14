"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Truck } from "lucide-react";
import { ApiError, adminGetSettings, adminUpdateSettings } from "@/lib/api";

interface FormState {
  shippingCostUpTo5Km: string;
  shippingCostOver5Km: string;
}

const EMPTY_FORM: FormState = { shippingCostUpTo5Km: "0", shippingCostOver5Km: "0" };

function AdminSettingsPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    adminGetSettings()
      .then((s) =>
        setForm({
          shippingCostUpTo5Km: String(s.shippingCostUpTo5Km),
          shippingCostOver5Km: String(s.shippingCostOver5Km),
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await adminUpdateSettings({
        shippingCostUpTo5Km: Number(form.shippingCostUpTo5Km) || 0,
        shippingCostOver5Km: Number(form.shippingCostOver5Km) || 0,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">تنظیمات</h1>

      <form
        onSubmit={handleSubmit}
        className="mt-4 max-w-xl rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-cocoa-900">
          <Truck className="h-4.5 w-4.5 text-sand-500" />
          هزینه ارسال بر اساس فاصله از فلوریش
        </h2>
        <p className="mt-1 text-xs text-cocoa-500">
          هزینه ارسال بر اساس فاصله آدرس تحویل مشتری تا کافه فلوریش محاسبه می‌شود.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-cocoa-500">در حال بارگذاری…</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                هزینه ارسال تا ۵ کیلومتر (تومان)
              </label>
              <input
                type="number"
                min={0}
                value={form.shippingCostUpTo5Km}
                onChange={(e) => setForm((f) => ({ ...f, shippingCostUpTo5Km: e.target.value }))}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                هزینه ارسال بیشتر از ۵ کیلومتر (تومان)
              </label>
              <input
                type="number"
                min={0}
                value={form.shippingCostOver5Km}
                onChange={(e) => setForm((f) => ({ ...f, shippingCostOver5Km: e.target.value }))}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}
        {success && <p className="mt-3 text-xs font-semibold text-sand-500">تغییرات ذخیره شد</p>}

        <button
          type="submit"
          disabled={submitting || loading}
          className="mt-4 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {submitting ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
      </form>
    </div>
  );
}

export default AdminSettingsPage;
