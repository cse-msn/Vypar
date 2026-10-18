import { env } from '../config/env';

/**
 * Normalise a phone number to the digits-only form wa.me expects (country code + number).
 * Defaults a bare 10-digit number to India (91) since that's the shop's market; numbers
 * that already include a country code are kept as-is. Returns null when unusable.
 */
export function normalizeWhatsAppNumber(raw?: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

export interface InvoiceShare {
  publicUrl: string;
  /** Long message with the bill link — used for "Open WhatsApp (link)". */
  message: string;
  /** Short amount summary — used as the caption when sharing the PDF file itself. */
  pdfMessage: string;
  /** wa.me chat prefilled with the link message. */
  whatsappUrl: string;
  /** wa.me chat prefilled with the short amount summary (no link) — for the PDF flow. */
  pdfWhatsappUrl: string;
  hasNumber: boolean;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

/** Build the customer-facing link, prefilled messages, and click-to-chat URL for an invoice. */
export function buildInvoiceShare(params: {
  token: string;
  invoiceNumber: string;
  total: number;
  amountPaid?: number;
  balance?: number;
  customerName?: string;
  phone?: string;
}): InvoiceShare {
  const publicUrl = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/bill/${params.token}`;
  const hello = params.customerName ? `Hi ${params.customerName},` : 'Hello,';
  const paid = params.amountPaid ?? 0;
  const balance = params.balance ?? Math.max(0, params.total - paid);

  const message =
    `${hello}\n` +
    `Thank you for shopping at ${env.shop.name}.\n` +
    `Invoice ${params.invoiceNumber}  •  Total: Rs. ${money(params.total)}\n` +
    `View / download your bill here:\n${publicUrl}`;

  // Short, amount-only caption that rides along with the attached PDF.
  const pdfMessage =
    `${hello}\n` +
    `${env.shop.name} — Invoice ${params.invoiceNumber}\n` +
    `Amount: Rs. ${money(params.total)}\n` +
    `Paid: Rs. ${money(paid)}\n` +
    `Pending: Rs. ${money(balance)}` +
    (balance <= 0 ? ' (fully paid)' : '');

  const number = normalizeWhatsAppNumber(params.phone);
  const chat = (text: string) =>
    // With a number → direct chat; without → WhatsApp opens the contact picker.
    number
      ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return {
    publicUrl,
    message,
    pdfMessage,
    whatsappUrl: chat(message),
    pdfWhatsappUrl: chat(pdfMessage),
    hasNumber: Boolean(number),
  };
}
