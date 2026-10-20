import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { Invoice } from '../models/Invoice';
import { PAYMENT_METHODS } from '../constants';
import { createInvoice, cancelInvoice, ensureInvoicePdf } from '../services/sales';
import { buildInvoiceShare } from '../services/whatsapp';
import { generatePublicToken } from '../utils/tokens';
import { paginationSchema, paginate, buildMeta } from '../utils/pagination';
import { escapeRegex } from '../utils/regex';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        price: z.coerce.number().min(0).optional(),
        discount: z.coerce.number().min(0).optional(),
      }),
    )
    .min(1, 'Add at least one item'),
  customerId: z.string().optional(),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  customerWhatsapp: z.string().trim().optional(),
  customerAddress: z.string().trim().optional(),
  customerGstin: z.string().trim().optional(),
  date: z.coerce.date().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  roundOff: z.coerce.boolean().optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
});

router.get(
  '/',
  validateQuery(
    paginationSchema.extend({
      customer: z.string().optional(),
      status: z.enum(['confirmed', 'cancelled']).optional(),
      paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const q = req.query as any;
    const filter: Record<string, unknown> = {};
    if (q.customer) filter.customer = q.customer;
    if (q.status) filter.status = q.status;
    if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
    if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ invoiceNumber: rx }, { 'customerSnapshot.name': rx }, { 'customerSnapshot.phone': rx }];
    }
    const { skip, limit } = paginate(q.page, q.limit);
    const [items, total] = await Promise.all([
      Invoice.find(filter).populate('customer', 'name phone').sort({ date: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);
    res.json({ data: items, meta: buildMeta(total, q.page, q.limit) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) throw ApiError.notFound('Invoice not found');
    res.json({ data: invoice });
  }),
);

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    // Accept an idempotency key from the standard header too.
    const headerKey = req.header('Idempotency-Key');
    if (headerKey && !body.idempotencyKey) body.idempotencyKey = headerKey;

    const { invoice, duplicate } = await createInvoice(body, req.user);
    // Pre-generate + store the PDF in the background so the first share/view is an instant
    // cached read (not awaited — the response returns immediately).
    if (!duplicate) void ensureInvoicePdf(invoice).catch(() => undefined);
    res.status(duplicate ? 200 : 201).json({ data: invoice, duplicate });
  }),
);

router.post(
  '/:id/cancel',
  validateBody(z.object({ reason: z.string().trim().optional() })),
  asyncHandler(async (req, res) => {
    const invoice = await cancelInvoice(req.params.id, req.user, req.body.reason);
    res.json({ data: invoice, message: 'Invoice cancelled and stock restored' });
  }),
);

/** Stream the invoice PDF to an authenticated staff user (view or download). */
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    const buffer = await ensureInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    // Authenticated financial document — never cache in shared/public caches.
    res.setHeader('Cache-Control', 'private, no-store');
    const disposition = req.query.download ? 'attachment' : 'inline';
    // Filename: <customer>_<bill no>_<date>_<time>.pdf
    const pad = (n: number) => String(n).padStart(2, '0');
    const dt = new Date(invoice.date ?? invoice.createdAt);
    const stamp = `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}_${pad(dt.getHours())}-${pad(dt.getMinutes())}`;
    const safe = (s?: string) => (s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 50) || 'Walk-in';
    const filename = `${safe(invoice.customerSnapshot.name)}_${invoice.invoiceNumber}_${stamp}.pdf`;
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }),
);

router.post(
  '/:id/pdf/regenerate',
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    await ensureInvoicePdf(invoice, true);
    res.json({ data: invoice, message: 'PDF regenerated' });
  }),
);

/** Prepare the WhatsApp share payload (ensures the PDF exists and link is valid). */
router.get(
  '/:id/share',
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (!invoice.publicTokenActive) throw ApiError.badRequest('Public link for this invoice is revoked');
    await ensureInvoicePdf(invoice); // guarantee a PDF is available at the public link

    const share = buildInvoiceShare({
      token: invoice.publicToken,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      customerName: invoice.customerSnapshot.name,
      phone: invoice.customerSnapshot.whatsapp || invoice.customerSnapshot.phone,
    });
    res.json({ data: share });
  }),
);

/** Revoke (or re-issue) the public customer link. */
router.post(
  '/:id/revoke-link',
  validateBody(z.object({ active: z.boolean().default(false), rotate: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    invoice.publicTokenActive = req.body.active;
    if (req.body.rotate) invoice.publicToken = generatePublicToken();
    await invoice.save();
    res.json({ data: invoice });
  }),
);

export default router;
