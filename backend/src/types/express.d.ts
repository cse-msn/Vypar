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
    }
  }
}

export {};
