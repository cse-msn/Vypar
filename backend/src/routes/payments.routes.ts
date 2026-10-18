import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Payment } from '../models/Payment';
import { recordPayment } from '../services/payments';
import { PAYMENT_METHODS } from '../constants';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validateQuery(
    paginationSchema.extend({
      customer: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const q = req.query as any;
    const filter: Record<string, unknown> = {};
    if (q.customer) filter.customer = q.customer;
    if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate('customer', 'name phone')
        .populate('invoice', 'invoiceNumber total')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.post(
  '/',
  validateBody(
    z.object({
      customerId: z.string().min(1),
      amount: z.coerce.number().positive(),
      method: z.enum(PAYMENT_METHODS).optional(),
      date: z.coerce.date().optional(),
      invoiceId: z.string().optional(),
      notes: z.string().trim().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const payment = await recordPayment({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ data: payment });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id).populate('customer').populate('invoice');
    if (!payment) throw ApiError.notFound('Payment not found');
    res.json({ data: payment });
  }),
);

export default router;
