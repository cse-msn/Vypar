/**
 * Additive dummy-data generator — APPENDS more sample records without wiping anything.
 * Safe to run repeatedly (uses unique design numbers each run).
 *
 *   npm run seed:more            # add a default batch
 *   COUNT_SALES=60 npm run seed:more   # scale the number of sales
 *
 * Uses the real services (createPurchase / createInvoice / recordPayment) so stock and
 * balances stay consistent. Sales are spread over the last ~90 days for nicer reports.
 */
import { connectDB, disconnectDB } from '../config/db';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { Supplier } from '../models/Supplier';
import { Customer } from '../models/Customer';
import { Product, type ProductDoc } from '../models/Product';
import { createPurchase } from '../services/purchases';
import { createInvoice } from '../services/sales';
import { recordPayment } from '../services/payments';
import type { PaymentMethod } from '../constants';

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rnd(0, arr.length - 1)];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const tag = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const NAMES = ['Cotton Kurti', 'Silk Saree', 'Georgette Gown', 'Denim Jeans', 'Rayon Top', 'Chanderi Suit', 'Net Lehenga', 'Linen Shirt', 'Crepe Dress', 'Velvet Blouse', 'Chikankari Kurti', 'Bandhani Dupatta'];
const CATEGORIES = ['Kurti', 'Saree', 'Gown', 'Jeans', 'Top', 'Suit', 'Lehenga', 'Shirt', 'Dress', 'Blouse', 'Dupatta'];
const FABRICS = ['Cotton', 'Silk', 'Georgette', 'Denim', 'Rayon', 'Chanderi', 'Net', 'Linen', 'Crepe', 'Velvet'];
const COLORS = ['Red', 'Blue', 'Green', 'Black', 'White', 'Pink', 'Maroon', 'Navy', 'Mustard', 'Teal', 'Beige', 'Wine'];
const SIZES = ['S', 'M', 'L', 'XL', '36', '38', '40', '42', 'Free'];
const FIRST = ['Pooja', 'Anjali', 'Sneha', 'Divya', 'Rekha', 'Shalini', 'Nisha', 'Komal', 'Aarti', 'Swati', 'Geeta', 'Leena'];
const LAST = ['Shah', 'Mehta', 'Patel', 'Reddy', 'Nair', 'Singh', 'Rao', 'Desai', 'Bose', 'Kaur'];
const METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank'];

async function run() {
  await connectDB();
  const sales = Number(process.env.COUNT_SALES) || 30;

  // Need an owner for createdBy context.
  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.create({ name: 'Shop Owner', email: 'owner@mnm.fashion', passwordHash: await User.hashPassword('owner123'), role: 'owner' });
    logger.info('Created owner (owner@mnm.fashion / owner123)');
  }
  const ctx = { id: String(owner._id) };

  // Suppliers
  const suppliers = await Supplier.create(
    Array.from({ length: 2 }, (_, i) => ({ name: `Vendor ${tag()}-${i + 1}`, phone: `98${rnd(10000000, 99999999)}`, address: pick(['Surat', 'Jaipur', 'Delhi', 'Mumbai']) })),
  );

  // Customers
  const customers = await Customer.create(
    Array.from({ length: 6 }, () => ({ name: `${pick(FIRST)} ${pick(LAST)}`, phone: `9${rnd(100000000, 999999999)}`, address: pick(['Pune', 'Noida', 'Kochi', 'Nagpur', 'Indore']) })),
  );

  // Products with generous stock so sales don't run dry.
  const products: ProductDoc[] = [];
  for (let i = 0; i < 8; i++) {
    const nameIdx = rnd(0, NAMES.length - 1);
    const cost = rnd(200, 4000);
    const colors = Array.from(new Set(Array.from({ length: rnd(2, 3) }, () => pick(COLORS))));
    const sizes = Array.from(new Set(Array.from({ length: rnd(2, 3) }, () => pick(SIZES))));
    const variants = colors.flatMap((color) => sizes.map((size) => ({ color, size, quantity: rnd(15, 45) })));
    products.push(
      await Product.create({
        designNumber: `DX${tag()}${i}`,
        name: NAMES[nameIdx],
        category: CATEGORIES[nameIdx % CATEGORIES.length],
        fabric: pick(FABRICS),
        brand: pick(['MNM', 'Royal MNM', 'Urban MNM', '']),
        costPrice: cost,
        sellingPrice: Math.round(cost * (1.6 + Math.random() * 0.8)),
        variants,
      }),
    );
  }
  logger.info(`Added ${suppliers.length} suppliers, ${customers.length} customers, ${products.length} products.`);

  // Purchases (restock a few variants).
  let purchases = 0;
  for (let i = 0; i < 4; i++) {
    const p = pick(products);
    const v = pick(p.variants);
    try {
      await createPurchase(
        { supplierId: String(pick(suppliers)._id), supplierBillNo: `BILL-${tag()}`, date: daysAgo(rnd(30, 90)), items: [{ productId: String(p._id), variantId: String(v._id), quantity: rnd(5, 20), costPrice: p.costPrice }], amountPaid: rnd(0, 5000) },
        ctx,
      );
      purchases++;
    } catch {
      /* skip */
    }
  }

  // Sales spread across the last 90 days with varied payment status.
  let made = 0;
  for (let i = 0; i < sales; i++) {
    const p = pick(products);
    const lineCount = rnd(1, 3);
    const chosen = new Set<string>();
    const items = [];
    for (let j = 0; j < lineCount; j++) {
      const v = pick(p.variants);
      if (chosen.has(String(v._id))) continue;
      chosen.add(String(v._id));
      items.push({ productId: String(p._id), variantId: String(v._id), quantity: rnd(1, 3) });
    }
    const roll = Math.random();
    const amountPaid = roll < 0.6 ? 1e7 : roll < 0.8 ? rnd(100, 800) : 0; // full / partial / unpaid (clamped server-side)
    const useCustomer = Math.random() < 0.75;
    try {
      await createInvoice(
        {
          items,
          customerId: useCustomer ? String(pick(customers)._id) : undefined,
          customerName: useCustomer ? undefined : 'Walk-in Customer',
          date: daysAgo(rnd(0, 90)),
          amountPaid,
          paymentMethod: pick(METHODS),
          discountAmount: Math.random() < 0.3 ? rnd(50, 300) : undefined,
          idempotencyKey: `dummy-${tag()}-${i}`,
        },
        ctx,
      );
      made++;
    } catch {
      /* insufficient stock etc. — skip */
    }
  }

  // A few standalone receipts.
  let payments = 0;
  for (let i = 0; i < 8; i++) {
    try {
      await recordPayment({ customerId: String(pick(customers)._id), amount: rnd(200, 1500), method: pick(METHODS), date: daysAgo(rnd(0, 60)), createdBy: ctx.id });
      payments++;
    } catch {
      /* skip */
    }
  }

  logger.info(`Added ${purchases} purchases, ${made} sales, ${payments} payments.`);
  const [tp, tc, ts] = await Promise.all([
    Product.countDocuments(),
    Customer.countDocuments(),
    Supplier.countDocuments(),
  ]);
  logger.info(`DB totals now → products:${tp} customers:${tc} suppliers:${ts}`);
  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  logger.error('addDummyData failed', err);
  process.exit(1);
});
