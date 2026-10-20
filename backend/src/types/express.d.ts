import type { Role } from '../constants';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        email: string;
        name: string;
      };
      /** Set by storefront auth (requireCustomer) for the customer-facing shop API. */
      customer?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export {};
