import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Collection } from '../models/Collection';
import { Product } from '../models/Product';

const router = Router();
router.use(requireAuth);

const collectionInput = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  handle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().default(0),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
});

// List — any authenticated user (the product form needs these).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await Collection.find().sort({ sortOrder: 1, title: 1 });
    // Attach a live product count per collection.
    const counts = await Product.aggregate<{ _id: unknown; n: number }>([
      { $unwind: '$collections' },
      { $group: { _id: '$collections', n: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ data: items.map((c) => ({ ...c.toJSON(), productCount: byId.get(String(c._id)) ?? 0 })) });
  }),
);

router.post(
  '/',
  requireRole('owner'),
  validateBody(collectionInput),
  asyncHandler(async (req, res) => {
    if (req.body.handle) {
      const clash = await Collection.findOne({ handle: req.body.handle.toLowerCase() });
      if (clash) throw ApiError.badRequest('A collection with this handle already exists');
    }
    const collection = await Collection.create(req.body);
    res.status(201).json({ data: collection });
  }),
);

router.patch(
  '/:id',
  requireRole('owner'),
  validateBody(collectionInput.partial()),
  asyncHandler(async (req, res) => {
    if (req.body.handle) {
      const clash = await Collection.findOne({ handle: req.body.handle.toLowerCase(), _id: { $ne: req.params.id } });
      if (clash) throw ApiError.badRequest('A collection with this handle already exists');
    }
    const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!collection) throw ApiError.notFound('Collection not found');
    res.json({ data: collection });
  }),
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    if (!collection) throw ApiError.notFound('Collection not found');
    // Pull the collection ref off any products that referenced it.
    await Product.updateMany({ collections: collection._id }, { $pull: { collections: collection._id } });
    res.json({ data: collection, message: 'Collection deleted' });
  }),
);

export default router;
