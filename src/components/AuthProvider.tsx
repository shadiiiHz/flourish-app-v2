import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  phone: string;
  hasPassword: boolean;
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
  logout: () => void;
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

  useEffect(() => {
    if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  // بدون سرویس پیامک واقعی، کد به‌صورت شبیه‌سازی‌شده ساخته و در کنسول چاپ می‌شود
  const requestOtp = async (phone: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const code = String(Math.floor(10000 + Math.random() * 90000));
    console.info(`[Flourish] کد ورود شبیه‌سازی‌شده برای ${phone}: ${code}`);
    setPendingOtp({ phone, code });
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
    return true;
  };

  const loginWithPassword = async (phone: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!password) return false;
    setUser({ phone, hasPassword: true });
    setIsAuthOpen(false);
    return true;
  };

  const logout = () => setUser(null);

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
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
