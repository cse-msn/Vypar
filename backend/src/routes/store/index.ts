import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './products.routes';
import eventRoutes from './events.routes';

// Customer-facing online store API (public catalog + customer accounts).
// Mounted under /api/store. Does NOT use the staff requireAuth guard.
const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/events', eventRoutes);

export default router;
