import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { getShopProfile, updateShopProfile } from '../services/shopProfile';

const router = Router();
router.use(requireAuth);

const shopInput = z.object({
  name: z.string().trim().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  email: z.string().trim().optional(),
  state: z.string().trim().optional(),
  stateCode: z.string().trim().optional(),
  defaultHsn: z.string().trim().optional(),
  bank: z
    .object({
      name: z.string().trim().optional(),
      account: z.string().trim().optional(),
      ifsc: z.string().trim().optional(),
    })
    .optional(),
});

/** Shop profile shown on Settings + printed on invoices. */
router.get(
  '/shop',
  asyncHandler(async (_req, res) => {
    res.json({ data: await getShopProfile() });
  }),
);

/** Only the owner may change shop details. */
router.put(
  '/shop',
  requireRole('owner'),
  validateBody(shopInput),
  asyncHandler(async (req, res) => {
    res.json({ data: await updateShopProfile(req.body) });
  }),
);

export default router;
