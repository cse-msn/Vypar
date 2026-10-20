import { format, formatDistanceToNow } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat('en-IN');

export const formatCurrency = (n: number | undefined | null) => inr.format(n ?? 0);
export const formatNumber = (n: number | undefined | null) => num.format(n ?? 0);

export const formatDate = (d: string | Date | undefined | null) =>
  d ? format(new Date(d), 'dd MMM yyyy') : '—';

export const formatDateTime = (d: string | Date | undefined | null) =>
  d ? format(new Date(d), 'dd MMM yyyy, h:mm a') : '—';

export const fromNow = (d: string | Date | undefined | null) =>
  d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank: 'Bank',
  credit: 'Credit (pay later)',
  other: 'Other',
};

/** Friendly label for a payment method (e.g. "credit" → "Credit (pay later)"). */
export const paymentMethodLabel = (m?: string | null) => (m ? PAYMENT_METHOD_LABELS[m] ?? m : '—');
