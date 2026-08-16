import type {
  Category,
  CategoryTab,
  CategoryTabId,
  MenuItem,
  MenuItemVariant,
} from "../config/siteConfig";
import type {
  AdminCategory,
  AdminCustomer,
  AdminOrder,
  AdminProduct,
} from "../types/admin";
import type { Order, OrderStatus, OrderType } from "../types/order";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiFetchOptions = RequestInit & {
  /** Next.js fetch cache/revalidation hints — only meaningful when called from a Server Component. */
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * The single low-level client for every request to the Flourish backend.
 * Works both in Server Components (SSR/ISR data fetching) and Client
 * Components (mutations, authenticated requests).
 */
async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function adminBulkDelete(resourcePath: string, ids: string[]) {
  return apiFetch(`${resourcePath}/bulk`, {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

export function apiUploadUrl(path?: string | null) {
  if (!path) return path ?? "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/uploads/")) return `${API_URL}${path}`;
  return path;
}

/* ------------------------------------------------------------------ */
/* Catalog (public, SSR-friendly)                                      */
/* ------------------------------------------------------------------ */

export const CATEGORY_TABS: CategoryTab[] = [
  { id: "drinks", label: "نوشیدنی" },
  { id: "bakery", label: "نان و شیرینی" },
];

interface ApiVariant {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  weight?: string | null;
  stock?: number | null;
  image?: string | null;
}

interface ApiProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  weight?: string | null;
  ingredients?: string | null;
  servingSize?: string | null;
  discountPercent?: number | null;
  stock?: number | null;
  isAvailable: boolean;
  allowPreorder: boolean;
  variants: ApiVariant[];
}

interface ApiCategory {
  id: string;
  slug: string;
  tab: CategoryTabId;
  title: string;
  image?: string | null;
  note?: string | null;
  products: ApiProduct[];
}

interface ApiNewProduct extends ApiProduct {
  category: { title: string };
}

function mapVariant(v: ApiVariant): MenuItemVariant {
  return {
    id: v.id,
    title: v.title,
    description: v.description ?? undefined,
    price: v.price,
    weight: v.weight ?? undefined,
    stock: v.stock ?? undefined,
    image: v.image ? apiUploadUrl(v.image) : undefined,
  };
}

function mapProduct(p: ApiProduct, categoryTitle: string): MenuItem {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    images: p.images.map((i) => apiUploadUrl(i)),
    category: categoryTitle,
    weight: p.weight ?? undefined,
    ingredients: p.ingredients ?? undefined,
    servingSize: p.servingSize ?? undefined,
    discountPercent: p.discountPercent ?? undefined,
    stock: p.stock ?? undefined,
    isAvailable: p.isAvailable,
    allowPreorder: p.allowPreorder,
    variants: p.variants.length > 0 ? p.variants.map(mapVariant) : undefined,
  };
}

/** Catalog is revalidated every 60s (ISR-style) — fresh enough for admin edits, cached for performance. */
const CATALOG_REVALIDATE_SECONDS = 60;

export async function getCatalog(): Promise<Record<CategoryTabId, Category[]>> {
  const data = await apiFetch<ApiCategory[]>("/api/categories", {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
  });
  const grouped: Record<CategoryTabId, Category[]> = { bakery: [], drinks: [] };
  for (const cat of data) {
    grouped[cat.tab].push({
      id: cat.slug,
      title: cat.title,
      image: apiUploadUrl(cat.image ?? ""),
      note: cat.note ?? undefined,
      items: cat.products.map((p) => mapProduct(p, cat.title)),
    });
  }
  return grouped;
}

export async function getNewProducts(): Promise<MenuItem[]> {
  const data = await apiFetch<ApiNewProduct[]>("/api/products/new", {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
  });
  return data.map((p) => mapProduct(p, p.category.title));
}

/**
 * Purges the public catalog cache right away instead of waiting out
 * CATALOG_REVALIDATE_SECONDS. Best-effort: admin mutations already succeeded
 * by the time this runs, so a failure here just means the storefront falls
 * back to the timed revalidation.
 */
