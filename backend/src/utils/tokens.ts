import crypto from 'crypto';

/**
 * Cryptographically secure, URL-safe public token for customer-facing invoice links.
 * ~192 bits of entropy — not guessable, and never exposes internal Mongo _id values.
 */
export function generatePublicToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Stable idempotency key fallback when the client does not supply one. */
export function randomId(): string {
  return crypto.randomUUID();
}
