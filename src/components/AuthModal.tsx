"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  Lock,
  MessageSquareText,
  Pencil,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { normalizeDigits, PHONE_REGEX, toPersianDigits } from "../utils/phone";

const OTP_LENGTH = 5;
const RESEND_SECONDS = 60;

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10">
      <span className="absolute -top-2.5 right-4 z-10 px-2 text-xs font-semibold text-sand-500" style={{background: "linear-gradient(to bottom, #F8F8F7 60%, #FFFFFF 100%)"}}>
        {label}
      </span>
      {children}
    </div>
  );
}

function AuthModal() {
  const {
    isAuthOpen,
    authView,
    setAuthView,
    closeAuth,
    requestOtp,
    verifyOtp,
    loginWithPassword,
  } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"phone" | "password" | "both" | "otp" | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [mounted, setMounted] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset transient fields once the modal finishes closing (adjusting state
  // during render, per React's guidance, instead of a setState-in-effect).
  const [prevIsAuthOpen, setPrevIsAuthOpen] = useState(isAuthOpen);
  if (isAuthOpen !== prevIsAuthOpen) {
    setPrevIsAuthOpen(isAuthOpen);
    if (!isAuthOpen) {
      setPhone("");
      setPassword("");
      setShowPassword(false);
      setOtp(Array(OTP_LENGTH).fill(""));
      setError(null);
      setErrorField(null);
      setLoading(false);
    }
  }

  const [prevAuthView, setPrevAuthView] = useState(authView);
  if (authView !== prevAuthView) {
    setPrevAuthView(authView);
    if (authView === "otp-verify") setTimer(RESEND_SECONDS);
  }

  useEffect(() => {
    if (authView !== "otp-verify") return;
    const interval = window.setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [authView]);

  useEffect(() => {
    if (!isAuthOpen) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeAuth();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isAuthOpen, closeAuth]);

  const handleSendOtp = async () => {
    const cleanPhone = normalizeDigits(phone);
    if (!PHONE_REGEX.test(cleanPhone)) {
      setError("شماره موبایل را به‌درستی وارد کنید");
      setErrorField("phone");
      return;
    }
    setError(null);
    setErrorField(null);
    setLoading(true);
    setPhone(cleanPhone);
    await requestOtp(cleanPhone);
    setLoading(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    setAuthView("otp-verify");
  };

  const handleResend = async () => {
    if (timer > 0 || loading) return;
    setLoading(true);
    setError(null);
    setErrorField(null);
    await requestOtp(phone);
    setLoading(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    setTimer(RESEND_SECONDS);
    otpRefs.current[0]?.focus();
  };

  const handleOtpChange = (index: number, rawValue: string) => {
    const value = normalizeDigits(rawValue).replace(/\D/g, "");
    if (!value) {
      setOtp((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    const chars = value.split("");
    setOtp((prev) => {
      const next = [...prev];
      chars.forEach((char, offset) => {
        if (index + offset < OTP_LENGTH) next[index + offset] = char;
      });
      return next;
    });
    const nextIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
    otpRefs.current[nextIndex]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH || loading) return;
    setError(null);
    setErrorField(null);
    setLoading(true);
    const ok = await verifyOtp(phone, code);
    setLoading(false);
    if (!ok) {
      setError("کد وارد شده صحیح نیست");
      setErrorField("otp");
      setOtp(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerifyOtp();
  };

  const handlePasswordLogin = async () => {
    const cleanPhone = normalizeDigits(phone);
    if (!PHONE_REGEX.test(cleanPhone)) {
      setError("شماره موبایل را به‌درستی وارد کنید");
      setErrorField("phone");
      return;
    }
    if (!password) {
      setError("کلمه عبور را وارد کنید");
      setErrorField("password");
      return;
    }
    setError(null);
    setErrorField(null);
    setLoading(true);
    const ok = await loginWithPassword(cleanPhone, password);
    setLoading(false);
    if (!ok) {
      setError("شماره موبایل یا کلمه عبور اشتباه است");
      setErrorField("both");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isAuthOpen && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="absolute inset-0 bg-cocoa-900/40 backdrop-blur-sm"
            onClick={closeAuth}
          />

          <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden overflow-y-auto rounded-[1.75rem] border border-white/40 bg-white/95 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-6"
      >
        <button
          type="button"
          aria-label="بستن"
          onClick={closeAuth}
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 shadow-sm transition hover:bg-sand-50"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <Image
          src="/assets/textLogo.png"
          alt="لوگوی فلوریش"
          width={120}
          height={44}
          className="mx-auto mb-2.5 h-11 w-auto object-contain"
        />

        <h2
          id="auth-modal-title"
          className="text-center font-display text-lg font-bold text-cocoa-900 sm:text-xl"
        >
          ورود به پنل کاربری
        </h2>

        <AnimatePresence mode="wait">
          {authView === "otp-phone" && (
            <motion.div
              key="otp-phone"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-5 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <FieldShell label="ورود شماره موبایل">
                  <input
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="09xxxxxxxxx"
                    value={toPersianDigits(phone)}
                    onChange={(e) => setPhone(normalizeDigits(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:ring-2 focus:ring-sand-400/25 placeholder:text-cocoa-500/40 ${
                      errorField === "phone" ? "border-danger-500" : "border-cocoa-900/10 focus:border-sand-400"
                    }`}
                  />
                </FieldShell>
                {errorField === "phone" && error && (
                  <p className="text-xs font-semibold text-danger-500">{error}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? "در حال ارسال..." : "ارسال کد"}
                <MessageSquareText className="h-4.5 w-4.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setErrorField(null);
                  setAuthView("password");
                }}
                className="mx-auto flex items-center gap-1.5 text-sm font-bold text-sand-500 transition hover:text-sand-400"
              >
                ورود با رمز عبور
                <Lock className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {authView === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-5 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <FieldShell label="شماره موبایل">
                  <input
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="09xxxxxxxxx"
                    value={toPersianDigits(phone)}
                    onChange={(e) => setPhone(normalizeDigits(e.target.value))}
                    className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:ring-2 focus:ring-sand-400/25 placeholder:text-cocoa-500/40 ${
                      errorField === "phone" || errorField === "both"
                        ? "border-danger-500"
                        : "border-cocoa-900/10 focus:border-sand-400"
                    }`}
                  />
                </FieldShell>
                {errorField === "phone" && error && (
                  <p className="text-xs font-semibold text-danger-500">{error}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div
                  className={`relative flex items-center rounded-2xl border bg-white transition focus-within:ring-2 focus-within:ring-sand-400/25 ${
                    errorField === "password" || errorField === "both"
                      ? "border-danger-500"
                      : "border-cocoa-900/10 focus-within:border-sand-400"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="px-3 text-cocoa-500"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="کلمه عبور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                    className="w-full bg-transparent py-3.5 pl-2 pr-1 text-right text-base text-cocoa-900 outline-none placeholder:text-cocoa-500/40"
                  />
                </div>
                {(errorField === "password" || errorField === "both") && error && (
                  <p className="text-xs font-semibold text-danger-500">{error}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handlePasswordLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? "در حال ورود..." : "ورود"}
                <Lock className="h-4.5 w-4.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setErrorField(null);
                  setAuthView("otp-phone");
                }}
                className="mx-auto flex items-center gap-1.5 text-sm font-bold text-sand-500 transition hover:text-sand-400"
              >
                ورود با رمز یکبار مصرف
                <MessageSquareText className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {authView === "otp-verify" && (
            <motion.div
              key="otp-verify"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex flex-col items-center gap-3"
            >
              <p className="text-center text-sm text-cocoa-700">
                کد {OTP_LENGTH} رقمی ارسال شده را وارد کنید.
              </p>

              <div className="flex flex-col items-center gap-1 text-sm">
                <span className="text-cocoa-500">
                  کد ارسال شده به شماره: <span dir="ltr">{toPersianDigits(phone)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setErrorField(null);
                    setAuthView("otp-phone");
                  }}
                  className="flex items-center gap-1.5 font-bold text-sand-500 transition hover:text-sand-400"
                >
                  تغییر شماره موبایل
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              <div dir="ltr" className="flex items-center justify-center gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={OTP_LENGTH}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`h-11 w-10 rounded-2xl border bg-sand-50/60 text-center text-lg font-bold text-cocoa-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-sand-400/25 sm:h-12 sm:w-11 ${
                      errorField === "otp" ? "border-danger-500" : "border-cocoa-900/10 focus:border-sand-400"
                    }`}
                  />
                ))}
              </div>

              {error && <p className="text-xs font-semibold text-danger-500">{error}</p>}

              <div className="flex items-center gap-1.5 text-xs text-cocoa-500">
                <span className="font-semibold" dir="ltr">
                  {formatTimer(timer)}
                </span>
                <span className="text-cocoa-500/70">کد دریافت نکردید؟</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={timer > 0 || loading}
                  className="flex items-center gap-1 font-bold text-sand-500 transition hover:text-sand-400 hover:underline disabled:pointer-events-none disabled:text-cocoa-500/40 disabled:hover:no-underline"
                >
                  ارسال مجدد پیامک
                </button>
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otp.join("").length !== OTP_LENGTH || loading}
                className="w-full rounded-full bg-sand-500 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:bg-cocoa-900/8 disabled:text-cocoa-500/40 disabled:shadow-none"
              >
                {loading ? "در حال بررسی..." : "تایید کد"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setErrorField(null);
                  setAuthView("password");
                }}
                className="mx-auto flex items-center gap-1.5 text-sm font-bold text-sand-500 transition hover:text-sand-400"
              >
                ورود با رمز عبور
                <Lock className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default AuthModal;
