import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { requireCustomer } from '../../middleware/customerAuth';
import { ApiError } from '../../utils/ApiError';
import { Customer, type CustomerDoc } from '../../models/Customer';
import { signCustomerToken } from '../../services/storeAuth';
import { stitchAnonymousEvents } from '../../services/storeEvents';

const router = Router();

const tokenFor = (c: CustomerDoc) => signCustomerToken({ sub: String(c._id), email: c.email ?? '', name: c.name });

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().trim().optional(),
  // Stitch the visitor's pre-signup anonymous journey to this new account.
  anonymousId: z.string().trim().optional(),
});

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, anonymousId } = req.body as z.infer<typeof registerSchema>;
    const existing = await Customer.findOne({ email }).select('+passwordHash');
    if (existing?.passwordHash) throw ApiError.badRequest('An account with this email already exists');
    const passwordHash = await Customer.hashPassword(password);
    let customer: CustomerDoc;
    if (existing) {
      // Attach an online login to a customer the shop already has on file.
      existing.passwordHash = passwordHash;
      if (phone && !existing.phone) existing.phone = phone;
      customer = await existing.save();
    } else {
      customer = await Customer.create({ name, email, phone, passwordHash });
    }
    await stitchAnonymousEvents(anonymousId, String(customer._id));
    res.status(201).json({ data: { token: tokenFor(customer), customer } });
  }),
);

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  anonymousId: z.string().trim().optional(),
});

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, anonymousId } = req.body as z.infer<typeof loginSchema>;
    const customer = await Customer.findOne({ email }).select('+passwordHash');
    if (!customer || !customer.active || !(await customer.comparePassword(password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    await stitchAnonymousEvents(anonymousId, String(customer._id));
    res.json({ data: { token: tokenFor(customer), customer } });
  }),
);

router.get(
  '/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.customer!.id);
    if (!customer) throw ApiError.notFound('Account not found');
    res.json({ data: customer });
  }),
);

export default router;
