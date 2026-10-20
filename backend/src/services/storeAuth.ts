import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

/** Storefront customer token — distinct from staff/owner tokens via the `typ` claim. */
export interface CustomerJwtPayload {
  sub: string;
  typ: 'customer';
  email: string;
  name: string;
}

export function signCustomerToken(payload: Omit<CustomerJwtPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'customer' }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyCustomerToken(token: string): CustomerJwtPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as CustomerJwtPayload;
  if (payload.typ !== 'customer') throw new Error('Not a customer token');
  return payload;
}
