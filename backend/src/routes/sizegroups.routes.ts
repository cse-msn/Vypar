import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { SizeGroup } from '../models/SizeGroup';

const router = Router();
router.use(requireAuth);

const sizeGroupInput = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  // At least one non-empty size; trim each and drop blanks.
  sizes: z
    .array(z.string().trim())
    .transform((arr) => arr.map((s) => s.trim()).filter(Boolean))
    .refine((arr) => arr.length > 0, 'At least one size is required'),
});

// List — available to any authenticated user (the product form needs these).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await SizeGroup.find({ active: true }).sort({ name: 1 });
    res.json({ data: items });
  }),
);

// Mutations are owner-only.
router.post(
  '/',
  requireRole('owner'),
  validateBody(sizeGroupInput),
  asyncHandler(async (req, res) => {
    const existing = await SizeGroup.findOne({ name: req.body.name });
    if (existing) throw ApiError.badRequest('A size group with this name already exists');
    const group = await SizeGroup.create(req.body);
    res.status(201).json({ data: group });
  }),
);

router.patch(
  '/:id',
  requireRole('owner'),
  validateBody(sizeGroupInput.partial().extend({ active: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    if (req.body.name) {
      const clash = await SizeGroup.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
      if (clash) throw ApiError.badRequest('A size group with this name already exists');
    }
    const group = await SizeGroup.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!group) throw ApiError.notFound('Size group not found');
    res.json({ data: group });
  }),
);

// Hard delete — size groups are only used as a template in the product form,
// so removing one never affects already-saved products/variants.
router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const group = await SizeGroup.findByIdAndDelete(req.params.id);
    if (!group) throw ApiError.notFound('Size group not found');
    res.json({ data: group, message: 'Size group deleted' });
  }),
);

export default router;
