import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Purchase } from '../models/Purchase';
import { createPurchase, cancelPurchase } from '../services/purchases';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  supplierId: z.string().min(1),
  supplierBillNo: z.string().trim().optional(),
  date: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        costPrice: z.coerce.number().min(0),
      }),
    )
    .min(1),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional(),
});

router.get(
  '/',
  validateQuery(
    paginationSchema.extend({
      supplier: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      status: z.enum(['received', 'cancelled']).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const q = req.query as any;
    const filter: Record<string, unknown> = {};
    if (q.supplier) filter.supplier = q.supplier;
    if (q.status) filter.status = q.status;
    if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Purchase.find(filter).populate('supplier', 'name phone').sort({ date: -1 }).skip(skip).limit(limit),
      Purchase.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id).populate('supplier');
    if (!purchase) throw ApiError.notFound('Purchase not found');
    res.json({ data: purchase });
  }),
);

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const purchase = await createPurchase(req.body, req.user);
    res.status(201).json({ data: purchase });
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const purchase = await cancelPurchase(req.params.id, req.user);
    res.json({ data: purchase, message: 'Purchase cancelled and stock reversed' });
  }),
);

export default router;
