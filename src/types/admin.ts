import type { Order } from "./order";

export type { OrderStatus, OrderItem as AdminOrderItem, PaymentStatus } from "./order";
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
  sortOrder: number;
  variants: AdminVariant[];
}

export interface AdminOrder extends Order {
  customerId?: string | null;
}

export interface AdminCustomer {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  createdAt: string;
  _count?: { orders: number };
  orders?: AdminOrder[];
}
