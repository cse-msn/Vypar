import { env } from '../config/env';

const pad2 = (n: number) => String(((n % 100) + 100) % 100).padStart(2, '0');

/**
 * Encode a price into the shop's coded tag form, keeping the real price obscured.
 *
 * Format: <YY><mid><price left-padded to `pad`><suffix>
 *   where YY = the (current, or configured) year's last 2 digits — ONLY this rolls each year.
 *   `mid` and `suffix` are fixed, so a year change touches only the first two digits.
 *
 *   2026 → encodePrice(1200) = 26 271008 1200 23 → "26271008120023"
 *   2027 → encodePrice(1200) = 27 271008 1200 23 → "27271008120023"
 *
 * Prices longer than `pad` digits are kept in full (never truncated).
 */
export function encodePrice(price: number, cfg = env.priceCode, now: Date = new Date()): string {
  const year = cfg.year ?? now.getFullYear();
  const whole = Math.max(0, Math.round(price || 0));
  const digits = String(whole).padStart(cfg.pad, '0');
  return `${pad2(year)}${cfg.mid}${digits}${cfg.suffix}`;
}
