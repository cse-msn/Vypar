import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Customer } from '../models/Customer';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { StoreEvent } from '../models/StoreEvent';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';
import { STORE_EVENT_TYPES } from '../constants';

const router = Router();
router.use(requireAuth);

const customerInput = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  gstin: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

router.get(
  '/',
  validateQuery(paginationSchema.extend({ includeInactive: z.coerce.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof paginationSchema> & { includeInactive?: boolean };
    const filter: Record<string, unknown> = {};
    if (!q.includeInactive) filter.active = true;
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { whatsapp: rx }];
    }
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

/** Full customer ledger: recent invoices + payments + current balance. */
router.get(
  '/:id/ledger',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');
    const [invoices, payments] = await Promise.all([
      Invoice.find({ customer: customer._id }).sort({ date: -1 }).limit(100),
      Payment.find({ customer: customer._id }).sort({ date: -1 }).limit(100),
    ]);
    res.json({ data: { customer, invoices, payments } });
  }),
);

/** Online-store journey: this customer's tracked events + a by-type summary. */
router.get(
  '/:id/journey',
  validateQuery(paginationSchema.extend({ type: z.enum(STORE_EVENT_TYPES).optional() })),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');
    const q = req.query as unknown as z.infer<typeof paginationSchema> & { type?: string };
    const filter: Record<string, unknown> = { customer: customer._id };
    if (q.type) filter.type = q.type;
    const { skip, limit } = paginate(q.page, q.limit);
    const [events, total, byType] = await Promise.all([
      StoreEvent.find(filter)
        .populate({ path: 'product', select: 'designNumber name', options: { lean: true } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StoreEvent.countDocuments(filter),
      StoreEvent.aggregate<{ _id: string; count: number }>([
        { $match: { customer: customer._id } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);
    const counts = Object.fromEntries(byType.map((b) => [b._id, b.count]));
    // "Added to cart but didn't buy" — a quick abandoned-cart signal.
    const abandonedCart = (counts.add_to_cart ?? 0) > 0 && (counts.purchase ?? 0) === 0;
    res.json({ data: { customer, events, counts, abandonedCart }, meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');
    res.json({ data: customer });
  }),
);

router.post(
  '/',
  validateBody(customerInput),
  asyncHandler(async (req, res) => {
    const customer = await Customer.create(req.body);
    res.status(201).json({ data: customer });
  }),
);

router.patch(
  '/:id',
  validateBody(customerInput.partial().extend({ active: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) throw ApiError.notFound('Customer not found');
    res.json({ data: customer });
  }),
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!customer) throw ApiError.notFound('Customer not found');
    res.json({ data: customer, message: 'Customer deactivated' });
  }),
);

export default router;
