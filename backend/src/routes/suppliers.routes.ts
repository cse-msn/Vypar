import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Supplier } from '../models/Supplier';
import { Purchase } from '../models/Purchase';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';

const router = Router();
router.use(requireAuth);

const supplierInput = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  gstin: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

router.get(
  '/',
  validateQuery(paginationSchema.extend({ includeInactive: z.coerce.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof paginationSchema> & { includeInactive?: boolean };
    const filter: Record<string, unknown> = {};
    if (!q.includeInactive) filter.active = true;
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { gstin: rx }];
    }
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Supplier.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw ApiError.notFound('Supplier not found');
    const purchases = await Purchase.find({ supplier: supplier._id }).sort({ date: -1 }).limit(50);
    res.json({ data: { supplier, purchases } });
  }),
);

router.post(
  '/',
  validateBody(supplierInput),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.create(req.body);
    res.status(201).json({ data: supplier });
  }),
);

router.patch(
  '/:id',
  validateBody(supplierInput.partial().extend({ active: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) throw ApiError.notFound('Supplier not found');
    res.json({ data: supplier });
  }),
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!supplier) throw ApiError.notFound('Supplier not found');
    res.json({ data: supplier, message: 'Supplier deactivated' });
  }),
);

export default router;
