import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { optionalCustomer } from '../../middleware/customerAuth';
import { validateDiscount } from '../../services/discounts';

const router = Router();

const validateSchema = z.object({
  code: z.string().trim().min(1, 'Enter a code'),
  subtotal: z.coerce.number().min(0),
  shippingFee: z.coerce.number().min(0).default(0),
});

// Preview a coupon against the current cart. Public (anonymous carts allowed); per-customer
// limits are only enforced when a customer token is present. The real check runs again at
// order creation, so this is advisory for the UI only.
router.post(
  '/validate',
  optionalCustomer,
  validateBody(validateSchema),
  asyncHandler(async (req, res) => {
    const { code, subtotal, shippingFee } = req.body as z.infer<typeof validateSchema>;
    const applied = await validateDiscount(code, { subtotal, shippingFee, customerId: req.customer?.id });
    res.json({
      data: {
        code: applied.discount.code,
        type: applied.discount.type,
        description: applied.discount.description ?? null,
        discountAmount: applied.discountAmount,
        freeShipping: applied.freeShipping,
      },
    });
  }),
);

export default router;
