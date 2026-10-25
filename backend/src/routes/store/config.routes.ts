import { Router } from 'express';
import { env } from '../../config/env';
import { isRazorpayConfigured } from '../../services/razorpay';

const router = Router();

// Public storefront config — what payment options to show, shop name, etc.
router.get('/', (_req, res) => {
  res.json({
    data: {
      shopName: env.shop.name,
      currency: 'INR',
      onlinePayment: isRazorpayConfigured(),
      razorpayKeyId: isRazorpayConfigured() ? env.razorpay.keyId : null,
    },
  });
});

export default router;
