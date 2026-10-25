import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateQuery } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { Types } from 'mongoose';
import { Product, type ProductDoc } from '../../models/Product';
import { Collection } from '../../models/Collection';
import { paginationSchema, paginate, buildMeta } from '../../utils/pagination';
import { escapeRegex } from '../../utils/regex';

const router = Router();

/**
 * Public catalog view — exposes only customer-safe fields. Cost/B2B/selling price,
 * supplier, HSN and internal attributes are intentionally omitted. The customer price
 * is the B2C price (falling back to selling price for legacy products).
 */
function toPublic(p: ProductDoc) {
  const variants = p.variants.map((v) => ({
    id: String(v._id),
    color: v.color,
    size: v.size,
    sku: v.sku,
    inStock: v.quantity > 0,
  }));
  return {
    id: String(p._id),
    designNumber: p.designNumber,
    name: p.name,
    category: p.category,
    subCategory: p.subCategory,
    description: p.description,
    images: p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [],
    videos: p.videos ?? [],
    price: p.b2cPrice ?? p.sellingPrice ?? 0,
    compareAtPrice: p.compareAtPrice && p.compareAtPrice > (p.b2cPrice ?? p.sellingPrice ?? 0) ? p.compareAtPrice : undefined,
    sizeGroup: p.sizeGroup,
    tags: p.tags ?? [],
    handle: p.handle,
    variants,
    inStock: variants.some((v) => v.inStock),
  };
}

router.get(
  '/',
  validateQuery(
    paginationSchema.extend({
      category: z.string().optional(),
      collection: z.string().optional(),
      inStock: z.coerce.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as {
      page: number;
      limit: number;
      search?: string;
      category?: string;
      collection?: string;
      inStock?: boolean;
    };
    const filter: Record<string, unknown> = { active: true };
    if (q.category) filter.category = q.category;
    if (q.collection) {
      // Accept a collection handle or id.
      const col = await Collection.findOne({
        active: true,
        $or: [{ handle: q.collection.toLowerCase() }, ...(Types.ObjectId.isValid(q.collection) ? [{ _id: q.collection }] : [])],
      });
      filter.collections = col ? col._id : null; // unknown handle → no results
    }
    if (q.inStock) filter['variants.quantity'] = { $gt: 0 };
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ designNumber: rx }, { name: rx }, { category: rx }, { subCategory: rx }];
    }
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);
    res.json({ data: items.map(toPublic), meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const cats = (await Product.distinct('category', { active: true, category: { $nin: [null, ''] } })) as string[];
    res.json({ data: cats.sort() });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, active: true });
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ data: toPublic(product) });
  }),
);

export default router;
