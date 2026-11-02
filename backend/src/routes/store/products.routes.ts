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
function toPublic(p: ProductDoc | Record<string, any>) {
  const variants = ((p.variants as any[]) || []).map((v) => ({
    id: String(v._id),
    color: v.color,
    size: v.size,
    sku: v.sku,
    inStock: v.quantity > 0,
  }));
  const colors = Array.from(
    new Set([
      ...((p.colors as string[]) ?? []),
      ...variants.map((v) => v.color).filter(Boolean),
      ...((p.imageColorTags as { color: string }[]) ?? []).map((t) => t.color).filter(Boolean),
    ]),
  );
  return {
    id: String(p._id),
    designNumber: p.designNumber,
    name: p.name,
    category: p.category,
    subCategory: p.subCategory,
    description: p.description,
    images: p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [],
    videos: p.videos ?? [],
    colors,
    imageColorTags: p.imageColorTags ?? [],
    price: p.b2cPrice ?? p.sellingPrice ?? 0,
    compareAtPrice: p.compareAtPrice && p.compareAtPrice > (p.b2cPrice ?? p.sellingPrice ?? 0) ? p.compareAtPrice : undefined,
    sizeGroup: p.sizeGroup,
    gender: p.gender,
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
  'gender',
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
  color: z.string().optional(),
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

    const andClauses: Record<string, unknown>[] = [];

    if (q.color) {
      const rawColors = String(q.color).split(',').map((c) => c.trim()).filter(Boolean);
      if (rawColors.length > 0) {
        const regexes = rawColors.map((c) => new RegExp(`(^|[/,&+\\s])${escapeRegex(c)}($|[/,&+\\s])`, 'i'));
        andClauses.push({
          $or: [
            { 'variants.color': { $in: regexes } },
            { colors: { $in: regexes } },
          ],
        });
      }
    }

    if (q.collection) {
      const handle = String(q.collection).toLowerCase();
      // 'all-items' or 'all' represents all products in the catalog
      if (handle !== 'all-items' && handle !== 'all') {
        const col = await Collection.findOne({
          active: true,
          $or: [{ handle }, ...(Types.ObjectId.isValid(handle) ? [{ _id: handle }] : [])],
        });
        filter.collections = col ? col._id : null; // unknown handle → no results
      }
    }

    if (q.inStock) filter['variants.quantity'] = { $gt: 0 };

    if (q.search) {
      const rx = new RegExp(escapeRegex(String(q.search)), 'i');
      andClauses.push({
        $or: [{ designNumber: rx }, { name: rx }, { category: rx }, { subCategory: rx }],
      });
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    const page = Number(q.page) || 1;
    const { skip, limit } = paginate(page, Number(q.limit) || 20);

    const sortDir = q.sort === 'price_asc' ? 1 : q.sort === 'price_desc' ? -1 : null;
    let items: any[];
    let total: number;

    if (sortDir !== null) {
      const [aggItems, count] = await Promise.all([
        Product.aggregate([
          { $match: filter },
          { $addFields: { effectivePrice: { $ifNull: ['$b2cPrice', { $ifNull: ['$sellingPrice', 0] }] } } },
          { $sort: { effectivePrice: sortDir, createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        Product.countDocuments(filter),
      ]);
      items = aggItems;
      total = count;
    } else {
      const sort = SORTS[String(q.sort ?? 'newest')] ?? SORTS.newest;
      const [foundItems, count] = await Promise.all([
        Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        Product.countDocuments(filter),
      ]);
      items = foundItems;
      total = count;
    }

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

/** Category tree with subcategories and product counts for the storefront homepage */
router.get(
  '/category-tree',
  asyncHandler(async (_req, res) => {
    const raw = await Product.aggregate<{
      _id: string;
      count: number;
      subCategories: string[];
      images: string[];
      imageUrls: string[];
    }>([
      { $match: { active: true, category: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          subCategories: { $addToSet: '$subCategory' },
          images: { $push: { $arrayElemAt: ['$images', 0] } },
          imageUrls: { $push: '$imageUrl' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const tree = raw.map((c) => {
      const validImages = [...(c.images || []), ...(c.imageUrls || [])].filter(Boolean);
      return {
        name: c._id,
        count: c.count,
        subCategories: (c.subCategories || []).filter(Boolean).sort(),
        image: validImages[0] || undefined,
      };
    });

    res.json({ data: tree });
  }),
);

/** Distinct values for every facet, scoped to the active collection/category */
router.get(
  '/filters',
  asyncHandler(async (req, res) => {
    const base: Record<string, unknown> = { active: true };
    if (req.query.collection) {
      const handle = String(req.query.collection).toLowerCase();
      if (handle !== 'all-items' && handle !== 'all') {
        const col = await Collection.findOne({
          active: true,
          $or: [{ handle }, ...(Types.ObjectId.isValid(handle) ? [{ _id: handle }] : [])],
        });
        base.collections = col ? col._id : null;
      }
    }
    if (req.query.category) {
      base.category = String(req.query.category);
    }

    const distinct = async (field: string) =>
      ((await Product.distinct(field, { ...base, [field]: { $nin: [null, ''] } })) as (string | number)[])
        .filter((v) => v !== null && v !== '')
        .sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));

    const [
      category,
      subCategory,
      gender,
      dupatta,
      backOpening,
      blouseSize,
      sleeves,
      backClosure,
      bottomType,
      sizeGroup,
      fabric,
      gher,
      size,
      varColors,
      prodColors,
    ] = await Promise.all([
      distinct('category'),
      distinct('subCategory'),
      distinct('gender'),
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
      distinct('variants.color'),
      distinct('colors'),
    ]);

    const color = Array.from(new Set([...varColors, ...prodColors].map(String))).sort();

    res.json({
      data: {
        category,
        subCategory,
        gender,
        dupatta,
        backOpening,
        blouseSize,
        sleeves,
        backClosure,
        bottomType,
        sizeGroup,
        fabric,
        gher,
        size,
        color,
      },
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
