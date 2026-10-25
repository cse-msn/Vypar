import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { Collection, type CollectionDoc } from '../../models/Collection';

const router = Router();

const toPublic = (c: CollectionDoc) => ({
  id: String(c._id),
  title: c.title,
  handle: c.handle,
  description: c.description,
  image: c.image,
  featured: c.featured,
});

// Public list of active collections (optionally featured only).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { active: true };
    if (req.query.featured === 'true') filter.featured = true;
    const items = await Collection.find(filter).sort({ sortOrder: 1, title: 1 });
    res.json({ data: items.map(toPublic) });
  }),
);

router.get(
  '/:handle',
  asyncHandler(async (req, res) => {
    const collection = await Collection.findOne({ handle: req.params.handle.toLowerCase(), active: true });
    if (!collection) throw ApiError.notFound('Collection not found');
    res.json({ data: toPublic(collection) });
  }),
);

export default router;
