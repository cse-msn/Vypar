import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { signToken } from '../services/auth';
import { ROLES } from '../constants';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' } },
});

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(ROLES).optional(),
});

/**
 * Register a user.
 * - First ever user is bootstrapped as the "owner" (no auth required).
 * - After that, only an owner may create users.
 */
router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const count = await User.estimatedDocumentCount();
    const body = req.body as z.infer<typeof registerSchema>;

    if (count > 0) {
      // Must be an authenticated owner to add more users.
      await new Promise<void>((resolve, reject) =>
        requireAuth(req, res, (e) => (e ? reject(e) : resolve())),
      );
      if (req.user?.role !== 'owner') throw ApiError.forbidden('Only the owner can create users');
    }

    const role = count === 0 ? 'owner' : body.role ?? 'staff';
    const passwordHash = await User.hashPassword(body.password);
    const user = await User.create({ name: body.name, email: body.email, passwordHash, role });
    res.status(201).json({ data: user });
  }),
);

router.post(
  '/login',
  loginLimiter,
  validateBody(z.object({ email: z.string().trim().email(), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.active) throw ApiError.unauthorized('Invalid email or password');
    const ok = await user.comparePassword(password);
    if (!ok) throw ApiError.unauthorized('Invalid email or password');

    const token = signToken({ sub: String(user._id), role: user.role, email: user.email, name: user.name });
    res.json({ data: { token, user: user.toJSON() } });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw ApiError.unauthorized();
    res.json({ data: user });
  }),
);

router.get(
  '/users',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ data: users });
  }),
);

const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.patch(
  '/users/:id',
  requireAuth,
  requireRole('owner'),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateUserSchema>;
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');

    // Guard against the owner locking themselves out.
    if (String(user._id) === req.user!.id && body.active === false) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }
    if (body.name !== undefined) user.name = body.name;
    if (body.role !== undefined) user.role = body.role;
    if (body.active !== undefined) user.active = body.active;
    if (body.password) user.passwordHash = await User.hashPassword(body.password);
    await user.save();
    res.json({ data: user });
  }),
);

export default router;
