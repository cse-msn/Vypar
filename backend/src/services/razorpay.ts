import crypto from 'crypto';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/** Whether online payments are available (both key id + secret configured). */
export function isRazorpayConfigured(): boolean {
  return env.razorpay.configured;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
}

/**
 * Create a Razorpay order via the REST API (no SDK dependency). Amount is taken in rupees and
 * converted to paise (integer minor units) — never floating-point money. The returned `id`
 * (order_xxx) is handed to Razorpay Checkout on the client.
 */
export async function createRazorpayOrder(amountRupees: number, receipt: string): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) throw ApiError.badRequest('Online payment is not configured');
  const amountPaise = Math.round(amountRupees * 100);
  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, payment_capture: 1 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error(`Razorpay order creation failed (${res.status}): ${text}`);
    // Surface Razorpay's own reason (e.g. "Authentication failed", "account not activated") — it's
    // not sensitive and makes misconfiguration diagnosable instead of a blank "try again".
    let reason = '';
    try {
      reason = (JSON.parse(text)?.error?.description as string) || '';
    } catch {
      /* non-JSON body */
    }
    if (res.status === 401) reason ||= 'Authentication failed — check RAZORPAY_KEY_ID/SECRET';
    throw ApiError.badRequest(`Online payment could not start${reason ? `: ${reason}` : '. Please try again.'}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the checkout handshake signature Razorpay returns to the browser. This is an
 * HMAC-SHA256 of `${order_id}|${payment_id}` keyed with the secret — cryptographic proof the
 * payment succeeded, not a browser-trusted "success page". Returns true when valid.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!isRazorpayConfigured()) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafeEqual(expected, signature);
}

/** Verify a Razorpay webhook body against the X-Razorpay-Signature header. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  if (!env.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
