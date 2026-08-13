"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
const STORAGE_KEY = "flourish-addresses";

function loadInitialAddresses(): Address[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const [addresses, setAddresses] = useState<Address[]>(loadInitialAddresses);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  }, [addresses]);

  const addAddress = (data: Omit<Address, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAddresses((prev) => [...prev, { ...data, id }]);
  };

  const updateAddress = (id: string, data: Omit<Address, "id">) => {
    setAddresses((prev) => prev.map((a) => (a.id === id ? { ...data, id } : a)));
  };

  const removeAddress = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const value: AddressContextValue = { addresses, addAddress, updateAddress, removeAddress };

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddresses must be used within an AddressProvider");
  return ctx;
}
