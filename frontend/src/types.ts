// Shared API entity types (mirror of the backend models' JSON shape).

export type Role = 'owner' | 'staff';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank' | 'credit' | 'other';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type InvoiceStatus = 'confirmed' | 'cancelled';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  _id: string;
  color: string;
  size: string;
  seq?: number;
  /** Numeric item code / barcode, e.g. 200007001. */
  sku: string;
  quantity: number;
  costPrice?: number;
  sellingPrice?: number;
  lowStockThreshold: number;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface Product {
  _id: string;
  /** Numeric design/item base code, e.g. 200007. */
  code: number;
  designNumber: string;
  name: string;
  category?: string;
  subCategory?: string;
  sizeGroup?: string;
  dupatta?: string;
  dupattaHeight?: number;
  backOpening?: string;
  blouseSize?: string;
  gher?: number;
  cap?: string;
  belt?: string;
  sleeves?: string;
  backClosure?: string;
  bottomType?: string;
  b2bPrice?: number;
  b2cPrice?: number;
  fabric?: string;
  brand?: string;
  hsnCode?: string;
  unit?: string;
  taxRate?: number;
  description?: string;
  imageUrl?: string;
  images?: string[];
  videos?: string[];
  customFields?: CustomField[];
  costPrice: number;
  sellingPrice: number;
  variants: Variant[];
  totalStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
}

export interface Customer {
  _id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  altPhone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  notes?: string;
  balance: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SizeGroup {
  _id: string;
  name: string;
  sizes: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Color {
  _id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  notes?: string;
  balance: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  product: string;
  variantId: string;
  designNumber: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  discount: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer?: string | Customer | null;
  customerSnapshot: { name: string; phone?: string; whatsapp?: string; address?: string; gstin?: string };
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: InvoiceStatus;
  publicToken: string;
  publicTokenActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  paymentNumber: string;
  customer: string | Customer;
  invoice?: string | { _id: string; invoiceNumber: string; total: number } | null;
  amount: number;
  method: PaymentMethod;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  product: string;
  variantId: string;
  designNumber: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  costPrice: number;
  amount: number;
}

export interface Purchase {
  _id: string;
  purchaseNumber: string;
  supplier: string | Supplier;
  supplierBillNo?: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: 'received' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface OrderItem {
  product: string;
  variantId: string;
  designNumber: string;
  productName: string;
  color: string;
  size: string;
  sku?: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: string | Customer;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  discountCode?: string;
  total: number;
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: ShippingAddress;
  notes?: string;
  placedAt: string;
  createdAt: string;
}

export type DiscountType = 'percentage' | 'fixed' | 'free_shipping';

export interface Discount {
  _id: string;
  code: string;
  description?: string;
  type: DiscountType;
  value: number;
  minSubtotal: number;
  maxDiscount: number;
  usageLimit: number;
  usageCount: number;
  perCustomerLimit: number;
  startsAt?: string;
  endsAt?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number; hasMore: boolean };
}

/** A saved, not-yet-finalised bill. `data` is an opaque Billing-screen snapshot. */
export interface Draft {
  _id: string;
  data: unknown;
  customerName: string;
  itemCount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

/** Shop profile (from backend config) shown on Settings and printed on invoices. */
export interface ShopDetails {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  email?: string;
  state?: string;
  stateCode?: string;
  defaultHsn?: string;
  bank: { name?: string; account?: string; ifsc?: string };
}

export interface InvoiceShare {
  publicUrl: string;
  message: string;
  /** Short amount summary used as the caption when sharing the PDF file. */
  pdfMessage: string;
  whatsappUrl: string;
  /** wa.me chat prefilled with the short amount summary (no link) — for the PDF flow. */
  pdfWhatsappUrl: string;
  hasNumber: boolean;
}

export interface DashboardSummary {
  salesToday: { total: number; count: number };
  salesMonth: { total: number; count: number };
  outstandingReceivable: number;
  productCount: number;
  customerCount: number;
  lowStockCount: number;
  lowStock: LowStockRow[];
  recentInvoices: Invoice[];
}

export interface LowStockRow {
  productId: string;
  designNumber: string;
  name: string;
  color: string;
  size: string;
  sku?: string;
  quantity: number;
  threshold: number;
}

export interface PublicInvoice {
  shop: { name: string; address?: string; phone?: string; gstin?: string };
  invoiceNumber: string;
  date: string;
  status: InvoiceStatus;
  customerName: string;
  items: Array<{
    designNumber: string;
    productName: string;
    color: string;
    size: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentStatus: PaymentStatus;
  pdfUrl: string;
}
