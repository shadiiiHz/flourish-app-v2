"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { AddressProvider } from "@/context/AddressContext";
import { CartProvider } from "@/context/CartContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { OrderTypeProvider } from "@/context/OrderTypeContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AddressProvider>
        <OrderTypeProvider>
          <CartProvider>
            <AdminAuthProvider>{children}</AdminAuthProvider>
          </CartProvider>
        </OrderTypeProvider>
      </AddressProvider>
    </AuthProvider>
  );
}
