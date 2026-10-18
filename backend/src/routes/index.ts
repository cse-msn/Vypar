import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './products.routes';
import supplierRoutes from './suppliers.routes';
import purchaseRoutes from './purchases.routes';
import customerRoutes from './customers.routes';
import invoiceRoutes from './invoices.routes';
import paymentRoutes from './payments.routes';
import reportRoutes from './reports.routes';
import publicRoutes from './public.routes';
import mediaRoutes from './media.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/public', publicRoutes);
router.use('/', mediaRoutes); // /uploads (auth) + /media/:file (public)

export default router;
