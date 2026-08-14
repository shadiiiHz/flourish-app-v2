"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  createMyAddress,
  deleteMyAddress,
  getMyAddresses,
  updateMyAddress,
  type ApiAddress,
} from "../lib/api";

export interface Address {
  id: string;
  address: string;
  details?: string;
  phone?: string;
  title?: string;
  lng?: number;
  lat?: number;
  isDefault?: boolean;
}

interface AddressContextValue {
  addresses: Address[];
  isLoading: boolean;
  addAddress: (data: Omit<Address, "id">) => void;
  updateAddress: (id: string, data: Omit<Address, "id">) => void;
  removeAddress: (id: string) => void;
}

const AddressContext = createContext<AddressContextValue | null>(null);

function sortAddresses(list: Address[]): Address[] {
  return [...list].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
}

function mapAddress(a: ApiAddress): Address {
  return {
    id: a.id,
    address: a.address,
    details: a.details ?? undefined,
    phone: a.phone ?? undefined,
    title: a.title ?? undefined,
    lat: a.lat ?? undefined,
    lng: a.lng ?? undefined,
    isDefault: a.isDefault ?? false,
  };
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, notify } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setAddresses([]);
      return;
    }
    setIsLoading(true);
    getMyAddresses()
      .then((data) => setAddresses(sortAddresses(data.map(mapAddress))))
      .catch(() => setAddresses([]))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const addAddress = (data: Omit<Address, "id">) => {
    if (!isAuthenticated) return;
    createMyAddress(data)
      .then((created) => {
        const mapped = mapAddress(created);
        setAddresses((prev) =>
          sortAddresses([
            ...(mapped.isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev),
            mapped,
          ]),
        );
      })
      .catch(() => notify("ثبت آدرس با خطا مواجه شد"));
  };

  const updateAddress = (id: string, data: Omit<Address, "id">) => {
    if (!isAuthenticated) return;
    updateMyAddress(id, data)
      .then((updated) => {
        const mapped = mapAddress(updated);
        setAddresses((prev) =>
          sortAddresses(
            prev.map((a) => {
              if (a.id === id) return mapped;
              return mapped.isDefault ? { ...a, isDefault: false } : a;
            }),
          ),
        );
      })
      .catch(() => notify("ویرایش آدرس با خطا مواجه شد"));
  };

  const removeAddress = (id: string) => {
    if (!isAuthenticated) return;
    const target = addresses.find((a) => a.id === id);
    if (target?.isDefault) {
      notify("آدرس پیش‌فرض قابل حذف نیست");
      return;
    }
    if (addresses.length <= 1) {
      notify("حداقل یک آدرس باید ثبت باشد");
      return;
    }
    const previous = addresses;
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    deleteMyAddress(id).catch(() => {
      notify("حذف آدرس با خطا مواجه شد");
      setAddresses(previous);
    });
  };

  const value: AddressContextValue = {
    addresses,
    isLoading,
    addAddress,
    updateAddress,
    removeAddress,
  };

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddresses must be used within an AddressProvider");
  return ctx;
}
