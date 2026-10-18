import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/auth';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import type { Role } from '../constants';

/** Require a valid bearer token; loads the (still-active) user onto req.user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
    const token = header.slice(7).trim();
    const payload = verifyToken(token);

    // Confirm the account still exists and is active (handles disabled users mid-session).
    const user = await User.findById(payload.sub).select('name email role active').lean();
    if (!user || !user.active) throw ApiError.unauthorized('Account is inactive or no longer exists');

    req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict a route to specific roles (use after requireAuth). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
