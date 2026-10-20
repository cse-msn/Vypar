import { Invoice, type InvoiceDoc } from '../models/Invoice';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { nextSequence, formatNumber } from '../models/Counter';
import { reserveStock, releaseStock, type StockLine } from './stock';
import { recordPayment } from './payments';
import { generateInvoicePdf, type InvoicePdfData } from './pdf';
import { getShopProfile } from './shopProfile';
import { getStorage, invoicePdfKey } from './storage';
import { ApiError } from '../utils/ApiError';
import { round2, clamp } from '../utils/money';
import type { PaymentMethod } from '../constants';

export interface InvoiceLineInput {
  productId: string;
  variantId: string;
  quantity: number;
  price?: number; // optional manual override; defaults to variant/product selling price
  discount?: number; // per-line absolute discount
}

export interface CreateInvoiceInput {
  items: InvoiceLineInput[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  customerAddress?: string;
  customerGstin?: string;
  date?: Date;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  roundOff?: boolean;
  amountPaid?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  idempotencyKey?: string;
}

export interface CreateInvoiceResult {
  invoice: InvoiceDoc;
  duplicate: boolean;
}

export async function createInvoice(
  input: CreateInvoiceInput,
  user?: { id: string },
): Promise<CreateInvoiceResult> {
  if (!input.items?.length) throw ApiError.badRequest('An invoice needs at least one item');

  // 1) Idempotency short-circuit (handles network/UI retries without duplicating).
  if (input.idempotencyKey) {
    const existing = await Invoice.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return { invoice: existing, duplicate: true };
  }

  // 2) Resolve products/variants and build authoritative line items + totals server-side.
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: InvoiceDoc['items'] = [] as unknown as InvoiceDoc['items'];
  const reserve: StockLine[] = [];
  for (const line of input.items) {
    if (!line.quantity || line.quantity < 1) throw ApiError.badRequest('Quantity must be at least 1');
    const product = byId.get(line.productId);
    if (!product) throw ApiError.badRequest(`Product not found: ${line.productId}`);
    const variant = product.variants.id(line.variantId);
    if (!variant) throw ApiError.badRequest(`Variant not found in design ${product.designNumber}`);

    const price = round2(line.price ?? variant.sellingPrice ?? product.sellingPrice ?? 0);
    const discount = round2(line.discount ?? 0);
    const amount = round2(price * line.quantity - discount);
    if (amount < 0) throw ApiError.badRequest('Line discount cannot exceed the line total');

    items.push({
      product: product._id,
      variantId: variant._id,
      designNumber: product.designNumber,
      productName: product.name,
      category: product.category,
      sku: variant.sku,
      hsnCode: product.hsnCode,
      color: variant.color,
      size: variant.size,
      quantity: line.quantity,
      price,
      discount,
      amount,
    } as InvoiceDoc['items'][number]);
    reserve.push({ productId: String(product._id), variantId: String(variant._id), quantity: line.quantity });
  }

  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  let discountAmount = 0;
  if (input.discountPercent) discountAmount = round2((subtotal * input.discountPercent) / 100);
  else if (input.discountAmount) discountAmount = round2(input.discountAmount);
  discountAmount = clamp(discountAmount, 0, subtotal);

  const taxable = round2(subtotal - discountAmount);
  const taxPercent = input.taxPercent ?? 0;
  const taxAmount = round2((taxable * taxPercent) / 100);
  let total = round2(taxable + taxAmount);
  let roundOff = 0;
  if (input.roundOff) {
    const rounded = Math.round(total);
    roundOff = round2(rounded - total);
    total = rounded;
  }

  // 3) Customer snapshot (immutable record of who was billed).
  let customerDoc = null;
  if (input.customerId) {
    customerDoc = await Customer.findById(input.customerId);
    if (!customerDoc) throw ApiError.notFound('Selected customer not found');
  }
  const snapshot = customerDoc
    ? {
        name: customerDoc.name,
        phone: customerDoc.phone,
        whatsapp: customerDoc.whatsapp || customerDoc.phone,
        address: customerDoc.address,
        gstin: customerDoc.gstin,
      }
    : {
        name: input.customerName?.trim() || 'Walk-in Customer',
        phone: input.customerPhone,
        whatsapp: input.customerWhatsapp || input.customerPhone,
        address: input.customerAddress,
        gstin: input.customerGstin,
      };

  // 4) Reserve stock atomically (throws on shortfall before anything is persisted).
  await reserveStock(reserve);

  let released = false;
  const release = async () => {
    if (!released) {
      released = true;
      await releaseStock(reserve);
    }
  };

  try {
    const seq = await nextSequence('invoice');
    const invoice = await Invoice.create({
      invoiceNumber: formatNumber('INV', seq),
      customer: customerDoc?._id,
      customerSnapshot: snapshot,
      date: input.date ?? new Date(),
      items,
      subtotal,
      discountPercent: input.discountPercent ?? 0,
      discountAmount,
      taxPercent,
      taxAmount,
      roundOff,
      total,
      amountPaid: 0,
      balance: total,
      paymentStatus: 'unpaid',
      paymentMethod: input.paymentMethod ?? 'cash',
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      createdBy: user?.id,
    });

    // 5) Ledger: customer now owes the full total.
    if (customerDoc) {
      customerDoc.balance = round2(customerDoc.balance + total);
      await customerDoc.save();
    }

    // 6) Apply any amount paid at billing time.
    const paidNow = clamp(round2(input.amountPaid ?? 0), 0, total);
    if (paidNow > 0) {
      if (customerDoc) {
        await recordPayment({
          customerId: customerDoc._id,
          invoiceId: invoice._id,
          amount: paidNow,
          method: invoice.paymentMethod,
          date: invoice.date,
          createdBy: user?.id,
        });
      } else {
        invoice.amountPaid = paidNow;
        invoice.balance = round2(total - paidNow);
        invoice.paymentStatus = invoice.balance <= 0 ? 'paid' : 'partial';
        await invoice.save();
      }
    }

    const fresh = await Invoice.findById(invoice._id);
    return { invoice: fresh!, duplicate: false };
  } catch (err) {
    // Lost an idempotency race: another identical request already created the invoice.
    // Release our reservation so the net stock change is a single deduction.
    if ((err as { code?: number }).code === 11000 && input.idempotencyKey) {
      await release();
      const existing = await Invoice.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return { invoice: existing, duplicate: true };
    }
    await release();
    throw err;
  }
}

export async function cancelInvoice(
  invoiceId: string,
  user?: { id: string },
  reason?: string,
): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status === 'cancelled') throw ApiError.badRequest('Invoice is already cancelled');

  // Return the sold stock.
  await releaseStock(
    invoice.items.map((i) => ({
      productId: String(i.product),
      variantId: String(i.variantId),
      quantity: i.quantity,
    })),
  );

  // Remove the still-owed portion from the customer's balance (payments already made
  // remain as customer credit, i.e. a negative balance to be refunded/adjusted).
  if (invoice.customer && invoice.balance > 0) {
    await Customer.updateOne({ _id: invoice.customer }, { $inc: { balance: -invoice.balance } });
  }

  invoice.status = 'cancelled';
  invoice.cancelledAt = new Date();
  if (user?.id) invoice.cancelledBy = user.id as unknown as InvoiceDoc['cancelledBy'];
  invoice.cancelReason = reason;
  await invoice.save();
  return invoice;
}

