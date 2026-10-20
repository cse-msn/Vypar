export const ROLES = ['owner', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank', 'credit', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUS = ['paid', 'partial', 'unpaid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const INVOICE_STATUS = ['confirmed', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const PURCHASE_STATUS = ['received', 'cancelled'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS)[number];

/** Default low-stock threshold (pieces) when a variant doesn't set its own. */
export const DEFAULT_LOW_STOCK = 3;

// ───────────────────────── Online store (customer-facing) ─────────────────────────
export const ORDER_PAYMENT_METHODS = ['cod', 'online'] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export const ORDER_PAYMENT_STATUS = ['pending', 'paid', 'failed', 'refunded'] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUS)[number];

/** Fulfillment lifecycle of an online order. */
export const ORDER_STATUS = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

/** Customer journey events tracked on the online store. */
export const STORE_EVENT_TYPES = [
  'page_view',
  'view_product',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
  'signup',
  'login',
] as const;
export type StoreEventType = (typeof STORE_EVENT_TYPES)[number];
