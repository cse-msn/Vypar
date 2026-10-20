/**
 * Seed script — creates accounts and a full set of sample data for development/demo.
 *
 *   npm run seed            # add users (if missing) + sample data (only if DB is empty)
 *   npm run seed -- --fresh # wipe all collections first, then seed from scratch
 *
 * Populates EVERY collection so every screen/report has something to show:
 *   Users · Suppliers · Customers · Products (+variants) · Purchases · Invoices ·
 *   Payments · Counters — including a cancelled invoice & purchase and a mix of
 *   paid / partial / unpaid / walk-in sales so balances and reports look realistic.
 *
 * Default logins (CHANGE THESE after first login!):
 *   Owner:  owner@mnm.fashion  /  owner123
 *   Staff:  staff@mnm.fashion  /  staff123
 */
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { User, type UserDoc } from '../models/User';
import { Supplier } from '../models/Supplier';
import { SizeGroup } from '../models/SizeGroup';
import { Customer } from '../models/Customer';
import { Product, type ProductDoc } from '../models/Product';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { Purchase } from '../models/Purchase';
import { Counter } from '../models/Counter';
import { createInvoice, cancelInvoice } from '../services/sales';
import { createPurchase, cancelPurchase } from '../services/purchases';
import { recordPayment } from '../services/payments';

/** A date `n` days before now — used to spread history across the last few months. */
const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Ensure a user exists; returns the (new or existing) document. */
async function ensureUser(
  name: string,
  email: string,
  password: string,
  role: 'owner' | 'staff',
): Promise<UserDoc> {
  const existing = await User.findOne({ email });
  if (existing) {
    logger.info(`User already exists, skipping: ${email}`);
    return existing;
  }
  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role,
  });
  logger.info(`Created ${role}: ${email} / ${password}`);
  return user;
}

/** Build an invoice (sale) line referencing a product's Nth variant. */
const line = (
  p: ProductDoc,
  variantIdx: number,
  quantity: number,
  extra: { price?: number; discount?: number } = {},
) => ({
  productId: String(p._id),
  variantId: String(p.variants[variantIdx]._id),
  quantity,
  ...extra,
});

/** Build a purchase (restock) line — cost price is required. */
const pline = (p: ProductDoc, variantIdx: number, quantity: number, costPrice: number) => ({
  productId: String(p._id),
  variantId: String(p.variants[variantIdx]._id),
  quantity,
  costPrice,
});

