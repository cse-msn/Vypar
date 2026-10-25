import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import { DISCOUNT_TYPES, type DiscountType } from '../constants';

export interface IDiscount {
  /** The code the customer types at checkout, stored upper-cased, e.g. "DIWALI10". */
  code: string;
  description?: string;
  type: DiscountType;
  /** For percentage: 0–100. For fixed: rupee amount off. Ignored for free_shipping. */
  value: number;
  /** Minimum cart subtotal (₹) required for the code to apply. */
  minSubtotal: number;
  /** Cap the rupee discount (₹) for a percentage code. 0 = no cap. */
  maxDiscount: number;
  /** Total number of times the code may be used across all customers. 0 = unlimited. */
  usageLimit: number;
  /** How many times the code has been redeemed so far. */
  usageCount: number;
  /** Times a single customer may use the code. 0 = unlimited. */
  perCustomerLimit: number;
  startsAt?: Date;
  endsAt?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type DiscountDoc = HydratedDocument<IDiscount>;

const discountSchema = new Schema<IDiscount>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    description: { type: String, trim: true },
    type: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, default: 0, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },
    usageCount: { type: Number, default: 0, min: 0 },
    perCustomerLimit: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

applyToJSON(discountSchema);

export const Discount = model<IDiscount>('Discount', discountSchema);
