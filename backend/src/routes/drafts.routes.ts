import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Draft } from '../models/Draft';

const router = Router();
router.use(requireAuth);

const draftInput = z.object({
  data: z.any(),
  customerName: z.string().trim().optional(),
  itemCount: z.coerce.number().int().min(0).optional(),
  total: z.coerce.number().min(0).optional(),
});

/** List the current user's saved bill drafts, newest first. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const drafts = await Draft.find({ user: req.user!.id }).sort({ updatedAt: -1 }).limit(100);
    res.json({ data: drafts });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const draft = await Draft.findOne({ _id: req.params.id, user: req.user!.id });
    if (!draft) throw ApiError.notFound('Draft not found');
    res.json({ data: draft });
  }),
);

/** Create a new draft. */
router.post(
  '/',
  validateBody(draftInput),
  asyncHandler(async (req, res) => {
    const draft = await Draft.create({ ...req.body, user: req.user!.id });
    res.status(201).json({ data: draft });
  }),
);

/** Replace an existing draft (auto-save). */
router.put(
  '/:id',
  validateBody(draftInput),
  asyncHandler(async (req, res) => {
    const draft = await Draft.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!draft) throw ApiError.notFound('Draft not found');
    res.json({ data: draft });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const draft = await Draft.findOneAndDelete({ _id: req.params.id, user: req.user!.id });
    if (!draft) throw ApiError.notFound('Draft not found');
    res.json({ data: { _id: req.params.id }, message: 'Draft deleted' });
  }),
);

export default router;
