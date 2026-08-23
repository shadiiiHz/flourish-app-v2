import type { Order } from "./order";

export type { OrderStatus, OrderItem as AdminOrderItem, OrderType, PaymentStatus } from "./order";
export { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "./order";

export type CategoryTabId = "bakery" | "drinks";

export interface AdminCategory {
  id: string;
  slug: string;
  tab: CategoryTabId;
  title: string;
  image?: string | null;
  note?: string | null;
  sortOrder: number;
  _count?: { products: number };
}

export interface AdminHeroSlide {
  id: string;
  image: string;
  sortOrder: number;
}

export interface AdminVariant {
  id?: string;
  title: string;
  description?: string | null;
  price: number;
  weight?: string | null;
  stock?: number | null;
  image?: string | null;
}

export interface AdminProduct {
  id: string;
  categoryId: string;
  category?: AdminCategory;
  title: string;
  description: string;
  price: number;
  images: string[];
  weight?: string | null;
  ingredients?: string | null;
  servingSize?: string | null;
  discountPercent?: number | null;
  stock?: number | null;
  isNew: boolean;
  isAvailable: boolean;
  allowPreorder: boolean;
  sortOrder: number;
  variants: AdminVariant[];
}

export interface AdminOrder extends Order {
  customerId?: string | null;
}

export interface AdminDiscountCode {
  id: string;
  code: string;
  percent: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminAddress {
  id: string;
  title?: string | null;
  address: string;
  details?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
}

export interface AdminCustomer {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  walletBalance: number;
  createdAt: string;
  _count?: { orders: number };
  orders?: AdminOrder[];
  addresses?: AdminAddress[];
}

export type { WalletTransactionType, WalletTransaction as AdminWalletTransaction } from "./order";
export { WALLET_TRANSACTION_TYPE_LABELS } from "./order";
