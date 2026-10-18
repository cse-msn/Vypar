import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import {
  INVOICE_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '../constants';
import { generatePublicToken } from '../utils/tokens';

export interface IInvoiceItem {
  product: Types.ObjectId;
  variantId: Types.ObjectId;
  designNumber: string;
  productName: string;
  category?: string;
  sku?: string; // numeric item code, snapshotted for the bill
  hsnCode?: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  discount: number;
  amount: number;
}

export interface IInvoice {
  invoiceNumber: string;
  customer?: Types.ObjectId;
  customerSnapshot: { name: string; phone?: string; whatsapp?: string; address?: string; gstin?: string };
  date: Date;
  items: IInvoiceItem[];
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
  /** Cryptographically secure token backing the public /bill/<token> link. */
  publicToken: string;
  publicTokenActive: boolean;
  pdf?: { key: string; generatedAt: Date };
  /** Client-supplied key making invoice creation safe to retry (duplicate protection). */
  idempotencyKey?: string;
  createdBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceDoc = HydratedDocument<IInvoice>;

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    designNumber: { type: String, required: true },
    productName: { type: String, required: true },
    category: { type: String },
    sku: { type: String },
    hsnCode: { type: String },
    color: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customerSnapshot: {
      name: { type: String, required: true, default: 'Walk-in Customer' },
      phone: String,
      whatsapp: String,
      address: String,
      gstin: String,
    },
    date: { type: Date, default: Date.now, index: true },
    items: { type: [invoiceItemSchema], required: true },
    subtotal: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'unpaid', index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    notes: { type: String, trim: true },
    status: { type: String, enum: INVOICE_STATUS, default: 'confirmed', index: true },
    publicToken: { type: String, required: true, unique: true, default: () => generatePublicToken() },
    publicTokenActive: { type: Boolean, default: true },
    pdf: {
      key: String,
      generatedAt: Date,
    },
    idempotencyKey: { type: String, index: { unique: true, sparse: true } },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true },
);

applyToJSON(invoiceSchema);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
