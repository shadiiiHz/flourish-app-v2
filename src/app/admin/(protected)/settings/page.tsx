"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  KeyRound,
  Store,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import {
  ApiError,
  adminChangePassword,
  adminCreateHeroSlide,
  adminDeleteHeroSlide,
  adminGetHeroSlides,
  adminGetSettings,
  adminUpdateHeroSlide,
  adminUpdateSettings,
  adminUploadImage,
  apiUploadUrl,
  revalidateCatalog,
} from "@/lib/api";
import { digitsOnly, formatThousands } from "@/lib/formatNumber";
import type { AdminHeroSlide } from "@/types/admin";

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
        setPasswordError(
          err instanceof ApiError ? err.message : "خطا در تغییر رمز عبور",
        );
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const [heroSlides, setHeroSlides] = useState<AdminHeroSlide[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [newSlideImage, setNewSlideImage] = useState("");
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  const loadHeroSlides = useCallback(() => {
    setHeroLoading(true);
    adminGetHeroSlides()
      .then(setHeroSlides)
      .finally(() => setHeroLoading(false));
  }, []);

  useEffect(() => {
    loadHeroSlides();
  }, [loadHeroSlides]);

  const handleHeroUpload = async (file: File) => {
    setHeroError(null);
    setHeroUploading(true);
    try {
      const { url } = await adminUploadImage(file);
      setNewSlideImage(url);
    } catch (err) {
      setHeroError(
        err instanceof ApiError ? err.message : "خطا در آپلود تصویر",
      );
    } finally {
      setHeroUploading(false);
    }
  };

  const handleAddSlide = async () => {
    if (!newSlideImage) return;
    setHeroError(null);
    try {
      const maxSortOrder = heroSlides.reduce(
        (max, s) => Math.max(max, s.sortOrder),
        -1,
      );
      await adminCreateHeroSlide({
        image: newSlideImage,
        sortOrder: maxSortOrder + 1,
      });
      setNewSlideImage("");
      loadHeroSlides();
      revalidateCatalog();
    } catch (err) {
      setHeroError(
        err instanceof ApiError ? err.message : "خطا در افزودن اسلاید",
      );
    }
  };

  const handleDeleteSlide = async (id: string) => {
    setHeroError(null);
    try {
      await adminDeleteHeroSlide(id);
      loadHeroSlides();
      revalidateCatalog();
    } catch (err) {
      setHeroError(err instanceof ApiError ? err.message : "خطا در حذف اسلاید");
    }
  };

  const handleMoveSlide = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= heroSlides.length) return;
    setHeroError(null);
    try {
      const a = heroSlides[index];
      const b = heroSlides[target];
      await Promise.all([
        adminUpdateHeroSlide(a.id, { sortOrder: b.sortOrder }),
        adminUpdateHeroSlide(b.id, { sortOrder: a.sortOrder }),
      ]);
      loadHeroSlides();
      revalidateCatalog();
    } catch (err) {
      setHeroError(
        err instanceof ApiError ? err.message : "خطا در جابه‌جایی اسلاید",
      );
    }
  };

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
          با فعال کردن این گزینه، ثبت سفارش فوری در سایت بسته می‌شود و مشتریان
          فقط می‌توانند پیش‌سفارش ثبت کنند. یک بنر روی همه صفحات سایت این موضوع
          را به مشتریان اطلاع می‌دهد.
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
          هزینه ارسال بر اساس فاصله آدرس تحویل مشتری تا کافه فلوریش محاسبه
          می‌شود.
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
                onChange={(e) =>
                  formik.setFieldValue(
                    "shippingCostUpTo5Km",
                    digitsOnly(e.target.value),
                  )
                }
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {formik.touched.shippingCostUpTo5Km &&
                formik.errors.shippingCostUpTo5Km && (
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
                onChange={(e) =>
                  formik.setFieldValue(
                    "shippingCostOver5Km",
                    digitsOnly(e.target.value),
                  )
                }
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              {formik.touched.shippingCostOver5Km &&
                formik.errors.shippingCostOver5Km && (
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
                onChange={(e) =>
                  formik.setFieldValue(
                    "maxDeliveryRadiusKm",
                    digitsOnly(e.target.value),
                  )
                }
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
              <p className="mt-1 text-xs text-cocoa-500">
                آدرس‌های خارج از این شعاع فقط می‌توانند مراجعه حضوری ثبت کنند.
              </p>
              {formik.touched.maxDeliveryRadiusKm &&
                formik.errors.maxDeliveryRadiusKm && (
                  <p className="mt-1 text-xs font-semibold text-danger-500">
                    {formik.errors.maxDeliveryRadiusKm}
                  </p>
                )}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-xs font-semibold text-sand-500">
            تغییرات ذخیره شد
          </p>
        )}

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
          برای تغییر رمز عبور ورود به پنل ادمین، رمز فعلی و رمز جدید را وارد
          کنید.
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
            {passwordFormik.touched.currentPassword &&
              passwordFormik.errors.currentPassword && (
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
            {passwordFormik.touched.newPassword &&
              passwordFormik.errors.newPassword && (
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
            {passwordFormik.touched.confirmPassword &&
              passwordFormik.errors.confirmPassword && (
                <p className="mt-1 text-xs font-semibold text-danger-500">
                  {passwordFormik.errors.confirmPassword}
                </p>
              )}
          </div>
        </div>

        {passwordError && (
          <p className="mt-3 text-xs font-semibold text-danger-500">
            {passwordError}
          </p>
        )}
        {passwordSuccess && (
          <p className="mt-3 text-xs font-semibold text-sand-500">
            رمز عبور با موفقیت تغییر کرد
          </p>
        )}

        <button
          type="submit"
          disabled={passwordFormik.isSubmitting}
          className="mt-4 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {passwordFormik.isSubmitting ? "در حال تغییر…" : "تغییر رمز عبور"}
        </button>
      </form>

      <div className="mt-4 max-w-xl rounded-[1.5rem] border border-sand-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-cocoa-900">
          <ImagePlus className="h-4.5 w-4.5 text-sand-500" />
          اسلایدر صفحه اصلی
        </h2>
        <p className="mt-1 text-xs text-cocoa-500">
          تصاویری که بالای صفحه‌ی اصلی سایت به‌صورت چرخشی نمایش داده می‌شوند.
        </p>
        <p className="mt-2 rounded-xl bg-sand-50/60 p-3 text-xs leading-6 text-cocoa-600">
          راهنمای سایز عکس: بهتره تصویر افقی و کشیده باشه، حدود{" "}
          <span dir="ltr" className="font-semibold">
            1600×600
          </span>
          پیکسل (نسبت تقریبی ۲.۷ به ۱) و حجمش کمتر از ۵۰۰ کیلوبایت. چون تصویر
          همیشه کل کادر رو پر می‌کنه، عکس‌های خیلی عمودی یا مربعی ممکنه از طرفین
          بریده بشن.
        </p>

        {heroLoading ? (
          <p className="mt-4 text-sm text-cocoa-500">در حال بارگذاری…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {heroSlides.length === 0 && (
              <p className="text-xs text-cocoa-500">
                هنوز اسلایدی اضافه نشده است.
              </p>
            )}
            {heroSlides.map((slide, i) => (
              <div
                key={slide.id}
                className="flex items-center gap-3 rounded-xl border border-cocoa-900/10 p-2.5"
              >
                <img
                  src={apiUploadUrl(slide.image)}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded-lg object-cover"
                />
                <p className="flex-1 text-sm font-semibold text-cocoa-900">
                  اسلاید {(i + 1).toLocaleString("fa-IR")}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(i, -1)}
                    disabled={i === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-cocoa-900/10 text-cocoa-700 transition hover:bg-sand-50 disabled:opacity-30"
                    aria-label="جابه‌جایی به بالا"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(i, 1)}
                    disabled={i === heroSlides.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-cocoa-900/10 text-cocoa-700 transition hover:bg-sand-50 disabled:opacity-30"
                    aria-label="جابه‌جایی به پایین"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(slide.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 transition hover:bg-danger-50"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="my-5 h-px bg-cocoa-900/10" />

        <h3 className="text-xs font-bold text-cocoa-900">افزودن اسلاید جدید</h3>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              ref={heroFileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleHeroUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => heroFileInputRef.current?.click()}
              disabled={heroUploading}
              className="flex items-center gap-1.5 rounded-full border border-sand-200 px-3.5 py-2 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50 disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {heroUploading ? "در حال آپلود…" : "انتخاب تصویر"}
            </button>
            {newSlideImage && (
              <img
                src={apiUploadUrl(newSlideImage)}
                alt=""
                className="h-12 w-20 rounded-lg border border-sand-100 object-cover"
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleAddSlide}
            disabled={!newSlideImage || heroUploading}
            className="self-start rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            افزودن اسلاید
          </button>
        </div>

        {heroError && (
          <p className="mt-3 text-xs font-semibold text-danger-500">
            {heroError}
          </p>
        )}
      </div>
    </div>
  );
}

export default AdminSettingsPage;
