"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleCheck, Eye, EyeOff, KeyRound, Pencil } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPasswordStrength } from "../utils/passwordStrength";
import { normalizeDigits, toPersianDigits } from "../utils/phone";

const OTP_LENGTH = 5;
const RESEND_SECONDS = 60;

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ChangePasswordPanel() {
  const { user, requestPasswordChange, confirmPasswordChange } = useAuth();

  const [step, setStep] = useState<"enter" | "verify" | "success">("enter");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const strength = getPasswordStrength(newPassword);

  useEffect(() => {
    if (step !== "verify") return;
    const interval = window.setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [step]);

  const handleSubmitPassword = async () => {
    if (!newPassword) {
      setError("کلمه عبور جدید را وارد کنید");
      return;
    }
    setError(null);
    setLoading(true);
    await requestPasswordChange(newPassword);
    setLoading(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    setOtpError(null);
    setTimer(RESEND_SECONDS);
    setStep("verify");
  };

  const handleResend = async () => {
    if (timer > 0 || loading) return;
    setLoading(true);
    setOtpError(null);
    await requestPasswordChange(newPassword);
    setLoading(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    setTimer(RESEND_SECONDS);
    otpRefs.current[0]?.focus();
  };

  const handleOtpChange = (index: number, rawValue: string) => {
    const digits = normalizeDigits(rawValue).replace(/\D/g, "");
    if (!digits) {
      setOtp((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    const chars = digits.split("");
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

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleConfirm();
  };

  const handleConfirm = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH || loading) return;
    setOtpError(null);
    setLoading(true);
    const ok = await confirmPasswordChange(code);
    setLoading(false);
    if (!ok) {
      setOtpError("کد وارد شده صحیح نیست");
      setOtp(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
      return;
    }
    setNewPassword("");
    setShowPassword(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    setStep("success");
  };

  return (
    <div className="rounded-[1.75rem] border border-white/40 bg-white/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cocoa-900">
        تغییر کلمه عبور
        <KeyRound className="h-5 w-5 text-sand-500" />
      </h2>

      <AnimatePresence mode="wait">
        {step === "enter" && (
          <motion.div
            key="enter"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <div
                className={`relative flex items-center rounded-2xl border bg-white transition focus-within:ring-2 focus-within:ring-sand-400/25 ${
                  error ? "border-danger-500" : "border-cocoa-900/10 focus-within:border-sand-400"
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
                  placeholder="ورود کلمه عبور جدید"
                  value={newPassword}
                  onChange={(e) => {
                    setError(null);
                    setNewPassword(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitPassword()}
                  className="w-full bg-transparent py-3.5 pl-2 pr-1 text-right text-base text-cocoa-900 outline-none placeholder:text-cocoa-500/40"
                />
              </div>
              {error && <p className="text-xs font-semibold text-danger-500">{error}</p>}
            </div>

            <p className="text-xs leading-6 text-cocoa-500">
              توجه به نکات زیر امنیت حساب کاربری شما را افزایش می‌دهد، اما اجباری نیست.
            </p>

            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-cocoa-900/8">
                <motion.div
                  className={`h-full rounded-full ${strength.barColorClass}`}
                  animate={{ width: `${strength.percent}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
              <span className="text-xs font-semibold text-cocoa-500">{strength.label}</span>
            </div>

            <ul className="flex flex-col gap-2">
              {strength.requirements.map((req) => (
                <li
                  key={req.key}
                  className={`flex items-center gap-2 text-sm transition ${
                    req.met ? "text-sand-500" : "text-cocoa-500"
                  }`}
                >
                  {req.met ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <span className="block h-1 w-2.5 shrink-0 rounded-full bg-cocoa-500/40" />
                  )}
                  {req.label}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleSubmitPassword}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-60 sm:w-auto sm:self-start sm:px-8"
            >
              {loading ? "در حال ارسال..." : "ارسال کد تایید"}
            </button>
          </motion.div>
        )}

        {step === "verify" && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex flex-col items-center gap-3"
          >
            <p className="text-center text-sm text-cocoa-700">
              کد {toPersianDigits(String(OTP_LENGTH))} رقمی ارسال شده را وارد کنید.
            </p>

            <div className="flex flex-col items-center gap-1 text-sm">
              <span className="text-cocoa-500">
                کد تایید به شماره: <span dir="ltr">{toPersianDigits(user?.phone ?? "")}</span> ارسال شد
              </span>
              <button
                type="button"
                onClick={() => {
                  setOtpError(null);
                  setStep("enter");
                }}
                className="flex items-center gap-1.5 font-bold text-sand-500 transition hover:text-sand-400"
              >
                ویرایش کلمه عبور جدید
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
                    otpError ? "border-danger-500" : "border-cocoa-900/10 focus:border-sand-400"
                  }`}
                />
              ))}
            </div>

            {otpError && <p className="text-xs font-semibold text-danger-500">{otpError}</p>}

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
              onClick={handleConfirm}
              disabled={otp.join("").length !== OTP_LENGTH || loading}
              className="w-full rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:bg-cocoa-900/8 disabled:text-cocoa-500/40 disabled:shadow-none sm:w-auto sm:self-start sm:px-8"
            >
              {loading ? "در حال بررسی..." : "تایید و تغییر رمز عبور"}
            </button>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex flex-col items-center gap-3 py-4 text-center"
          >
            <CircleCheck className="h-10 w-10 text-sand-500" />
            <p className="text-sm font-bold text-cocoa-900">کلمه عبور شما با موفقیت تغییر کرد</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChangePasswordPanel;
