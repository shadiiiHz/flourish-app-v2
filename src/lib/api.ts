import type {
  Category,
  CategoryTab,
  CategoryTabId,
  MenuItem,
  MenuItemVariant,
} from "../config/siteConfig";
import type {
  AdminCategory,
  AdminComboProduct,
  AdminCustomer,
  AdminDiscountCode,
  AdminHeroSlide,
  AdminMessage,
  AdminOrder,
  AdminProduct,
  AdminWalletTransaction,
} from "../types/admin";
import type {
  DeliveryMethod,
  Order,
  OrderStatus,
  OrderType,
  WalletTransaction,
} from "../types/order";

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
  { id: "bakery", label: "نان و شیرینی" },
  { id: "drinks", label: "نوشیدنی" },
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

interface ApiComboProduct extends ApiProduct {
  comboExpiresAt?: string | null;
  comboShowExpiryBadge?: boolean;
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

/** Combo products have no category — labeled "کمبو" instead for the product detail badge. */
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getComboProducts(): Promise<MenuItem[]> {
  const data = await apiFetch<ApiComboProduct[]>("/api/products/combo", {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
  });
  return data.map((p) => {
    const item = mapProduct(p, "کمبو");
    if (p.comboShowExpiryBadge && p.comboExpiresAt) {
      const daysLeft = Math.ceil((new Date(p.comboExpiresAt).getTime() - Date.now()) / DAY_MS);
      if (daysLeft > 0) item.comboDaysLeft = daysLeft;
    }
    return item;
  });
}

export interface HeroSlide {
  id: string;
  image: string;
}

export async function getHeroSlides(): Promise<HeroSlide[]> {
  const data = await apiFetch<AdminHeroSlide[]>("/api/hero-slides", {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
  });
  return data.map((s) => ({ ...s, image: apiUploadUrl(s.image) }));
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
  birthDate?: string;
  walletBalance: number;
  /** Only present on GET /me, while an unexpired birthday discount code exists for the customer and is still unused. */
  birthdayDiscount?: { code: string; percent: number; expiresAt: string } | null;
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
  /** ISO datetime string, or null to clear it. */
  birthDate?: string | null;
}

export function updateMyProfile(payload: UpdateProfilePayload) {
  return apiFetch<CustomerAuthUser>("/api/customers/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getMyOrders(page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<Order>>(`/api/customers/me/orders?${params.toString()}`);
}

export interface MyWallet {
  balance: number;
  transactions: Paginated<WalletTransaction>;
}

export function getMyWallet(page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<MyWallet>(`/api/customers/me/wallet?${params.toString()}`);
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
  orderType?: OrderType;
}

export function getMyCart(orderType?: OrderType) {
  const query = orderType ? `?orderType=${orderType}` : "";
  return apiFetch<ApiCartItem[]>(`/api/customers/me/cart${query}`);
}

export function addMyCartItem(payload: AddCartItemPayload) {
  return apiFetch<ApiCartItem>("/api/customers/me/cart", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyCartItem(id: string, quantity: number, orderType?: OrderType) {
  return apiFetch<ApiCartItem>(`/api/customers/me/cart/${id}`, {
    method: "PUT",
    body: JSON.stringify({ quantity, orderType }),
  });
}

export function removeMyCartItem(id: string) {
  return apiFetch(`/api/customers/me/cart/${id}`, { method: "DELETE" });
}

export function clearMyCart() {
  return apiFetch("/api/customers/me/cart", { method: "DELETE" });
}

export interface CreateOrderPayload {
  addressId?: string;
  deliveryMethod?: DeliveryMethod;
  customerName?: string;
  note?: string;
  orderType?: OrderType;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  discountCode?: string;
  useWallet?: boolean;
}

export interface CreateOrderResult {
  order: Order;
  paymentUrl: string | null;
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
  outOfRange: boolean;
  maxDeliveryRadiusKm: number;
}

export function getShippingEstimate(addressId: string) {
  return apiFetch<ShippingEstimate>(`/api/shipping/estimate?addressId=${addressId}`);
}

export interface DiscountCodeValidation {
  code: string;
  percent: number;
}

export function validateDiscountCode(code: string) {
  return apiFetch<DiscountCodeValidation>("/api/discount-codes/validate", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
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

export function adminChangePassword(currentPassword: string, newPassword: string) {
  return apiFetch<void>("/api/admin/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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

export function adminGetHeroSlides() {
  return apiFetch<AdminHeroSlide[]>("/api/admin/hero-slides");
}

export function adminCreateHeroSlide(payload: Record<string, unknown>) {
  return apiFetch<AdminHeroSlide>("/api/admin/hero-slides", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUpdateHeroSlide(id: string, payload: Record<string, unknown>) {
  return apiFetch<AdminHeroSlide>(`/api/admin/hero-slides/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteHeroSlide(id: string) {
  return apiFetch(`/api/admin/hero-slides/${id}`, { method: "DELETE" });
}

export function adminGetComboProducts(page = 1, pageSize = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiFetch<Paginated<AdminComboProduct>>(`/api/admin/combo?${params.toString()}`);
}

export function adminCreateComboProduct(payload: Record<string, unknown>) {
  return apiFetch<AdminComboProduct>("/api/admin/combo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUpdateComboProduct(id: string, payload: Record<string, unknown>) {
  return apiFetch<AdminComboProduct>(`/api/admin/combo/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteComboProduct(id: string) {
  return apiFetch(`/api/admin/combo/${id}`, { method: "DELETE" });
}

export function adminBulkDeleteComboProducts(ids: string[]) {
  return adminBulkDelete("/api/admin/combo", ids);
}

export type AdminProductStatusFilter = "available" | "unavailable";

export function adminGetProducts(
  page = 1,
  pageSize = 20,
  search = "",
  categoryId = "",
  status?: AdminProductStatusFilter,
  includeCombo = false,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  if (categoryId) params.set("categoryId", categoryId);
  if (status) params.set("status", status);
  if (includeCombo) params.set("includeCombo", "true");
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

export interface BulkImportError {
  row: number;
  message: string;
}

export interface BulkImportResult {
  createdCount: number;
  errors: BulkImportError[];
}

export function adminBulkImportProducts(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<BulkImportResult>("/api/admin/products/bulk-import", {
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

export function adminUpdateOrderPaymentStatus(id: string, paymentStatus: "pending" | "paid") {
  return apiFetch(`/api/admin/orders/${id}/payment-status`, {
    method: "PATCH",
    body: JSON.stringify({ paymentStatus }),
  });
}

export interface AdminCreateOrderPayload {
  customerId: string;
  items?: { productId: string; variantId?: string; quantity: number }[];
  /** Skips per-product entry entirely — a single generic line item is created with this as its price. */
  manualSubtotal?: number;
  deliveryMethod: DeliveryMethod;
  addressId?: string;
  addressText?: string;
  shippingCost?: number;
  discountCode?: string;
  /** Toman amount to redeem from the customer's wallet for this order — capped server-side at their balance and the order total. Omit to skip the wallet entirely. */
  walletAmount?: number;
  paymentStatus: "pending" | "paid";
  customerName?: string;
  note?: string;
}

export function adminCreateOrder(payload: AdminCreateOrderPayload) {
  return apiFetch<AdminOrder>("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify(payload),
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

export interface AdminCreateCustomerPayload {
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export function adminCreateCustomer(payload: AdminCreateCustomerPayload) {
  return apiFetch<AdminCustomer>("/api/admin/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteCustomer(id: string) {
  return apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
}

export function adminBulkDeleteCustomers(ids: string[]) {
  return adminBulkDelete("/api/admin/customers", ids);
}

/* ------------------------------------------------------------------ */
/* Site status (public)                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_MENU_BANNER_IMAGE = "/assets/cat-banner.jpg";

export async function getSiteStatus(): Promise<{
  siteClosed: boolean;
  manuallyClosed: boolean;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  walletCashbackPercent: number;
  menuBannerImage: string;
}> {
  try {
    // An operational toggle — never served stale from the SSR data cache;
    // the client also polls this directly to catch admin changes mid-session.
    const data = await apiFetch<{
      siteClosed: boolean;
      manuallyClosed: boolean;
      businessHoursEnabled: boolean;
      businessHoursStart: string;
      businessHoursEnd: string;
      walletCashbackPercent: number;
      menuBannerImage: string | null;
    }>("/api/settings/status", { next: { revalidate: 0 } });
    return {
      siteClosed: data.siteClosed,
      manuallyClosed: data.manuallyClosed,
      businessHoursEnabled: data.businessHoursEnabled,
      businessHoursStart: data.businessHoursStart,
      businessHoursEnd: data.businessHoursEnd,
      walletCashbackPercent: data.walletCashbackPercent,
      menuBannerImage: data.menuBannerImage
        ? apiUploadUrl(data.menuBannerImage)
        : DEFAULT_MENU_BANNER_IMAGE,
    };
  } catch {
    return {
      siteClosed: false,
      manuallyClosed: false,
      businessHoursEnabled: false,
      businessHoursStart: "09:00",
      businessHoursEnd: "22:30",
      walletCashbackPercent: 0,
      menuBannerImage: DEFAULT_MENU_BANNER_IMAGE,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Admin settings (shipping cost tiers)                                */
/* ------------------------------------------------------------------ */

export interface AdminSettings {
  shippingCostUpTo5Km: number;
  shippingCostOver5Km: number;
  maxDeliveryRadiusKm: number;
  siteClosed: boolean;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  walletCashbackPercent: number;
  menuBannerImage: string | null;
}

export function adminGetSettings() {
  return apiFetch<AdminSettings>("/api/admin/settings");
}

export function adminUpdateSettings(payload: Partial<AdminSettings>) {
  return apiFetch<AdminSettings>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ */
/* Admin discount codes                                                */
/* ------------------------------------------------------------------ */

export function adminGetDiscountCodes(page = 1, pageSize = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiFetch<Paginated<AdminDiscountCode>>(`/api/admin/discount-codes?${params.toString()}`);
}

export function adminCreateManualDiscountCode(code: string, percent: number) {
  return apiFetch<AdminDiscountCode>("/api/admin/discount-codes", {
    method: "POST",
    body: JSON.stringify({ mode: "manual", code, percent }),
  });
}

export function adminGenerateDiscountCode(percent: number) {
  return apiFetch<AdminDiscountCode>("/api/admin/discount-codes", {
    method: "POST",
    body: JSON.stringify({ mode: "auto", percent }),
  });
}

export function adminUpdateDiscountCode(
  id: string,
  payload: { percent?: number; isActive?: boolean },
) {
  return apiFetch<AdminDiscountCode>(`/api/admin/discount-codes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteDiscountCode(id: string) {
  return apiFetch(`/api/admin/discount-codes/${id}`, { method: "DELETE" });
}

export function adminBulkDeleteDiscountCodes(ids: string[]) {
  return adminBulkDelete("/api/admin/discount-codes", ids);
}

/* ------------------------------------------------------------------ */
/* Admin messages (notification inbox)                                 */
/* ------------------------------------------------------------------ */

export function adminGetMessages(page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<AdminMessage>>(`/api/admin/messages?${params.toString()}`);
}

export function adminGetUnreadMessageCount() {
  return apiFetch<{ count: number }>("/api/admin/messages/unread-count");
}

export function adminMarkMessageRead(id: string) {
  return apiFetch<AdminMessage>(`/api/admin/messages/${id}/read`, { method: "PATCH" });
}

export function adminCreateBirthdayDiscountFromMessage(id: string, percent: number) {
  return apiFetch<AdminDiscountCode>(`/api/admin/messages/${id}/birthday-discount`, {
    method: "POST",
    body: JSON.stringify({ percent }),
  });
}

/* ------------------------------------------------------------------ */
/* Admin wallet                                                        */
/* ------------------------------------------------------------------ */

export function adminGetWalletCustomers(page = 1, pageSize = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiFetch<Paginated<AdminCustomer>>(`/api/admin/wallet/customers?${params.toString()}`);
}

export function adminGetCustomerWalletTransactions(customerId: string, page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<AdminWalletTransaction>>(
    `/api/admin/wallet/customers/${customerId}/transactions?${params.toString()}`,
  );
}
