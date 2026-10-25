import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';
import { Discount } from '../models/Discount';
import { DISCOUNT_TYPES } from '../constants';

const router = Router();
router.use(requireAuth);

const discountInput = z.object({
  code: z.string().trim().min(1, 'Code is required').max(40),
  description: z.string().trim().max(200).optional(),
  type: z.enum(DISCOUNT_TYPES),
  value: z.coerce.number().min(0).default(0),
  minSubtotal: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().min(0).default(0),
  usageLimit: z.coerce.number().int().min(0).default(0),
  perCustomerLimit: z.coerce.number().int().min(0).default(0),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  active: z.boolean().optional(),
});

// List — staff can view; mutations are owner-only.
router.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page, limit, search } = req.query as unknown as z.infer<typeof paginationSchema>;
    const filter = search ? { code: new RegExp(escapeRegex(search.toUpperCase())) } : {};
    const { skip } = paginate(page, limit);
    const [items, total] = await Promise.all([
      Discount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Discount.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, page, limit) });
  }),
);

router.post(
  '/',
  requireRole('owner'),
  validateBody(discountInput),
  asyncHandler(async (req, res) => {
    const code = (req.body.code as string).trim().toUpperCase();
    const existing = await Discount.findOne({ code });
    if (existing) throw ApiError.badRequest('A discount with this code already exists');
    const discount = await Discount.create({ ...req.body, code });
    res.status(201).json({ data: discount });
  }),
);

router.patch(
  '/:id',
  requireRole('owner'),
  validateBody(discountInput.partial()),
  asyncHandler(async (req, res) => {
    if (req.body.code) {
      const code = (req.body.code as string).trim().toUpperCase();
      const clash = await Discount.findOne({ code, _id: { $ne: req.params.id } });
      if (clash) throw ApiError.badRequest('A discount with this code already exists');
      req.body.code = code;
    }
    const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!discount) throw ApiError.notFound('Discount not found');
    res.json({ data: discount });
  }),
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    if (!discount) throw ApiError.notFound('Discount not found');
    res.json({ data: discount, message: 'Discount deleted' });
  }),
);

export default router;
