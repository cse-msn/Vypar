/** Keep only digits (drops +, spaces, dashes, country-code punctuation). */
export function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

/** A valid Indian/international mobile is 10–13 digits once punctuation is stripped. */
export function isValidPhone(digits: string): boolean {
  return /^\d{10,13}$/.test(digits);
}

/**
 * The demo OTP for a number is simply its last 4 digits (no real SMS/WhatsApp message is sent).
 * NOTE: this is predictable by design and is NOT secure — anyone who knows a number can log in as it.
 */
export function otpForPhone(digits: string): string {
  return digits.slice(-4);
}
