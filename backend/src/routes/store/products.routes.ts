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
    // Customer-safe apparel attributes (used for detail display + faceted filtering).
    fabric: p.fabric,
    dupatta: p.dupatta,
    backOpening: p.backOpening,
    blouseSize: p.blouseSize,
    gher: p.gher,
    sleeves: p.sleeves,
    backClosure: p.backClosure,
    bottomType: p.bottomType,
    variants,
    inStock: variants.some((v) => v.inStock),
  };
}

// Product-level attributes that can be filtered by an exact value from the facet dropdowns.
const STRING_FACETS = [
  'category',
  'subCategory',
  'dupatta',
  'backOpening',
  'blouseSize',
  'sleeves',
  'backClosure',
  'bottomType',
  'sizeGroup',
  'fabric',
] as const;

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { b2cPrice: 1 },
  price_desc: { b2cPrice: -1 },
  gher: { gher: 1 },
};

const listQuery = paginationSchema.extend({
  collection: z.string().optional(),
  inStock: z.coerce.boolean().optional(),
  size: z.string().optional(),
  gher: z.coerce.number().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'gher']).optional(),
  // Each string facet is an optional exact-match filter.
  ...Object.fromEntries(STRING_FACETS.map((f) => [f, z.string().optional()])),
}) as unknown as z.ZodType<Record<string, unknown>>;

router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | number | boolean | undefined>;
    const filter: Record<string, unknown> = { active: true };

    for (const f of STRING_FACETS) if (q[f]) filter[f] = q[f];
    if (q.gher != null) filter.gher = Number(q.gher);
    if (q.size) filter['variants.size'] = q.size;

    if (q.collection) {
      // Accept a collection handle or id.
      const handle = String(q.collection);
      const col = await Collection.findOne({
        active: true,
        $or: [{ handle: handle.toLowerCase() }, ...(Types.ObjectId.isValid(handle) ? [{ _id: handle }] : [])],
      });
      filter.collections = col ? col._id : null; // unknown handle → no results
    }
    if (q.inStock) filter['variants.quantity'] = { $gt: 0 };
    if (q.search) {
      const rx = new RegExp(escapeRegex(String(q.search)), 'i');
      filter.$or = [{ designNumber: rx }, { name: rx }, { category: rx }, { subCategory: rx }];
    }

    const sort = SORTS[String(q.sort ?? 'newest')] ?? SORTS.newest;
    const page = Number(q.page) || 1;
    const { skip, limit } = paginate(page, Number(q.limit) || 20);
    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);
    res.json({ data: items.map(toPublic), meta: buildMeta(total, page, limit) });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const cats = (await Product.distinct('category', { active: true, category: { $nin: [null, ''] } })) as string[];
    res.json({ data: cats.sort() });
  }),
);

/** Distinct values for every facet, so the storefront can populate its filter dropdowns. */
router.get(
  '/filters',
  asyncHandler(async (_req, res) => {
    const base = { active: true };
    const distinct = async (field: string) =>
      ((await Product.distinct(field, { ...base, [field]: { $nin: [null, ''] } })) as (string | number)[])
        .filter((v) => v !== null && v !== '')
        .sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));

    const [category, subCategory, dupatta, backOpening, blouseSize, sleeves, backClosure, bottomType, sizeGroup, fabric, gher, size] =
      await Promise.all([
        distinct('category'),
        distinct('subCategory'),
        distinct('dupatta'),
        distinct('backOpening'),
        distinct('blouseSize'),
        distinct('sleeves'),
        distinct('backClosure'),
        distinct('bottomType'),
        distinct('sizeGroup'),
        distinct('fabric'),
        distinct('gher'),
        distinct('variants.size'),
      ]);

    res.json({
      data: { category, subCategory, dupatta, backOpening, blouseSize, sleeves, backClosure, bottomType, sizeGroup, fabric, gher, size },
    });
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
