export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "در انتظار تایید",
  confirmed: "تایید شده",
  preparing: "در حال آماده‌سازی",
  ready: "آماده تحویل",
  delivered: "تحویل داده شده",
  cancelled: "لغو شده",
};

export interface OrderItem {
  id: string;
  title: string;
  variantTitle?: string | null;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerPhone: string;
  customerName?: string | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  note?: string | null;
  items: OrderItem[];
  createdAt: string;
}
