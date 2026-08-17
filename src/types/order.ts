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

export type PaymentStatus = "pending" | "paid" | "failed";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت شده",
  failed: "پرداخت ناموفق",
};

export type OrderType = "instant" | "preorder";

export type DeliveryMethod = "delivery" | "pickup";

export interface OrderItem {
  id: string;
  title: string;
  variantTitle?: string | null;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerPhone: string;
  customerName?: string | null;
  status: OrderStatus;
  orderType: OrderType;
  deliveryMethod: DeliveryMethod;
  scheduledDate?: string | null;
  scheduledTimeSlot?: string | null;
  addressText?: string | null;
  distanceKm?: number | null;
  subtotal: number;
  discountCode?: string | null;
  discountAmount: number;
  tax: number;
  shippingCost: number;
  total: number;
  note?: string | null;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  createdAt: string;
}
