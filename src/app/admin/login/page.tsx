"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Preloader from "@/components/Preloader";

function AdminLoginPage() {
  const { isAuthenticated, isLoading, login } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/admin");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <Preloader />;

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ورود");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-cream px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[1.75rem] border border-sand-100 bg-white p-7 shadow-[0_30px_60px_-30px_rgba(74,44,18,0.35)]"
      >
        <h1 className="font-display text-xl font-bold text-cocoa-900">ورود به پنل ادمین</h1>
        <p className="mt-1 text-sm text-cocoa-500">فلوریش بیکری و کافه</p>

        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-cocoa-600">ایمیل</label>
            <input
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3 text-sm text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-cocoa-600">رمز عبور</label>
            <input
              type="password"
              dir="ltr"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3 text-sm text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
            />
          </div>

          {error && <p className="text-xs font-semibold text-danger-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-sand-500 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting ? "در حال ورود…" : "ورود"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminLoginPage;
