import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { Invoice } from '../models/Invoice';
import { ensureInvoicePdf } from '../services/sales';
import { env } from '../config/env';

const router = Router();

// Public endpoints are unauthenticated — rate-limit to deter token guessing/scraping.
const publicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(publicLimiter);

/** Look up an invoice by its public token. Only the active token resolves. */
async function findByToken(token: string) {
  const invoice = await Invoice.findOne({ publicToken: token, publicTokenActive: true });
  if (!invoice) throw ApiError.notFound('This invoice link is invalid or has been revoked');
  return invoice;
}

/**
 * Customer-facing invoice metadata (no internal IDs, no storage paths, no refs).
 * Backs the /bill/<token> page.
 */
router.get(
  '/invoices/:token',
  asyncHandler(async (req, res) => {
    const invoice = await findByToken(req.params.token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: {
        shop: {
          name: env.shop.name,
          address: env.shop.address,
          phone: env.shop.phone,
          gstin: env.shop.gstin,
        },
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        status: invoice.status,
        customerName: invoice.customerSnapshot.name,
        items: invoice.items.map((i) => ({
          designNumber: i.designNumber,
          productName: i.productName,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
          price: i.price,
          amount: i.amount,
        })),
        subtotal: invoice.subtotal,
        discountAmount: invoice.discountAmount,
        taxPercent: invoice.taxPercent,
        taxAmount: invoice.taxAmount,
        roundOff: invoice.roundOff,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balance: invoice.balance,
        paymentStatus: invoice.paymentStatus,
        pdfUrl: `/api/public/invoices/${invoice.publicToken}/pdf`,
      },
    });
  }),
);

/** Stream the PDF for a public token. Storage stays private; we proxy the bytes. */
router.get(
  '/invoices/:token/pdf',
  asyncHandler(async (req, res) => {
    const invoice = await findByToken(req.params.token);
    const buffer = await ensureInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    const disposition = req.query.download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(buffer);
  }),
);

export default router;