async function run() {
  const fresh = process.argv.includes('--fresh');
  await connectDB();

  if (fresh) {
    logger.warn('Wiping all collections (--fresh)…');
    await Promise.all([
      User.deleteMany({}),
      Supplier.deleteMany({}),
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      Purchase.deleteMany({}),
      Counter.deleteMany({}),
      SizeGroup.deleteMany({}),
    ]);
  }

  // ── Size groups ──────────────────────────────────────────────────────────
  // Ratio-set templates used by the product grid. Upserted (idempotent) so re-running
  // the seed always keeps the defaults available without duplicating them.
  const DEFAULT_SIZE_GROUPS: Array<{ name: string; sizes: string[] }> = [
    { name: '12-14-16', sizes: ['12', '14', '16'] },
    { name: '12-15-18', sizes: ['12', '15', '18'] },
    { name: '12-15-18-21-24', sizes: ['12', '15', '18', '21', '24'] },
    { name: '20-22-24-26', sizes: ['20', '22', '24', '26'] },
    { name: '20-24-28-32-36', sizes: ['20', '24', '28', '32', '36'] },
    { name: 'S-M-L-XL', sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Free size', sizes: ['Free'] },
  ];
  for (const g of DEFAULT_SIZE_GROUPS) {
    await SizeGroup.updateOne({ name: g.name }, { $setOnInsert: g }, { upsert: true });
  }
  logger.info(`Ensured ${DEFAULT_SIZE_GROUPS.length} size groups.`);

  // ── Users ──────────────────────────────────────────────────────────────
  const owner = await ensureUser('Shop Owner', 'owner@mnm.fashion', 'owner123', 'owner');
  const staff = await ensureUser('Priya Counter', 'staff@mnm.fashion', 'staff123', 'staff');
  const ownerCtx = { id: String(owner._id) };
  const staffCtx = { id: String(staff._id) };

  // Sample business data is only generated when the catalogue is empty, so re-running
  // the seed never duplicates invoices/purchases/stock.
  if ((await Product.estimatedDocumentCount()) > 0) {
    logger.info('Products already exist — skipping sample business data.');
    await disconnectDB();
    logger.info('Seed complete (users only).');
    process.exit(0);
  }

  // ── Suppliers ──────────────────────────────────────────────────────────
  const suppliers = await Supplier.create([
    {
      name: 'Surat Textiles',
      phone: '9811111111',
      email: 'sales@surattextiles.in',
      gstin: '24ABCDE1234F1Z5',
      address: 'Ring Road, Surat, Gujarat',
      notes: 'Primary saree & fabric supplier. 30-day credit.',
    },
    {
      name: 'Jaipur Prints',
      phone: '9822222222',
      email: 'hello@jaipurprints.com',
      gstin: '08PQRST6789K2Z1',
      address: 'MI Road, Jaipur, Rajasthan',
      notes: 'Block-print kurtis and dupattas.',
    },
    {
      name: 'Ludhiana Knitwear',
      phone: '9833333333',
      gstin: '03LMNOP4567Q3Z8',
      address: 'Gill Road, Ludhiana, Punjab',
    },
    {
      name: 'Mumbai Fashion Hub',
      phone: '9844444444',
      email: 'orders@mumbaifashionhub.in',
      address: 'Dadar West, Mumbai, Maharashtra',
      notes: 'Western wear & party collection.',
    },
    {
      name: 'Kolkata Handloom',
      phone: '9855555555',
      address: 'Burrabazar, Kolkata, West Bengal',
      notes: 'Cotton handloom, seasonal stock.',
    },
  ]);
  logger.info(`Created ${suppliers.length} suppliers.`);

  // ── Customers ──────────────────────────────────────────────────────────
  const customers = await Customer.create([
    { name: 'Asha Verma', phone: '9876543210', whatsapp: '9876543210', email: 'asha.verma@example.com', address: 'Flat 4B, Green Residency, Pune' },
    { name: 'Ritu Sharma', phone: '9876500000', whatsapp: '9876500000', address: 'Sector 12, Noida' },
    { name: 'Meena Iyer', phone: '9876511111', email: 'meena.iyer@example.com', address: 'T Nagar, Chennai' },
    { name: 'Fatima Khan', phone: '9876522222', whatsapp: '9123456780', address: 'Charminar, Hyderabad' },
    { name: 'Sunita Patel', phone: '9876533333', gstin: '24ZZZZZ9999Z9Z9', address: 'Satellite, Ahmedabad', notes: 'Boutique reseller — bulk orders.' },
    { name: 'Deepa Nair', phone: '9876544444', email: 'deepa.nair@example.com', address: 'MG Road, Kochi' },
    { name: 'Kavita Joshi', phone: '9876555555', whatsapp: '9876555555', address: 'Civil Lines, Nagpur' },
    { name: 'Neha Gupta', phone: '9876566666', address: 'Hazratganj, Lucknow', notes: 'Prefers COD.' },
  ]);
  logger.info(`Created ${customers.length} customers.`);

  // ── Products (with variants) ───────────────────────────────────────────
  const products = await Product.create([
    {
      designNumber: 'D104', name: 'Anarkali Kurti', category: 'Kurti', fabric: 'Rayon', brand: 'MNM',
      hsnCode: '6104', description: 'Floor-length Anarkali with embroidered yoke.',
      costPrice: 650, sellingPrice: 1200,
      variants: [
        { color: 'Red', size: '36', quantity: 20, sellingPrice: 1200 },
        { color: 'Red', size: '38', quantity: 18 },
        { color: 'Blue', size: '40', quantity: 10, lowStockThreshold: 3 },
        { color: 'Green', size: '38', quantity: 12 },
      ],
    },
    {
      designNumber: 'D220', name: 'Cotton Saree', category: 'Saree', fabric: 'Cotton', brand: 'MNM',
      hsnCode: '5407', costPrice: 900, sellingPrice: 1800,
      variants: [
        { color: 'Green', size: 'Free', quantity: 25 },
        { color: 'Maroon', size: 'Free', quantity: 14 },
        { color: 'Mustard', size: 'Free', quantity: 9 },
      ],
    },
    {
      designNumber: 'D330', name: 'Palazzo Set', category: 'Set', fabric: 'Cotton Blend', brand: 'MNM',
      costPrice: 500, sellingPrice: 999,
      variants: [
        { color: 'Black', size: 'M', quantity: 16 },
        { color: 'Black', size: 'L', quantity: 11 },
        { color: 'Beige', size: 'M', quantity: 8, lowStockThreshold: 4 },
      ],
    },
    {
      designNumber: 'D415', name: 'Silk Lehenga', category: 'Lehenga', fabric: 'Silk', brand: 'Royal MNM',
      hsnCode: '5007', description: 'Bridal lehenga with zari work.',
      costPrice: 4500, sellingPrice: 8999,
      variants: [
        { color: 'Pink', size: 'Free', quantity: 6, lowStockThreshold: 2 },
        { color: 'Royal Blue', size: 'Free', quantity: 4, lowStockThreshold: 2 },
      ],
    },
    {
      designNumber: 'D512', name: 'Printed Dupatta', category: 'Dupatta', fabric: 'Chiffon',
      costPrice: 180, sellingPrice: 399,
      variants: [
        { color: 'Yellow', size: 'Free', quantity: 40 },
        { color: 'Pink', size: 'Free', quantity: 35 },
        { color: 'White', size: 'Free', quantity: 30 },
      ],
    },
    {
      designNumber: 'D623', name: 'Denim Jacket', category: 'Western', fabric: 'Denim', brand: 'Urban MNM',
      hsnCode: '6203', costPrice: 1100, sellingPrice: 2199,
      variants: [
        { color: 'Blue', size: 'S', quantity: 10 },
        { color: 'Blue', size: 'M', quantity: 12 },
        { color: 'Blue', size: 'L', quantity: 7 },
        { color: 'Black', size: 'M', quantity: 5, lowStockThreshold: 3 },
      ],
    },
    {
      designNumber: 'D701', name: 'Banarasi Saree', category: 'Saree', fabric: 'Banarasi Silk', brand: 'Royal MNM',
      hsnCode: '5007', description: 'Handwoven Banarasi with gold border.',
      costPrice: 3200, sellingPrice: 6499,
      variants: [
        { color: 'Red', size: 'Free', quantity: 8 },
        { color: 'Purple', size: 'Free', quantity: 5, lowStockThreshold: 2 },
      ],
    },
    {
      designNumber: 'D808', name: 'Kids Frock', category: 'Kids', fabric: 'Cotton',
      costPrice: 250, sellingPrice: 549,
      variants: [
        { color: 'Pink', size: '2-3Y', quantity: 22 },
        { color: 'Pink', size: '4-5Y', quantity: 18 },
        { color: 'Lavender', size: '4-5Y', quantity: 14 },
      ],
    },
    {
      designNumber: 'D915', name: 'Chikankari Kurti', category: 'Kurti', fabric: 'Georgette', brand: 'MNM',
      costPrice: 780, sellingPrice: 1499,
      variants: [
        { color: 'White', size: 'M', quantity: 15 },
        { color: 'White', size: 'L', quantity: 13 },
        { color: 'Sky Blue', size: 'M', quantity: 9 },
      ],
    },
    {
      designNumber: 'D1020', name: 'Party Gown', category: 'Western', fabric: 'Satin', brand: 'Urban MNM',
      hsnCode: '6204', description: 'Floor-length party gown.',
      costPrice: 1600, sellingPrice: 3299,
      variants: [
        { color: 'Wine', size: 'M', quantity: 6 },
        { color: 'Wine', size: 'L', quantity: 4, lowStockThreshold: 2 },
        { color: 'Emerald', size: 'M', quantity: 3, lowStockThreshold: 2 },
      ],
    },
  ]);
  logger.info(`Created ${products.length} products with variants.`);

  const [d104, d220, d330, d415, d512, d623, d701, d808, d915, d1020] = products;

  // ── Purchases (restock — increases stock + supplier payable) ────────────
  await createPurchase({
    supplierId: String(suppliers[0]._id), supplierBillNo: 'ST-1001', date: daysAgo(55),
    items: [pline(d220, 0, 15, 880), pline(d701, 0, 6, 3100)],
    discount: 200, tax: 0, amountPaid: 10000, notes: 'Festive season restock',
  }, ownerCtx);

  await createPurchase({
    supplierId: String(suppliers[1]._id), supplierBillNo: 'JP-552', date: daysAgo(40),
    items: [pline(d104, 0, 12, 640), pline(d915, 0, 10, 770)],
    tax: 0, amountPaid: 0, notes: 'Full credit — due in 30 days',
  }, ownerCtx);

  await createPurchase({
    supplierId: String(suppliers[3]._id), supplierBillNo: 'MFH-88', date: daysAgo(28),
    items: [pline(d623, 1, 8, 1080), pline(d1020, 0, 5, 1550)],
    discount: 150, amountPaid: 9000,
  }, staffCtx);

  await createPurchase({
    supplierId: String(suppliers[2]._id), supplierBillNo: 'LK-204', date: daysAgo(15),
    items: [pline(d330, 0, 10, 480)], amountPaid: 4800, notes: 'Paid in full',
  }, staffCtx);

  // A purchase we immediately cancel — demonstrates the cancelled state & stock reversal.
  const toCancelPurchase = await createPurchase({
    supplierId: String(suppliers[4]._id), supplierBillNo: 'KH-777', date: daysAgo(10),
    items: [pline(d512, 0, 10, 170)], amountPaid: 0, notes: 'Wrong items — returned',
  }, ownerCtx);
  await cancelPurchase(String(toCancelPurchase._id), ownerCtx);
  logger.info('Created 5 purchases (1 cancelled).');

  // ── Invoices (sales — deducts stock, builds customer balances) ──────────
  // Mix of fully paid, partial, unpaid (credit) and walk-in customers.
  const sales: Array<Parameters<typeof createInvoice>[0]> = [
    {
      customerId: String(customers[0]._id), date: daysAgo(45),
      items: [line(d104, 0, 1), line(d512, 0, 2)],
      taxPercent: 5, roundOff: true, amountPaid: 9999, paymentMethod: 'upi', notes: 'Paid in full',
    },
    {
      customerId: String(customers[1]._id), date: daysAgo(38),
      items: [line(d220, 0, 1)], discountPercent: 10, amountPaid: 800, paymentMethod: 'cash',
      notes: 'Partial — balance on credit',
    },
    {
      customerId: String(customers[2]._id), date: daysAgo(30),
      items: [line(d330, 0, 2), line(d808, 0, 1)], amountPaid: 0, paymentMethod: 'credit',
      notes: 'On account',
    },
    {
      customerId: String(customers[4]._id), date: daysAgo(25),
      items: [line(d415, 0, 1)], taxPercent: 5, roundOff: true, amountPaid: 9448, paymentMethod: 'card',
      notes: 'Bridal purchase — paid',
    },
    {
      customerId: String(customers[3]._id), date: daysAgo(20),
      items: [line(d623, 1, 1), line(d915, 0, 1)], discountAmount: 200, amountPaid: 1500,
      paymentMethod: 'upi', notes: 'Partial',
    },
    {
      customerId: String(customers[5]._id), date: daysAgo(14),
      items: [line(d701, 0, 1)], amountPaid: 6499, paymentMethod: 'bank', notes: 'Paid',
    },
    {
      customerId: String(customers[6]._id), date: daysAgo(9),
      items: [line(d1020, 0, 1), line(d512, 1, 1)], taxPercent: 5, amountPaid: 0,
      paymentMethod: 'credit', notes: 'Unpaid',
    },
    {
      // Walk-in (no customer record) — cash sale, no ledger impact.
      customerName: 'Walk-in Customer', date: daysAgo(6),
      items: [line(d808, 0, 2), line(d512, 2, 1)], amountPaid: 1497, paymentMethod: 'cash',
    },
    {
      customerId: String(customers[7]._id), date: daysAgo(3),
      items: [line(d915, 1, 1)], discountPercent: 5, amountPaid: 700, paymentMethod: 'upi',
      notes: 'Partial',
    },
    {
      customerId: String(customers[0]._id), date: daysAgo(1),
      items: [line(d104, 1, 1), line(d330, 1, 1)], amountPaid: 0, paymentMethod: 'credit',
      notes: 'Repeat customer — on credit',
    },
  ];

  const createdInvoices = [];
  for (const sale of sales) {
    const { invoice } = await createInvoice(sale, sale.customerId ? ownerCtx : staffCtx);
    createdInvoices.push(invoice);
  }

  // One confirmed-then-cancelled invoice (returns stock, reverses balance).
  const toCancel = await createInvoice(
    {
      customerId: String(customers[2]._id), date: daysAgo(12),
      items: [line(d623, 2, 1)], amountPaid: 0, paymentMethod: 'credit',
    },
    staffCtx,
  );
  await cancelInvoice(String(toCancel.invoice._id), ownerCtx, 'Customer changed her mind');
  logger.info(`Created ${createdInvoices.length + 1} invoices (1 cancelled).`);

  // ── Standalone payments (receipts collected later, settle open balances) ─
  await recordPayment({
    customerId: String(customers[1]._id), amount: 400, method: 'cash', date: daysAgo(10),
    notes: 'Part payment towards dues', createdBy: String(staff._id),
  });
  await recordPayment({
    customerId: String(customers[3]._id), amount: 1000, method: 'upi', date: daysAgo(7),
    notes: 'Follow-up collection', createdBy: String(owner._id),
  });
  await recordPayment({
    customerId: String(customers[2]._id), amount: 500, method: 'cash', date: daysAgo(4),
    notes: 'Instalment', createdBy: String(staff._id),
  });
  logger.info('Recorded 3 standalone customer payments.');

  // ── Summary ─────────────────────────────────────────────────────────────
  const [uc, sc, cc, pc, ic, payc, purc] = await Promise.all([
    User.estimatedDocumentCount(),
    Supplier.estimatedDocumentCount(),
    Customer.estimatedDocumentCount(),
    Product.estimatedDocumentCount(),
    Invoice.estimatedDocumentCount(),
    Payment.estimatedDocumentCount(),
    Purchase.estimatedDocumentCount(),
  ]);
  logger.info(
    `Seeded totals — users:${uc} suppliers:${sc} customers:${cc} products:${pc} ` +
      `purchases:${purc} invoices:${ic} payments:${payc}`,
  );

  await disconnectDB();
  logger.info('Seed complete.');
  process.exit(0);
}

run().catch((err) => {
  logger.error('Seed failed', err);
  process.exit(1);
});
