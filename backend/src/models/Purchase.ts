import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import { PURCHASE_STATUS, type PurchaseStatus } from '../constants';

export interface IPurchaseItem {
  product: Types.ObjectId;
  variantId: Types.ObjectId;
  designNumber: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  costPrice: number;
  amount: number;
}

export interface IPurchase {
  purchaseNumber: string;
  supplier: Types.ObjectId;
  supplierBillNo?: string;
  date: Date;
  items: IPurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: PurchaseStatus;
  notes?: string;
  createdBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PurchaseDoc = HydratedDocument<IPurchase>;

const purchaseItemSchema = new Schema<IPurchaseItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    designNumber: { type: String, required: true },
    productName: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    supplierBillNo: { type: String, trim: true },
    date: { type: Date, default: Date.now, index: true },
    items: { type: [purchaseItemSchema], required: true },
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: PURCHASE_STATUS, default: 'received', index: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

applyToJSON(purchaseSchema);

export const Purchase = model<IPurchase>('Purchase', purchaseSchema);
