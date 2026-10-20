import { Schema, model, type HydratedDocument } from 'mongoose';
import { applyToJSON } from '../utils/toJSON';

/** Editable shop profile (a single document). Overrides the config defaults from env. */
export interface IShopProfile {
  name?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  email?: string;
  state?: string;
  stateCode?: string;
  defaultHsn?: string;
  bank?: { name?: string; account?: string; ifsc?: string };
}

export type ShopProfileDoc = HydratedDocument<IShopProfile>;

const shopProfileSchema = new Schema<IShopProfile>(
  {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    email: { type: String, trim: true, lowercase: true },
    state: { type: String, trim: true },
    stateCode: { type: String, trim: true },
    defaultHsn: { type: String, trim: true },
    bank: {
      name: { type: String, trim: true },
      account: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
    },
  },
  { timestamps: true },
);

applyToJSON(shopProfileSchema);

export const ShopProfile = model<IShopProfile>('ShopProfile', shopProfileSchema);
