import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { quoteShipping } from '../../services/shipping';

const router = Router();

const quoteSchema = z.object({
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  subtotal: z.coerce.number().min(0).default(0),
});

// Public shipping quote for the checkout — returns the serviceable options + computed prices.
router.post(
  '/quote',
  validateBody(quoteSchema),
  asyncHandler(async (req, res) => {
    const { state, pincode, subtotal } = req.body as z.infer<typeof quoteSchema>;
    const options = await quoteShipping({ state, pincode }, subtotal);
    res.json({ data: options });
  }),
);

export default router;
