import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './products.routes';
import eventRoutes from './events.routes';
import orderRoutes from './orders.routes';
import discountRoutes from './discounts.routes';
import webhookRoutes from './webhook.routes';
import configRoutes from './config.routes';
import shippingRoutes from './shipping.routes';
import collectionRoutes from './collections.routes';

// Customer-facing online store API (public catalog + customer accounts).
// Mounted under /api/store. Does NOT use the staff requireAuth guard.
const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/events', eventRoutes);
router.use('/orders', orderRoutes);
router.use('/discounts', discountRoutes);
router.use('/razorpay', webhookRoutes);
router.use('/config', configRoutes);
router.use('/shipping', shippingRoutes);
router.use('/collections', collectionRoutes);

export default router;
