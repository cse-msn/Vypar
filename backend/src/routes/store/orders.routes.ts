import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { requireCustomer } from '../../middleware/customerAuth';
import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import { Order } from '../../models/Order';
import { createOrder, confirmOnlinePayment } from '../../services/orders';

const router = Router();
router.use(requireCustomer);

const addressSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
  line1: z.string().trim().min(1, 'Address is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().optional(),
  pincode: z.string().trim().min(1, 'Pincode is required'),
});

const createSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1),
  shippingAddress: addressSchema,
  // Online (Razorpay) is added later; COD works now.
  paymentMethod: z.enum(['cod', 'online']).default('cod'),
  notes: z.string().trim().optional(),
  discountCode: z.string().trim().optional(),
  shippingRateId: z.string().trim().optional(),
});

// Place an order (reduces stock). For an online (Razorpay) order the response also carries the
// `payment` payload the client needs to open Razorpay Checkout.
router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const order = await createOrder(req.customer!.id, req.body);
    const payment =
      order.paymentMethod === 'online' && order.razorpayOrderId
        ? {
            provider: 'razorpay' as const,
            keyId: env.razorpay.keyId,
            razorpayOrderId: order.razorpayOrderId,
            amount: Math.round(order.total * 100),
            currency: 'INR',
          }
        : null;
    res.status(201).json({ data: order, payment });
  }),
);

// Confirm an online payment after Razorpay Checkout succeeds (server-side signature verification).
const verifySchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});
router.post(
  '/:id/verify',
  validateBody(verifySchema),
  asyncHandler(async (req, res) => {
    const order = await confirmOnlinePayment(req.params.id, req.customer!.id, req.body);
    res.json({ data: order });
  }),
);

// The signed-in customer's own orders.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ customer: req.customer!.id }).sort({ placedAt: -1 }).limit(100);
    res.json({ data: orders });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.customer!.id });
    if (!order) throw ApiError.notFound('Order not found');
    res.json({ data: order });
  }),
);

export default router;
