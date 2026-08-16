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
        <CartProvider>
          <OrderTypeProvider>
            <AdminAuthProvider>{children}</AdminAuthProvider>
          </OrderTypeProvider>
        </CartProvider>
      </AddressProvider>
    </AuthProvider>
  );
}
