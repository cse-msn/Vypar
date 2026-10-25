import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { ShippingZone, ZONE_MATCH_TYPES } from '../models/ShippingZone';

const router = Router();
router.use(requireAuth);

const rateInput = z.object({
  label: z.string().trim().min(1, 'Label is required'),
  price: z.coerce.number().min(0).default(0),
  freeAbove: z.coerce.number().min(0).default(0),
  eta: z.string().trim().optional(),
});

const zoneInput = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  matchType: z.enum(ZONE_MATCH_TYPES).default('all'),
  states: z.array(z.string().trim()).default([]),
  pincodePrefixes: z.array(z.string().trim()).default([]),
  rates: z.array(rateInput).default([]),
  priority: z.coerce.number().int().default(0),
  active: z.boolean().optional(),
});

// List — any authenticated user can view.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await ShippingZone.find().sort({ priority: 1, createdAt: 1 });
    res.json({ data: items });
  }),
);

router.post(
  '/',
  requireRole('owner'),
  validateBody(zoneInput),
  asyncHandler(async (req, res) => {
    const zone = await ShippingZone.create(req.body);
    res.status(201).json({ data: zone });
  }),
);

router.patch(
  '/:id',
  requireRole('owner'),
  validateBody(zoneInput.partial()),
  asyncHandler(async (req, res) => {
    const zone = await ShippingZone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!zone) throw ApiError.notFound('Shipping zone not found');
    res.json({ data: zone });
  }),
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const zone = await ShippingZone.findByIdAndDelete(req.params.id);
    if (!zone) throw ApiError.notFound('Shipping zone not found');
    res.json({ data: zone, message: 'Shipping zone deleted' });
  }),
);

export default router;
