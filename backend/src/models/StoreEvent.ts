import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';
import { STORE_EVENT_TYPES, type StoreEventType } from '../constants';

/**
 * A single customer-journey event on the online store. Captured for both anonymous
 * visitors (by `anonymousId`) and signed-in customers (by `customer`). When a visitor
 * signs up / logs in, their earlier anonymous events are stitched to their customer id.
 */
export interface IStoreEvent {
  type: StoreEventType;
  /** Set once the visitor is (or becomes) a known customer. */
  customer?: Types.ObjectId;
  /** Stable per-browser id sent by the storefront, present even before login. */
  anonymousId?: string;
  /** Per-visit id (resets on a new session). */
  sessionId?: string;
  // Context (sparse — depends on the event type).
  product?: Types.ObjectId;
  variantId?: Types.ObjectId;
  query?: string;
  quantity?: number;
  value?: number; // monetary value, e.g. cart/line amount
  path?: string; // page path
  referrer?: string;
  userAgent?: string;
  ip?: string;
  /** Anything extra the storefront wants to attach. */
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type StoreEventDoc = HydratedDocument<IStoreEvent>;

const storeEventSchema = new Schema<IStoreEvent>(
  {
    type: { type: String, enum: STORE_EVENT_TYPES, required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    anonymousId: { type: String, index: true },
    sessionId: { type: String },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId },
    query: { type: String, trim: true },
    quantity: { type: Number },
    value: { type: Number },
    path: { type: String, trim: true },
    referrer: { type: String, trim: true },
    userAgent: { type: String },
    ip: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Fast "what did this customer do, most recent first" and journey-by-anon lookups.
storeEventSchema.index({ customer: 1, createdAt: -1 });
storeEventSchema.index({ anonymousId: 1, createdAt: -1 });

applyToJSON(storeEventSchema);

export const StoreEvent = model<IStoreEvent>('StoreEvent', storeEventSchema);
