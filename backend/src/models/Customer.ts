import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
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
  /** Set when the customer self-registers on the online store (enables login). */
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

interface CustomerModel extends Model<ICustomer, {}, ICustomerMethods> {
  hashPassword(plain: string): Promise<string>;
}

export type CustomerDoc = HydratedDocument<ICustomer, ICustomerMethods>;

const customerSchema = new Schema<ICustomer, CustomerModel, ICustomerMethods>(
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
    passwordHash: { type: String, select: false },
  },
  { timestamps: true },
);

customerSchema.index({ name: 'text', phone: 'text' });

customerSchema.method('comparePassword', function (candidate: string) {
  return this.passwordHash ? bcrypt.compare(candidate, this.passwordHash) : Promise.resolve(false);
});
customerSchema.static('hashPassword', function (plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
});

applyToJSON(customerSchema, ['passwordHash']);

export const Customer = model<ICustomer, CustomerModel>('Customer', customerSchema);
