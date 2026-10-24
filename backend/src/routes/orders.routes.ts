import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Order } from '../models/Order';
import { cancelOrder } from '../services/orders';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';
import { ORDER_STATUS, ORDER_PAYMENT_STATUS } from '../constants';

// Staff/owner view of the online-store orders. Mounted at /api/orders (requireAuth).
const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validateQuery(paginationSchema.extend({ status: z.enum(ORDER_STATUS).optional() })),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof paginationSchema> & { status?: string };
    const filter: Record<string, unknown> = {};
    if (q.status) filter.status = q.status;
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Order.find(filter).populate('customer', 'name phone email').sort({ placedAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('customer', 'name phone email address');
    if (!order) throw ApiError.notFound('Order not found');
    res.json({ data: order });
  }),
);

// Update fulfillment status and/or payment status (e.g. mark a COD order paid on delivery).
router.patch(
  '/:id',
  validateBody(
    z.object({
      status: z.enum(ORDER_STATUS).optional(),
      paymentStatus: z.enum(ORDER_PAYMENT_STATUS).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!order) throw ApiError.notFound('Order not found');
    res.json({ data: order });
  }),
);

// Cancel — returns reserved stock to inventory.
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await cancelOrder(req.params.id);
    res.json({ data: order, message: 'Order cancelled and stock returned' });
  }),
);

export default router;
