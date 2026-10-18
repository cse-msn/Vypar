import { env } from '../config/env';

const pad2 = (n: number) => String(((n % 100) + 100) % 100).padStart(2, '0');

/**
 * Encode a price into the shop's coded tag form, keeping the real price obscured.
 *
 * Format: <YY><YY+1><mid><price left-padded to `pad`><suffix>
 *   where YY = the (current, or configured) year's last 2 digits — it auto-rolls each year.
 *
 *   2025 → encodePrice(1200) = 25 26 1008 1200 27 → "25261008120027"
 *   2026 → encodePrice(1200) = 26 27 1008 1200 27 → "26271008120027"
 *
 * Prices longer than `pad` digits are kept in full (never truncated).
 */
export function encodePrice(price: number, cfg = env.priceCode, now: Date = new Date()): string {
  const year = cfg.year ?? now.getFullYear();
  const whole = Math.max(0, Math.round(price || 0));
  const digits = String(whole).padStart(cfg.pad, '0');
  return `${pad2(year)}${pad2(year + 1)}${cfg.mid}${digits}${cfg.suffix}`;
}
