"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { syncCustomer as syncCustomerApi } from "../lib/api";

export interface AuthUser {
  phone: string;
  hasPassword: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
}

export type AuthView = "otp-phone" | "otp-verify" | "password";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthOpen: boolean;
  authView: AuthView;
  openAuth: (view?: AuthView) => void;
  closeAuth: () => void;
  setAuthView: (view: AuthView) => void;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<boolean>;
  loginWithPassword: (phone: string, password: string) => Promise<boolean>;
  requestPasswordChange: (newPassword: string) => Promise<void>;
  confirmPasswordChange: (code: string) => Promise<boolean>;
  updateProfile: (
    data: Partial<Pick<AuthUser, "firstName" | "lastName" | "email" | "avatar" | "phone">>,
  ) => void;
  logout: () => void;
  toast: string | null;
  notify: (message: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "flourish-auth";

function loadInitialUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.phone === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadInitialUser);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("otp-phone");
  const [pendingOtp, setPendingOtp] = useState<{ phone: string; code: string } | null>(null);
  const [pendingPasswordChange, setPendingPasswordChange] = useState<{
    password: string;
    code: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);

  const syncCustomer = (data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
  }) => {
    syncCustomerApi(data).catch(() => {
      // best-effort sync — customer sync failing shouldn't block the storefront
    });
  };

  // بدون سرویس پیامک واقعی، کد به‌صورت شبیه‌سازی‌شده ساخته می‌شود.
  // برای اتصال به یک سرویس واقعی، این تابع را با فراخوانی API پیامک
  // (مثلاً کاوه‌نگار، ملی‌پیامک و...) جایگزین کنید و بخش نمایش کد در
  // نوتیف را حذف کنید چون سرویس واقعی کد را در پیامک پیامک می‌کند، نه در UI.
  const requestOtp = async (phone: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const code = String(Math.floor(10000 + Math.random() * 90000));
    console.info(`[Flourish] کد ورود شبیه‌سازی‌شده برای ${phone}: ${code}`);
    setPendingOtp({ phone, code });
    notify(`کد یکبار مصرف شبیه‌سازی‌شده: ${code}`);
  };

  const verifyOtp = async (phone: string, code: string) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!pendingOtp || pendingOtp.phone !== phone || pendingOtp.code !== code) {
      return false;
    }
    setUser((prev) => ({
      phone,
      hasPassword: prev?.phone === phone ? prev.hasPassword : false,
    }));
    setPendingOtp(null);
    setIsAuthOpen(false);
    notify("با موفقیت وارد شدید");
    syncCustomer({ phone });
    return true;
  };

  const loginWithPassword = async (phone: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!password) return false;
    setUser({ phone, hasPassword: true });
    setIsAuthOpen(false);
    notify("با موفقیت وارد شدید");
    syncCustomer({ phone });
    return true;
  };

  // مشابه requestOtp، کد تایید تغییر رمز عبور به‌صورت شبیه‌سازی‌شده ساخته می‌شود.
  const requestPasswordChange = async (newPassword: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const code = String(Math.floor(10000 + Math.random() * 90000));
    console.info(`[Flourish] کد تایید شبیه‌سازی‌شده برای تغییر رمز عبور: ${code}`);
    setPendingPasswordChange({ password: newPassword, code });
    notify(`کد یکبار مصرف شبیه‌سازی‌شده: ${code}`);
  };

  const confirmPasswordChange = async (code: string) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!pendingPasswordChange || pendingPasswordChange.code !== code) {
      return false;
    }
    setUser((prev) => (prev ? { ...prev, hasPassword: true } : prev));
    setPendingPasswordChange(null);
    notify("کلمه عبور با موفقیت تغییر کرد");
    return true;
  };

  const updateProfile: AuthContextValue["updateProfile"] = (data) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...data };
      syncCustomer({
        phone: next.phone,
        firstName: next.firstName,
        lastName: next.lastName,
        email: next.email,
        avatar: next.avatar,
      });
      return next;
    });
    notify("تغییرات با موفقیت ثبت شد");
  };

  const logout = () => {
    setUser(null);
    notify("از حساب کاربری خارج شدید");
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isAuthOpen,
    authView,
    openAuth: (view = "otp-phone") => {
      setAuthView(view);
      setIsAuthOpen(true);
    },
    closeAuth: () => setIsAuthOpen(false),
    setAuthView,
    requestOtp,
    verifyOtp,
    loginWithPassword,
    requestPasswordChange,
    confirmPasswordChange,
    updateProfile,
    logout,
    toast,
    notify,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
