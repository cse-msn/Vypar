import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import { PAYMENT_METHODS, type PaymentMethod } from '../constants';

export interface IPayment {
  paymentNumber: string;
  customer: Types.ObjectId;
  /** Optional invoice this receipt is applied against. */
  invoice?: Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  date: Date;
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDoc = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    paymentNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be positive'] },
    method: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    date: { type: Date, default: Date.now, index: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

applyToJSON(paymentSchema);

export const Payment = model<IPayment>('Payment', paymentSchema);
