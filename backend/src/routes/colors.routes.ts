import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Color } from '../models/Color';

const router = Router();
router.use(requireAuth);

const colorInput = z.object({ name: z.string().trim().min(1, 'Name is required') });

// List — available to any authenticated user (the product form needs these).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await Color.find({ active: true }).sort({ name: 1 });
    res.json({ data: items });
  }),
);

// Mutations are owner-only.
router.post(
  '/',
  requireRole('owner'),
  validateBody(colorInput),
  asyncHandler(async (req, res) => {
    const existing = await Color.findOne({ name: req.body.name });
    if (existing) throw ApiError.badRequest('A colour with this name already exists');
    const color = await Color.create(req.body);
    res.status(201).json({ data: color });
  }),
);

router.patch(
  '/:id',
  requireRole('owner'),
  validateBody(colorInput.partial().extend({ active: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    if (req.body.name) {
      const clash = await Color.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
      if (clash) throw ApiError.badRequest('A colour with this name already exists');
    }
    const color = await Color.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!color) throw ApiError.notFound('Colour not found');
    res.json({ data: color });
  }),
);

// Hard delete — colours are only a picker option, so removing one never affects saved products.
router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const color = await Color.findByIdAndDelete(req.params.id);
    if (!color) throw ApiError.notFound('Colour not found');
    res.json({ data: color, message: 'Colour deleted' });
  }),
);

export default router;
