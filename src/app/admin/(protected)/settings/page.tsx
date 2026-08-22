"use client";

import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { KeyRound, Store, Truck } from "lucide-react";
import { ApiError, adminChangePassword, adminGetSettings, adminUpdateSettings } from "@/lib/api";
import { digitsOnly, formatThousands } from "@/lib/formatNumber";

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORD_FORM: PasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const passwordValidationSchema = Yup.object({
  currentPassword: Yup.string().required("رمز عبور فعلی را وارد کنید"),
  newPassword: Yup.string()
    .min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
    .required("رمز عبور جدید را وارد کنید"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "تکرار رمز عبور با رمز جدید یکسان نیست")
    .required("تکرار رمز عبور را وارد کنید"),
});

interface FormValues {
  shippingCostUpTo5Km: string;
  shippingCostOver5Km: string;
  maxDeliveryRadiusKm: string;
  siteClosed: boolean;
}

const EMPTY_FORM: FormValues = {
  shippingCostUpTo5Km: "0",
  shippingCostOver5Km: "0",
  maxDeliveryRadiusKm: "8",
  siteClosed: false,
};

const validationSchema = Yup.object({
  shippingCostUpTo5Km: Yup.number()
    .typeError("هزینه ارسال باید عدد باشد")
    .min(0, "هزینه ارسال نمی‌تواند منفی باشد"),
  shippingCostOver5Km: Yup.number()
    .typeError("هزینه ارسال باید عدد باشد")
    .min(0, "هزینه ارسال نمی‌تواند منفی باشد"),
  maxDeliveryRadiusKm: Yup.number()
    .typeError("شعاع باید عدد باشد")
    .min(1, "شعاع باید حداقل ۱ کیلومتر باشد"),
});

