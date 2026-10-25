import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

export const ZONE_MATCH_TYPES = ['all', 'states', 'pincodes'] as const;
export type ZoneMatchType = (typeof ZONE_MATCH_TYPES)[number];

export interface IShippingRate {
  _id?: Types.ObjectId;
  /** Shown to the customer, e.g. "Standard", "Express". */
  label: string;
  /** Delivery charge (₹). */
  price: number;
  /** Order subtotal (₹) at/above which this rate is free. 0 = never free. */
  freeAbove: number;
  /** Human estimate, e.g. "3–5 days". */
  eta?: string;
}

export interface IShippingZone {
  name: string;
  /** all = anywhere in India; states = match shippingAddress.state; pincodes = match a pincode prefix. */
  matchType: ZoneMatchType;
  states: string[];
  pincodePrefixes: string[];
  rates: Types.DocumentArray<IShippingRate>;
  /** Lower is checked first; the first matching zone wins. */
  priority: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ShippingZoneDoc = HydratedDocument<IShippingZone>;

const rateSchema = new Schema<IShippingRate>({
  label: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0, default: 0 },
  freeAbove: { type: Number, min: 0, default: 0 },
  eta: { type: String, trim: true },
});

const zoneSchema = new Schema<IShippingZone>(
  {
    name: { type: String, required: true, trim: true },
    matchType: { type: String, enum: ZONE_MATCH_TYPES, default: 'all' },
    states: { type: [String], default: [] },
    pincodePrefixes: { type: [String], default: [] },
    rates: { type: [rateSchema], default: [] },
    priority: { type: Number, default: 0, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

applyToJSON(zoneSchema);

export const ShippingZone = model<IShippingZone>('ShippingZone', zoneSchema);
