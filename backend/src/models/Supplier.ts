import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

export interface ISupplier {
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  notes?: string;
  /** Outstanding amount payable to this supplier (we owe them). */
  balance: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SupplierDoc = HydratedDocument<ISupplier>;

const supplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    balance: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supplierSchema.index({ name: 'text', phone: 'text' });
applyToJSON(supplierSchema);

export const Supplier = model<ISupplier>('Supplier', supplierSchema);
