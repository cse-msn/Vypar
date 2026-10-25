import { Router, type Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { verifyWebhookSignature } from '../../services/razorpay';
import { markOrderPaidByRazorpayOrderId } from '../../services/orders';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Razorpay webhook (server-to-server; no customer auth). The authoritative confirmation of payment
 * even if the customer closes the browser before the success handshake. Signature is verified
 * against the raw request body + the dashboard webhook secret. Always 200s a well-formed request so
 * Razorpay doesn't retry forever; rejects only an invalid/unverifiable signature.
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request & { rawBody?: Buffer }, res) => {
    const signature = req.header('x-razorpay-signature') ?? '';
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!verifyWebhookSignature(raw, signature)) {
      logger.warn('Razorpay webhook: invalid signature');
      return res.status(400).json({ error: 'invalid signature' });
    }

    const event = req.body?.event as string | undefined;
    // On a captured/authorized payment, mark the matching order paid (idempotent).
    if (event === 'payment.captured' || event === 'payment.authorized') {
      const entity = req.body?.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = entity?.order_id;
      const paymentId: string | undefined = entity?.id;
      if (razorpayOrderId && paymentId) {
        await markOrderPaidByRazorpayOrderId(razorpayOrderId, paymentId);
      }
    }
    res.json({ received: true });
  }),
);

export default router;
