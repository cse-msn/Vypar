import axios from 'axios';

// The storefront uses its own customer token (separate from the staff/admin token) and a
// stable per-browser anonymousId so pre-login browsing stitches to the account on signup.
const STORE_TOKEN_KEY = 'store_token';
const ANON_KEY = 'store_anon';

export const getStoreToken = () => localStorage.getItem(STORE_TOKEN_KEY);
export const setStoreToken = (t: string) => localStorage.setItem(STORE_TOKEN_KEY, t);
export const clearStoreToken = () => localStorage.removeItem(STORE_TOKEN_KEY);

export function getAnonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export const storeApi = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '/api') + '/store',
  timeout: 20000,
});

storeApi.interceptors.request.use((config) => {
  const t = getStoreToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

/** Fire-and-forget customer-journey event. */
export function trackEvent(type: string, extra: Record<string, unknown> = {}): void {
  storeApi
    .post('/events', { anonymousId: getAnonId(), sessionId: sessionId(), events: [{ type, ...extra }] })
    .catch(() => undefined);
}

export interface ShippingOption {
  id: string;
  label: string;
  price: number;
  eta?: string;
}

// ---- Razorpay Checkout ----
export interface RazorpayPayment {
  provider: 'razorpay';
  keyId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (resp: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

/** Lazily inject Razorpay's hosted Checkout script. Resolves false if it can't load. */
export function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function openRazorpay(options: RazorpayOptions): void {
  if (!window.Razorpay) throw new Error('Razorpay is not loaded');
  new window.Razorpay(options).open();
}

// Per-tab session id.
let _sid: string | undefined;
function sessionId(): string {
  if (!_sid) _sid = sessionStorage.getItem('store_sid') || '';
  if (!_sid) {
    _sid = 's-' + Math.random().toString(36).slice(2);
    sessionStorage.setItem('store_sid', _sid);
  }
  return _sid;
}

// ---- Public types (mirror the backend toPublic shape) ----
export interface StoreVariant {
  id: string;
  color: string;
  size: string;
  sku: string;
  inStock: boolean;
}
export interface StoreProduct {
  id: string;
  designNumber: string;
  name: string;
  category?: string;
  subCategory?: string;
  description?: string;
  images: string[];
  videos: string[];
  price: number;
  compareAtPrice?: number;
  sizeGroup?: string;
  tags?: string[];
  handle?: string;
  fabric?: string;
  dupatta?: string;
  backOpening?: string;
  blouseSize?: string;
  gher?: number;
  sleeves?: string;
  backClosure?: string;
  bottomType?: string;
  variants: StoreVariant[];
  inStock: boolean;
}

/** Distinct facet values for the storefront filter dropdowns (from GET /products/filters). */
export interface StoreFilterOptions {
  category: string[];
  subCategory: string[];
  dupatta: string[];
  backOpening: string[];
  blouseSize: string[];
  sleeves: string[];
  backClosure: string[];
  bottomType: string[];
  sizeGroup: string[];
  fabric: string[];
  gher: number[];
  size: string[];
  color: string[];
}

export interface StoreCollection {
  id: string;
  title: string;
  handle: string;
  description?: string;
  image?: string;
  featured: boolean;
}
export interface StoreOrder {
  _id: string;
  orderNumber: string;
  items: { designNumber: string; productName: string; color: string; size: string; quantity: number; price: number; amount: number }[];
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  placedAt: string;
  createdAt: string;
}
