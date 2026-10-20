import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

/** A saved, not-yet-finalised bill. Holds an opaque snapshot of the Billing screen state. */
export interface IDraft {
  user?: Types.ObjectId | string;
  /** Snapshot of the in-progress bill (customer, lines, discount, tax, payment…). */
  data: unknown;
  customerName: string;
  itemCount: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DraftDoc = HydratedDocument<IDraft>;

const draftSchema = new Schema<IDraft>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    data: { type: Schema.Types.Mixed, default: {} },
    customerName: { type: String, trim: true, default: 'Walk-in Customer' },
    itemCount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

applyToJSON(draftSchema);

export const Draft = model<IDraft>('Draft', draftSchema);
