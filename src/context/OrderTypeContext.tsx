"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { OrderType } from "@/types/order";

export interface PreorderSelection {
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "16:00 - 15:30"
}

interface OrderTypeContextValue {
  orderType: OrderType;
  preorder: PreorderSelection | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  setInstant: () => void;
  setPreorder: (selection: PreorderSelection) => void;
}

const OrderTypeContext = createContext<OrderTypeContextValue | null>(null);
const STORAGE_KEY = "flourish-order-type";

interface StoredState {
  orderType: OrderType;
  preorder: PreorderSelection | null;
}

function loadInitialState(): StoredState {
  if (typeof window === "undefined") return { orderType: "instant", preorder: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { orderType: "instant", preorder: null };
    const parsed = JSON.parse(raw);
    if (parsed?.orderType === "preorder" && parsed.preorder?.date && parsed.preorder?.timeSlot) {
      return { orderType: "preorder", preorder: parsed.preorder };
    }
    return { orderType: "instant", preorder: null };
  } catch {
    return { orderType: "instant", preorder: null };
  }
}

export function OrderTypeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(loadInitialState);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value: OrderTypeContextValue = {
    orderType: state.orderType,
    preorder: state.preorder,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    setInstant: () => setState({ orderType: "instant", preorder: null }),
    setPreorder: (selection) => setState({ orderType: "preorder", preorder: selection }),
  };

  return <OrderTypeContext.Provider value={value}>{children}</OrderTypeContext.Provider>;
}

export function useOrderType() {
  const ctx = useContext(OrderTypeContext);
  if (!ctx) throw new Error("useOrderType must be used within an OrderTypeProvider");
  return ctx;
}
