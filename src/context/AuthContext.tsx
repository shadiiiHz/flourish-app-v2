"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../lib/api";
import {
  customerAuthMe,
  customerConfirmPasswordChange,
  customerLogin,
  customerLogout,
  customerRequestOtp,
  customerRequestPasswordChange,
  customerVerifyOtp,
  updateMyProfile,
} from "../lib/api";

export interface AuthUser {
  phone: string;
  hasPassword: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  birthDate?: string;
  walletBalance: number;
  birthdayDiscount?: { code: string; percent: number } | null;
}

export type AuthView = "otp-phone" | "otp-verify" | "password";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
    data: Partial<Pick<AuthUser, "firstName" | "lastName" | "email" | "avatar" | "phone">> & {
      birthDate?: string | null;
    },
  ) => void;
  logout: () => void;
  toast: string | null;
  notify: (message: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("otp-phone");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    customerAuthMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);

  // کد از طریق پیامک واقعی ارسال می‌شود؛ اگر بک‌اند سرویس پیامک تنظیم‌نشده
  // داشته باشد (حالت دمو/توسعه)، کد در پاسخ برمی‌گردد و همینجا نمایش داده می‌شود.
  const requestOtp = async (phone: string) => {
    const { code } = await customerRequestOtp(phone);
    notify(code ? `کد یکبار مصرف شبیه‌سازی‌شده: ${code}` : "کد ورود پیامک شد");
  };

  const verifyOtp = async (phone: string, code: string) => {
    try {
      const nextUser = await customerVerifyOtp(phone, code);
      setUser(nextUser);
      setIsAuthOpen(false);
      notify("با موفقیت وارد شدید");
      return true;
    } catch (err) {
      if (err instanceof ApiError) return false;
      throw err;
    }
  };

  const loginWithPassword = async (phone: string, password: string) => {
    try {
      const nextUser = await customerLogin(phone, password);
      setUser(nextUser);
      setIsAuthOpen(false);
      notify("با موفقیت وارد شدید");
      return true;
    } catch (err) {
      if (err instanceof ApiError) return false;
      throw err;
    }
  };

  const requestPasswordChange = async (newPassword: string) => {
    const { code } = await customerRequestPasswordChange(newPassword);
    notify(code ? `کد یکبار مصرف شبیه‌سازی‌شده: ${code}` : "کد تایید پیامک شد");
  };

  const confirmPasswordChange = async (code: string) => {
    try {
      const nextUser = await customerConfirmPasswordChange(code);
      setUser(nextUser);
      notify("کلمه عبور با موفقیت تغییر کرد");
      return true;
    } catch (err) {
      if (err instanceof ApiError) return false;
      throw err;
    }
  };

  const updateProfile: AuthContextValue["updateProfile"] = (data) => {
    updateMyProfile(data)
      .then((nextUser) => {
        setUser(nextUser);
        notify("تغییرات با موفقیت ثبت شد");
      })
      .catch((err) =>
        notify(err instanceof ApiError ? err.message : "ثبت تغییرات با خطا مواجه شد"),
      );
  };

  const logout = () => {
    customerLogout().catch(() => {
      // best-effort — the cookie clears client-side regardless of the request outcome
    });
    setUser(null);
    notify("از حساب کاربری خارج شدید");
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
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
