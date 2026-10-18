import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Product } from '../models/Product';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';
import { generateLabelsPdf, type LabelItem } from '../services/labelPdf';
import { encodePrice } from '../utils/priceCode';
import { env } from '../config/env';

const router = Router();
router.use(requireAuth);

const variantInput = z.object({
  color: z.string().trim().min(1),
  size: z.string().trim().min(1),
  sku: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(0).default(0),
  costPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

const productInput = z.object({
  designNumber: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().optional(),
  fabric: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional().or(z.literal('')),
  images: z.array(z.string().trim()).optional(),
  videos: z.array(z.string().trim()).optional(),
  customFields: z
    .array(z.object({ label: z.string().trim().min(1), value: z.string().trim().default('') }))
    .optional(),
  costPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  variants: z.array(variantInput).default([]),
});

const listQuery = paginationSchema.extend({
  category: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
});

/** List/search products. */
router.get(
  '/',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const filter: Record<string, unknown> = {};
    if (!q.includeInactive) filter.active = true;
    if (q.category) filter.category = q.category;
    if (q.inStock) filter['variants.quantity'] = { $gt: 0 };
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ designNumber: rx }, { name: rx }, { brand: rx }, { 'variants.sku': rx }];
    }

    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

/** Stock lookup by barcode/SKU, or by design number (+ optional colour/size). */
router.get(
  '/lookup',
  validateQuery(
    z.object({
      barcode: z.string().trim().optional(),
      sku: z.string().trim().optional(),
      design: z.string().trim().optional(),
      color: z.string().trim().optional(),
      size: z.string().trim().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { barcode, sku, design, color, size } = req.query as Record<string, string | undefined>;
    const code = (barcode || sku)?.toUpperCase();

    if (code) {
      const product = await Product.findOne({ 'variants.sku': code });
      if (!product) throw ApiError.notFound('No product found for that barcode');
      const variant = product.variants.find((v) => v.sku === code);
      return res.json({ data: { product, variant, matches: variant ? [variant] : [] } });
    }

    if (design) {
      const product = await Product.findOne({ designNumber: design.toUpperCase() });
      if (!product) throw ApiError.notFound('No product found for that design number');
      let matches = product.variants.filter((v) => true);
      if (color) matches = matches.filter((v) => v.color.toLowerCase() === color.toLowerCase());
      if (size) matches = matches.filter((v) => v.size.toLowerCase() === size.toLowerCase());
      return res.json({ data: { product, variant: matches[0], matches } });
    }

    throw ApiError.badRequest('Provide a barcode/sku or a design number');
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ data: product });
  }),
);

/**
 * Printable product tags / barcode labels. `variantId` → one variant; else all.
 * `format=sheet` (A4, 12/page) or `format=roll` (one tag/page at w×h mm, default 50×25).
 */
router.get(
  '/:id/labels',
  validateQuery(
    z.object({
      variantId: z.string().optional(),
      copies: z.coerce.number().int().min(1).max(500).default(1),
      format: z.enum(['sheet', 'roll']).default('sheet'),
      w: z.coerce.number().min(20).max(150).optional(),
      h: z.coerce.number().min(10).max(150).optional(),
      download: z.coerce.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { variantId, copies, format, w, h } = req.query as unknown as {
      variantId?: string;
      copies: number;
      format: 'sheet' | 'roll';
      w?: number;
      h?: number;
    };
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');

    let variants = product.variants.slice();
    if (variantId) {
      const v = product.variants.id(variantId);
      if (!v) throw ApiError.notFound('Variant not found');
      variants = [v];
    }
    if (variants.length === 0) throw ApiError.badRequest('This product has no variants to label');

    const items: LabelItem[] = [];
    for (const v of variants) {
      const label: LabelItem = {
        designNumber: product.designNumber,
        shopName: env.shop.name,
        itemCode: v.sku,
        color: v.color,
        designName: product.name,
        size: v.size,
        priceCode: encodePrice(v.sellingPrice ?? product.sellingPrice ?? 0),
      };
      for (let i = 0; i < copies; i++) items.push(label);
    }

    const pdf = await generateLabelsPdf(items, { format, widthMm: w, heightMm: h });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="labels-${product.designNumber}.pdf"`);
    res.send(pdf);
  }),
);

/** Reject duplicate (colour, size) pairs within a product. */
function assertUniqueVariants(variants: { color: string; size: string }[]) {
  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.color.toLowerCase()}|${v.size.toLowerCase()}`;
    if (seen.has(key)) throw ApiError.badRequest(`Duplicate colour/size: ${v.color} / ${v.size}`);
    seen.add(key);
  }
}

router.post(
  '/',
  validateBody(productInput),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof productInput>;
    assertUniqueVariants(body.variants);
    const product = await Product.create(body);
    res.status(201).json({ data: product });
  }),
);

router.patch(
  '/:id',
  validateBody(productInput.partial().omit({ variants: true })),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ data: product });
  }),
);

router.post(
  '/:id/variants',
  validateBody(variantInput),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof variantInput>;
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    assertUniqueVariants([...product.variants, body]);
    product.variants.push(body);
    await product.save();
    res.status(201).json({ data: product });
  }),
);

router.patch(
  '/:id/variants/:variantId',
  validateBody(variantInput.partial()),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const variant = product.variants.id(req.params.variantId);
    if (!variant) throw ApiError.notFound('Variant not found');
    Object.assign(variant, req.body);
    assertUniqueVariants(product.variants);
    await product.save();
    res.json({ data: product });
  }),
);

router.delete(
  '/:id/variants/:variantId',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const variant = product.variants.id(req.params.variantId);
    if (!variant) throw ApiError.notFound('Variant not found');
    if (variant.quantity > 0) throw ApiError.badRequest('Cannot remove a variant that still has stock');
    variant.deleteOne();
    await product.save();
    res.json({ data: product });
  }),
);

/** Manual stock adjustment (count correction, damage, etc.). */
router.post(
  '/:id/variants/:variantId/adjust',
  validateBody(
    z
      .object({
        delta: z.coerce.number().int().optional(),
        setTo: z.coerce.number().int().min(0).optional(),
        reason: z.string().trim().optional(),
      })
      .refine((v) => v.delta !== undefined || v.setTo !== undefined, {
        message: 'Provide either delta or setTo',
      }),
  ),
  asyncHandler(async (req, res) => {
    const { delta, setTo } = req.body as { delta?: number; setTo?: number };
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const variant = product.variants.id(req.params.variantId);
    if (!variant) throw ApiError.notFound('Variant not found');

    const next = setTo !== undefined ? setTo : variant.quantity + (delta ?? 0);
    if (next < 0) throw ApiError.badRequest('Resulting stock cannot be negative');
    variant.quantity = next;
    await product.save();
    res.json({ data: product });
  }),
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ data: product, message: 'Product deactivated' });
  }),
);

export default router;
