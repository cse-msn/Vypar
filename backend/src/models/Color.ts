import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

export interface IColor {
  /** Colour name shown in the product form, e.g. "Red", "Royal Blue". */
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ColorDoc = HydratedDocument<IColor>;

const colorSchema = new Schema<IColor>(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

applyToJSON(colorSchema);

export const Color = model<IColor>('Color', colorSchema);