export function revalidateCatalog(): Promise<void> {
  const secret = process.env.NEXT_PUBLIC_REVALIDATE_SECRET;
  if (!secret) return Promise.resolve();
  return fetch(`/api/revalidate?secret=${encodeURIComponent(secret)}`, { method: "POST" })
    .then(() => undefined)
    .catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Customers / orders (storefront)                                     */
/* ------------------------------------------------------------------ */

export interface CustomerAuthUser {
  phone: string;
  hasPassword: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
}

export function customerRequestOtp(phone: string) {
  return apiFetch<{ code?: string }>("/api/customers/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function customerVerifyOtp(phone: string, code: string) {
  return apiFetch<CustomerAuthUser>("/api/customers/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function customerLogin(phone: string, password: string) {
  return apiFetch<CustomerAuthUser>("/api/customers/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
}

export function customerAuthMe() {
  return apiFetch<CustomerAuthUser>("/api/customers/auth/me");
}

export function customerLogout() {
  return apiFetch("/api/customers/auth/logout", { method: "POST" });
}

export function customerRequestPasswordChange(newPassword: string) {
  return apiFetch<{ code?: string }>("/api/customers/auth/password/request", {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export function customerConfirmPasswordChange(code: string) {
  return apiFetch<CustomerAuthUser>("/api/customers/auth/password/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  phone?: string;
}

export function updateMyProfile(payload: UpdateProfilePayload) {
  return apiFetch<CustomerAuthUser>("/api/customers/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getMyOrders() {
  return apiFetch<Order[]>("/api/customers/me/orders");
}

export interface ApiAddress {
  id: string;
  title?: string | null;
  address: string;
  details?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
}

export interface AddressPayload {
  title?: string;
  address: string;
  details?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export function getMyAddresses() {
  return apiFetch<ApiAddress[]>("/api/customers/me/addresses");
}

export function createMyAddress(payload: AddressPayload) {
  return apiFetch<ApiAddress>("/api/customers/me/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyAddress(id: string, payload: AddressPayload) {
  return apiFetch<ApiAddress>(`/api/customers/me/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteMyAddress(id: string) {
  return apiFetch(`/api/customers/me/addresses/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Cart (server-persisted)                                             */
/* ------------------------------------------------------------------ */

export interface ApiCartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  title: string;
  variantTitle?: string | null;
  price: number;
  image?: string | null;
  quantity: number;
  maxQuantity?: number | null;
}

export interface AddCartItemPayload {
  productId: string;
  variantId?: string;
  quantity?: number;
}

export function getMyCart() {
  return apiFetch<ApiCartItem[]>("/api/customers/me/cart");
}

export function addMyCartItem(payload: AddCartItemPayload) {
  return apiFetch<ApiCartItem>("/api/customers/me/cart", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyCartItem(id: string, quantity: number) {
  return apiFetch<ApiCartItem>(`/api/customers/me/cart/${id}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });
}

export function removeMyCartItem(id: string) {
  return apiFetch(`/api/customers/me/cart/${id}`, { method: "DELETE" });
}

export function clearMyCart() {
  return apiFetch("/api/customers/me/cart", { method: "DELETE" });
}

export interface CreateOrderPayload {
  addressId: string;
  customerName?: string;
  note?: string;
  orderType?: OrderType;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
}

export interface CreateOrderResult {
  order: Order;
  paymentUrl: string;
}

export function createOrder(payload: CreateOrderPayload) {
  return apiFetch<CreateOrderResult>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOrder(id: string) {
  return apiFetch<Order>(`/api/customers/me/orders/${id}`);
}

export interface ShippingEstimate {
  distanceKm: number;
  shippingCost: number;
}

export function getShippingEstimate(addressId: string) {
  return apiFetch<ShippingEstimate>(`/api/shipping/estimate?addressId=${addressId}`);
}

/* ------------------------------------------------------------------ */
/* Admin auth                                                           */
/* ------------------------------------------------------------------ */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function adminAuthMe() {
  return apiFetch<AdminUser>("/api/admin/auth/me");
}

export function adminLogin(email: string, password: string) {
  return apiFetch<AdminUser>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminLogout() {
  return apiFetch("/api/admin/auth/logout", { method: "POST" });
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/* Admin catalog management                                            */
/* ------------------------------------------------------------------ */

export function adminGetCategories(page = 1, pageSize = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiFetch<Paginated<AdminCategory>>(`/api/admin/categories?${params.toString()}`);
}

/** Unpaginated — for populating dropdowns (e.g. the product form's category select). */
export function adminGetAllCategories() {
  return apiFetch<AdminCategory[]>("/api/admin/categories?all=true");
}

export function adminCreateCategory(payload: Record<string, unknown>) {
  return apiFetch<AdminCategory>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUpdateCategory(id: string, payload: Record<string, unknown>) {
  return apiFetch<AdminCategory>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteCategory(id: string) {
  return apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
}

export function adminBulkDeleteCategories(ids: string[]) {
  return adminBulkDelete("/api/admin/categories", ids);
}

export function adminGetProducts(page = 1, pageSize = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiFetch<Paginated<AdminProduct>>(`/api/admin/products?${params.toString()}`);
}

export function adminCreateProduct(payload: Record<string, unknown>) {
  return apiFetch<AdminProduct>("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUpdateProduct(id: string, payload: Record<string, unknown>) {
  return apiFetch<AdminProduct>(`/api/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteProduct(id: string) {
  return apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
}

export function adminBulkDeleteProducts(ids: string[]) {
  return adminBulkDelete("/api/admin/products", ids);
}

export function adminUploadImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<{ url: string }>("/api/admin/uploads", {
    method: "POST",
    body: fd,
  });
}

/* ------------------------------------------------------------------ */
/* Admin orders / customers                                            */
/* ------------------------------------------------------------------ */

export function adminGetOrders(
  status?: OrderStatus | "all",
  page = 1,
  pageSize = 20,
  search = "",
) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return apiFetch<Paginated<AdminOrder>>(`/api/admin/orders?${params.toString()}`);
}

export function adminUpdateOrderStatus(id: string, status: OrderStatus) {
  return apiFetch(`/api/admin/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function adminBulkDeleteOrders(ids: string[]) {
  return adminBulkDelete("/api/admin/orders", ids);
}

export function adminGetCustomers(page = 1, pageSize = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiFetch<Paginated<AdminCustomer>>(`/api/admin/customers?${params.toString()}`);
}

export function adminGetCustomer(id: string) {
  return apiFetch<AdminCustomer>(`/api/admin/customers/${id}`);
}

export function adminDeleteCustomer(id: string) {
  return apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
}

export function adminBulkDeleteCustomers(ids: string[]) {
  return adminBulkDelete("/api/admin/customers", ids);
}

/* ------------------------------------------------------------------ */
/* Admin settings (shipping cost tiers)                                */
/* ------------------------------------------------------------------ */

export interface AdminSettings {
  shippingCostUpTo5Km: number;
  shippingCostOver5Km: number;
}

export function adminGetSettings() {
  return apiFetch<AdminSettings>("/api/admin/settings");
}

export function adminUpdateSettings(payload: AdminSettings) {
  return apiFetch<AdminSettings>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
