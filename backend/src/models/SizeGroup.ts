import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

export interface ISizeGroup {
  /** Display name, e.g. "20-24-28-32-36" or "S-M-L-XL". */
  name: string;
  /** Ordered list of sizes in this group, e.g. ["20","24","28"]. */
  sizes: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SizeGroupDoc = HydratedDocument<ISizeGroup>;

const sizeGroupSchema = new Schema<ISizeGroup>(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    sizes: { type: [String], required: true, default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

applyToJSON(sizeGroupSchema);

export const SizeGroup = model<ISizeGroup>('SizeGroup', sizeGroupSchema);
