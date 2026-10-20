import { env } from '../config/env';
import { ShopProfile, type IShopProfile } from '../models/ShopProfile';

export interface ShopProfileShape {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  email: string;
  state: string;
  stateCode: string;
  defaultHsn: string;
  bank: { name: string; account: string; ifsc: string };
}

const ov = (v: string | undefined, def: string) => (v && v.trim() !== '' ? v : def);

/** Effective shop profile: saved overrides (DB) layered on top of config defaults (env). */
export async function getShopProfile(): Promise<ShopProfileShape> {
  const d = await ShopProfile.findOne().lean<IShopProfile>().exec();
  return {
    name: ov(d?.name, env.shop.name),
    address: ov(d?.address, env.shop.address),
    phone: ov(d?.phone, env.shop.phone),
    gstin: ov(d?.gstin, env.shop.gstin),
    email: ov(d?.email, env.shop.email),
    state: ov(d?.state, env.shop.state),
    stateCode: ov(d?.stateCode, env.shop.stateCode),
    defaultHsn: ov(d?.defaultHsn, env.shop.defaultHsn),
    bank: {
      name: ov(d?.bank?.name, env.shop.bank.name),
      account: ov(d?.bank?.account, env.shop.bank.account),
      ifsc: ov(d?.bank?.ifsc, env.shop.bank.ifsc),
    },
  };
}

/** Upsert the single shop-profile document, then return the effective profile. */
export async function updateShopProfile(patch: IShopProfile): Promise<ShopProfileShape> {
  await ShopProfile.findOneAndUpdate({}, { $set: patch }, { upsert: true, new: true, runValidators: true });
  return getShopProfile();
}
