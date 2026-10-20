import type { NextFunction, Request, Response } from 'express';
import { verifyCustomerToken } from '../services/storeAuth';
import { ApiError } from '../utils/ApiError';
import { Customer } from '../models/Customer';

/** Attach req.customer when a valid customer token is present, but never reject (for public + anonymous routes). */
export async function optionalCustomer(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = verifyCustomerToken(header.slice(7).trim());
    const customer = await Customer.findById(payload.sub).select('name email active').lean();
    if (customer && customer.active) {
      req.customer = { id: String(customer._id), email: customer.email ?? '', name: customer.name };
    }
  } catch {
    // Ignore bad/expired tokens — treat as anonymous.
  }
  next();
}

/** Require a valid storefront (customer) bearer token; loads the account onto req.customer. */
export async function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
    const token = header.slice(7).trim();
    const payload = verifyCustomerToken(token);
    const customer = await Customer.findById(payload.sub).select('name email active').lean();
    if (!customer || !customer.active) throw ApiError.unauthorized('Account is inactive or no longer exists');
    req.customer = { id: String(customer._id), email: customer.email ?? '', name: customer.name };
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized('Invalid or expired session'));
  }
}
