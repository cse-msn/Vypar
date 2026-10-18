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
