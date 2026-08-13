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
}

interface AddressContextValue {
  addresses: Address[];
  addAddress: (data: Omit<Address, "id">) => void;
  updateAddress: (id: string, data: Omit<Address, "id">) => void;
  removeAddress: (id: string) => void;
}

const AddressContext = createContext<AddressContextValue | null>(null);

function mapAddress(a: ApiAddress): Address {
  return {
    id: a.id,
    address: a.address,
    details: a.details ?? undefined,
    phone: a.phone ?? undefined,
    title: a.title ?? undefined,
    lat: a.lat ?? undefined,
    lng: a.lng ?? undefined,
  };
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, notify } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAddresses([]);
      return;
    }
    getMyAddresses()
      .then((data) => setAddresses(data.map(mapAddress)))
      .catch(() => setAddresses([]));
  }, [isAuthenticated]);

  const addAddress = (data: Omit<Address, "id">) => {
    if (!isAuthenticated) return;
    createMyAddress(data)
      .then((created) => setAddresses((prev) => [...prev, mapAddress(created)]))
      .catch(() => notify("ثبت آدرس با خطا مواجه شد"));
  };

  const updateAddress = (id: string, data: Omit<Address, "id">) => {
    if (!isAuthenticated) return;
    updateMyAddress(id, data)
      .then((updated) =>
        setAddresses((prev) => prev.map((a) => (a.id === id ? mapAddress(updated) : a))),
      )
      .catch(() => notify("ویرایش آدرس با خطا مواجه شد"));
  };

  const removeAddress = (id: string) => {
    if (!isAuthenticated) return;
    const previous = addresses;
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    deleteMyAddress(id).catch(() => {
      notify("حذف آدرس با خطا مواجه شد");
      setAddresses(previous);
    });
  };

  const value: AddressContextValue = { addresses, addAddress, updateAddress, removeAddress };

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddresses must be used within an AddressProvider");
  return ctx;
}