/** Generate (or regenerate) the invoice PDF, store it privately, and persist its key. */
export async function ensureInvoicePdf(invoice: InvoiceDoc, force = false): Promise<Buffer> {
  const storage = getStorage();
  const key = invoicePdfKey(String(invoice._id));

  if (!force && invoice.pdf?.key && (await storage.exists(invoice.pdf.key))) {
    return storage.getBuffer(invoice.pdf.key);
  }

  const cgst = round2(invoice.taxAmount / 2);
  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    buyer: {
      name: invoice.customerSnapshot.name,
      phone: invoice.customerSnapshot.phone,
      address: invoice.customerSnapshot.address,
      gstin: invoice.customerSnapshot.gstin,
    },
    items: invoice.items.map((i) => ({
      designNumber: i.designNumber,
      productName: i.productName,
      category: i.category,
      color: i.color,
      size: i.size,
      sku: i.sku,
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      rate: i.price,
      discountPercent: i.discount && i.price * i.quantity > 0 ? round2((i.discount / (i.price * i.quantity)) * 100) : 0,
      amount: i.amount,
    })),
    subtotal: invoice.subtotal,
    discountPercent: invoice.discountPercent,
    discountAmount: invoice.discountAmount,
    taxPercent: invoice.taxPercent,
    taxAmount: invoice.taxAmount,
    cgst,
    sgst: round2(invoice.taxAmount - cgst),
    roundOff: invoice.roundOff,
    total: invoice.total,
    totalQty: invoice.items.reduce((sum, i) => sum + i.quantity, 0),
    amountPaid: invoice.amountPaid,
    balance: invoice.balance,
    paymentMethod: invoice.paymentMethod,
    paymentStatus: invoice.paymentStatus,
    shop: await getShopProfile(),
  };

  const buffer = await generateInvoicePdf(data);
  await storage.put(key, buffer, 'application/pdf');
  invoice.pdf = { key, generatedAt: new Date() };
  await invoice.save();
  return buffer;
}
