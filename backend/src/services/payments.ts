import { Types } from 'mongoose';
import { Invoice } from '../models/Invoice';
import { Customer } from '../models/Customer';
import { Payment, type PaymentDoc } from '../models/Payment';
import { nextSequence, formatNumber } from '../models/Counter';
import { ApiError } from '../utils/ApiError';
import { round2 } from '../utils/money';
import type { PaymentMethod } from '../constants';

export interface RecordPaymentInput {
  customerId: string | Types.ObjectId;
  amount: number;
  method?: PaymentMethod;
  date?: Date;
  notes?: string;
  /** Apply to this invoice first; remaining amount spills over to oldest open invoices. */
  invoiceId?: string | Types.ObjectId;
  createdBy?: string;
}

function recomputeInvoiceStatus(inv: { total: number; amountPaid: number; balance: number; paymentStatus: string }) {
  inv.balance = round2(inv.total - inv.amountPaid);
  inv.paymentStatus = inv.balance <= 0 ? 'paid' : inv.amountPaid > 0 ? 'partial' : 'unpaid';
}

/**
 * Record a customer receipt and allocate it across their open invoices (the given one
 * first, then oldest-first). Keeps Σ(invoice.balance) == customer.balance so reports
 * stay internally consistent. Any excess becomes customer credit (negative balance).
 */
export async function recordPayment(input: RecordPaymentInput): Promise<PaymentDoc> {
  const amount = round2(input.amount);
  if (amount <= 0) throw ApiError.badRequest('Payment amount must be greater than zero');

  const customer = await Customer.findById(input.customerId);
  if (!customer) throw ApiError.notFound('Customer not found');

  // Build the ordered list of invoices to settle.
  const openQuery = { customer: customer._id, status: 'confirmed', balance: { $gt: 0 } } as const;
  const open = await Invoice.find(openQuery).sort({ date: 1, createdAt: 1 });

  let ordered = open;
  if (input.invoiceId) {
    const target = await Invoice.findOne({ _id: input.invoiceId, customer: customer._id });
    if (!target) throw ApiError.notFound('Invoice not found for this customer');
    ordered = [target, ...open.filter((i) => String(i._id) !== String(target._id))];
  }

  let remaining = amount;
  let firstApplied: Types.ObjectId | undefined = input.invoiceId ? new Types.ObjectId(String(input.invoiceId)) : undefined;
  for (const inv of ordered) {
    if (remaining <= 0) break;
    if (inv.balance <= 0) continue;
    const applied = Math.min(remaining, inv.balance);
    inv.amountPaid = round2(inv.amountPaid + applied);
    recomputeInvoiceStatus(inv);
    await inv.save();
    remaining = round2(remaining - applied);
    if (!firstApplied) firstApplied = inv._id as Types.ObjectId;
  }

  customer.balance = round2(customer.balance - amount);
  await customer.save();

  const seq = await nextSequence('payment');
  return Payment.create({
    paymentNumber: formatNumber('PAY', seq),
    customer: customer._id,
    invoice: firstApplied,
    amount,
    method: input.method ?? 'cash',
    date: input.date ?? new Date(),
    notes: input.notes,
    createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
  });
}
