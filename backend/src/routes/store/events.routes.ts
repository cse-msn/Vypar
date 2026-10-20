import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { optionalCustomer } from '../../middleware/customerAuth';
import { StoreEvent } from '../../models/StoreEvent';
import { STORE_EVENT_TYPES } from '../../constants';

const router = Router();

const oid = (v?: string) => (v && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : undefined);

const eventSchema = z.object({
  type: z.enum(STORE_EVENT_TYPES),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  query: z.string().trim().max(200).optional(),
  quantity: z.coerce.number().optional(),
  value: z.coerce.number().optional(),
  path: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  meta: z.record(z.unknown()).optional(),
});

const ingestSchema = z.object({
  anonymousId: z.string().trim().max(100).optional(),
  sessionId: z.string().trim().max(100).optional(),
  events: z.array(eventSchema).min(1).max(50),
});

// Public ingest — works anonymously; attaches the customer when a valid token is sent.
router.post(
  '/',
  optionalCustomer,
  validateBody(ingestSchema),
  asyncHandler(async (req, res) => {
    const { anonymousId, sessionId, events } = req.body as z.infer<typeof ingestSchema>;
    const customer = req.customer ? oid(req.customer.id) : undefined;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const docs = events.map((e) => ({
      type: e.type,
      customer,
      anonymousId,
      sessionId,
      product: oid(e.productId),
      variantId: oid(e.variantId),
      query: e.query,
      quantity: e.quantity,
      value: e.value,
      path: e.path,
      referrer: e.referrer,
      userAgent,
      ip,
      meta: e.meta,
    }));
    await StoreEvent.insertMany(docs, { ordered: false });
    res.status(202).json({ data: { accepted: docs.length } });
  }),
);

export default router;
