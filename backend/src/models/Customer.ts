import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

export interface ICustomer {
  name: string;
  phone?: string;
  /** WhatsApp number; falls back to `phone` when empty. Digits + optional country code. */
  whatsapp?: string;
  email?: string;
  gstin?: string;
  address?: string;
  notes?: string;
  /** Outstanding amount receivable from this customer (they owe us). */
  balance: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerDoc = HydratedDocument<ICustomer>;

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    balance: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customerSchema.index({ name: 'text', phone: 'text' });
applyToJSON(customerSchema);

export const Customer = model<ICustomer>('Customer', customerSchema);