function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formik = useFormik<FormValues>({
    initialValues: EMPTY_FORM,
    validationSchema,
    onSubmit: async (values, helpers) => {
      setError(null);
      setSuccess(false);
      try {
        await adminUpdateSettings({
          shippingCostUpTo5Km: Number(values.shippingCostUpTo5Km) || 0,
          shippingCostOver5Km: Number(values.shippingCostOver5Km) || 0,
          maxDeliveryRadiusKm: Number(values.maxDeliveryRadiusKm) || 8,
          siteClosed: values.siteClosed,
        });
        setSuccess(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    adminGetSettings()
      .then((s) =>
        formik.resetForm({
          values: {
            shippingCostUpTo5Km: String(s.shippingCostUpTo5Km),
            shippingCostOver5Km: String(s.shippingCostOver5Km),
            maxDeliveryRadiusKm: String(s.maxDeliveryRadiusKm),
            siteClosed: s.siteClosed,
          },
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const passwordFormik = useFormik<PasswordFormValues>({
    initialValues: EMPTY_PASSWORD_FORM,
    validationSchema: passwordValidationSchema,
    onSubmit: async (values, helpers) => {
      setPasswordError(null);
      setPasswordSuccess(false);
      try {
        await adminChangePassword(values.currentPassword, values.newPassword);
        setPasswordSuccess(true);
        helpers.resetForm();
      } catch (err) {
        setPasswordError(err instanceof ApiError ? err.message : "خطا در تغییر رمز عبور");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">تنظیمات</h1>

      <form
        onSubmit={formik.handleSubmit}
        className="mt-4 max-w-xl rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-cocoa-900">
          <Store className="h-4.5 w-4.5 text-sand-500" />
          وضعیت سفارش‌گیری
        </h2>
        <p className="mt-1 text-xs text-cocoa-500">
          با فعال کردن این گزینه، ثبت سفارش فوری در سایت بسته می‌شود و مشتریان فقط
          می‌توانند پیش‌سفارش ثبت کنند. یک بنر روی همه صفحات سایت این موضوع را به
          مشتریان اطلاع می‌دهد.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-cocoa-700">
          <input
            type="checkbox"
            name="siteClosed"
            checked={formik.values.siteClosed}
            onChange={formik.handleChange}
            className="h-4 w-4 rounded border-cocoa-900/20 accent-sand-500"
          />
          تعطیلی سایت — فقط امکان ثبت پیش‌سفارش
        </label>

        <div className="my-5 h-px bg-cocoa-900/10" />

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
                type="text"
                inputMode="numeric"
                dir="ltr"
                name="shippingCostUpTo5Km"
                value={formatThousands(formik.values.shippingCostUpTo5Km)}
                onChange={(e) => formik.setFieldValue("shippingCostUpTo5Km", digitsOnly(e.target.value))}
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {formik.touched.shippingCostUpTo5Km && formik.errors.shippingCostUpTo5Km && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {formik.errors.shippingCostUpTo5Km}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                هزینه ارسال بیشتر از ۵ کیلومتر (تومان)
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                name="shippingCostOver5Km"
                value={formatThousands(formik.values.shippingCostOver5Km)}
                onChange={(e) => formik.setFieldValue("shippingCostOver5Km", digitsOnly(e.target.value))}
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {formik.touched.shippingCostOver5Km && formik.errors.shippingCostOver5Km && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {formik.errors.shippingCostOver5Km}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                شعاع محدوده سرویس‌دهی (کیلومتر)
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                name="maxDeliveryRadiusKm"
                value={digitsOnly(formik.values.maxDeliveryRadiusKm)}
                onChange={(e) => formik.setFieldValue("maxDeliveryRadiusKm", digitsOnly(e.target.value))}
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              <p className="mt-1 text-xs text-cocoa-500">
                آدرس‌های خارج از این شعاع فقط می‌توانند مراجعه حضوری ثبت کنند.
              </p>
              {formik.touched.maxDeliveryRadiusKm && formik.errors.maxDeliveryRadiusKm && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {formik.errors.maxDeliveryRadiusKm}
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}
        {success && <p className="mt-3 text-xs font-semibold text-sand-500">تغییرات ذخیره شد</p>}

        <button
          type="submit"
          disabled={formik.isSubmitting || loading}
          className="mt-4 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {formik.isSubmitting ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
      </form>

      <form
        onSubmit={passwordFormik.handleSubmit}
        className="mt-4 max-w-xl rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-cocoa-900">
          <KeyRound className="h-4.5 w-4.5 text-sand-500" />
          تغییر رمز عبور
        </h2>
        <p className="mt-1 text-xs text-cocoa-500">
          برای تغییر رمز عبور ورود به پنل ادمین، رمز فعلی و رمز جدید را وارد کنید.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              رمز عبور فعلی
            </label>
            <input
              type="password"
              name="currentPassword"
              value={passwordFormik.values.currentPassword}
              onChange={passwordFormik.handleChange}
              onBlur={passwordFormik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {passwordFormik.touched.currentPassword && passwordFormik.errors.currentPassword && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {passwordFormik.errors.currentPassword}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              رمز عبور جدید
            </label>
            <input
              type="password"
              name="newPassword"
              value={passwordFormik.values.newPassword}
              onChange={passwordFormik.handleChange}
              onBlur={passwordFormik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {passwordFormik.touched.newPassword && passwordFormik.errors.newPassword && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {passwordFormik.errors.newPassword}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              تکرار رمز عبور جدید
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={passwordFormik.values.confirmPassword}
              onChange={passwordFormik.handleChange}
              onBlur={passwordFormik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {passwordFormik.touched.confirmPassword && passwordFormik.errors.confirmPassword && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {passwordFormik.errors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        {passwordError && (
          <p className="mt-3 text-xs font-semibold text-danger-500">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="mt-3 text-xs font-semibold text-sand-500">رمز عبور با موفقیت تغییر کرد</p>
        )}

        <button
          type="submit"
          disabled={passwordFormik.isSubmitting}
          className="mt-4 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {passwordFormik.isSubmitting ? "در حال تغییر…" : "تغییر رمز عبور"}
        </button>
      </form>
    </div>
  );
}

export default AdminSettingsPage;