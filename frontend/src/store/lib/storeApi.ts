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
  sizeGroup?: string;
  variants: StoreVariant[];
  inStock: boolean;
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
