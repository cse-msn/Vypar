import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, clearDatabase, api, bootstrapOwner } from './helpers';

let auth: (req: any) => any;

async function createProduct(overrides: Record<string, unknown> = {}) {
  const res = await auth(api().post('/api/products'))
    .send({
      designNumber: overrides.designNumber ?? 'D104',
      name: 'Anarkali Kurti',
      category: 'Kurti',
      sellingPrice: 1200,
      costPrice: 700,
      b2bPrice: 1120,
      b2cPrice: 1470,
      variants: [
        { color: 'Red', size: '36', quantity: 10, sellingPrice: 1200 },
        { color: 'Blue', size: '38', quantity: 5 },
      ],
      ...overrides,
    })
    .expect(201);
  return res.body.data;
}

async function createCustomer() {
  const res = await auth(api().post('/api/customers'))
    .send({ name: 'Asha', phone: '9876543210' })
    .expect(201);
  return res.body.data;
}

beforeAll(async () => {
  await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

describe('Auth', () => {
  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
  });

  it('rejects protected routes without a token', async () => {
    await api().get('/api/products').expect(401);
  });

  it('rejects invalid credentials', async () => {
    await api().post('/api/auth/login').send({ email: 'owner@mnm.test', password: 'wrong' }).expect(401);
  });

  it('returns the current user from /me', async () => {
    const res = await auth(api().get('/api/auth/me')).expect(200);
    expect(res.body.data.email).toBe('owner@mnm.test');
    expect(res.body.data.role).toBe('owner');
    expect(res.body.data.passwordHash).toBeUndefined();
  });
});

describe('Products & stock lookup', () => {
  let d104: any;
  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
  });

  it('creates a product with variants and auto-generates numeric item codes', async () => {
    d104 = await createProduct();
    expect(d104.designNumber).toBe('D104');
    expect(d104.variants).toHaveLength(2);
    // Numeric item codes: <product.code><variant seq padded to 3>, e.g. 200001001.
    expect(d104.code).toBeGreaterThanOrEqual(200001);
    expect(d104.variants[0].sku).toBe(`${d104.code}001`);
    expect(d104.variants[1].sku).toBe(`${d104.code}002`);
    expect(d104.totalStock).toBe(15);
  });

  it('looks up stock by barcode/item code', async () => {
    const res = await auth(api().get('/api/products/lookup').query({ barcode: d104.variants[0].sku })).expect(200);
    expect(res.body.data.variant.color).toBe('Red');
    expect(res.body.data.variant.quantity).toBe(10);
  });

  it('looks up stock by design + colour + size', async () => {
    const res = await auth(
      api().get('/api/products/lookup').query({ design: 'D104', color: 'blue', size: '38' }),
    ).expect(200);
    expect(res.body.data.variant.quantity).toBe(5);
  });

  it('rejects duplicate colour/size variants', async () => {
    const product = await createProduct({ designNumber: 'D200' });
    await auth(api().post(`/api/products/${product._id}/variants`))
      .send({ color: 'Red', size: '36', quantity: 1 })
      .expect(400);
  });
});

describe('Billing — stock deduction, totals & PDF', () => {
  let product: any;
  let customer: any;

  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
    product = await createProduct();
    customer = await createCustomer();
  });

  it('creates an invoice, deducts stock, and computes totals server-side', async () => {
    const variant = product.variants[0]; // Red/36, qty 10, price 1200
    const res = await auth(api().post('/api/invoices'))
      .send({
        customerId: customer._id,
        items: [{ productId: product._id, variantId: variant._id, quantity: 3 }],
        amountPaid: 2000,
        taxPercent: 0,
      })
      .expect(201);

    const inv = res.body.data;
    expect(inv.invoiceNumber).toMatch(/^INV-\d+$/);
    expect(inv.subtotal).toBe(3600);
    expect(inv.total).toBe(3600);
    expect(inv.amountPaid).toBe(2000);
    expect(inv.balance).toBe(1600);
    expect(inv.paymentStatus).toBe('partial');
    expect(inv.publicToken).toBeTruthy();

    // Stock went from 10 → 7.
    const look = await auth(api().get('/api/products/lookup').query({ barcode: variant.sku })).expect(200);
    expect(look.body.data.variant.quantity).toBe(7);

    // Customer now owes the balance.
    const cust = await auth(api().get(`/api/customers/${customer._id}`)).expect(200);
    expect(cust.body.data.balance).toBe(1600);

    // Authenticated PDF is a real PDF.
    const pdf = await auth(api().get(`/api/invoices/${inv._id}/pdf`)).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('rejects a sale that exceeds available stock without changing stock', async () => {
    const variant = product.variants[1]; // Blue/38, qty 5
    await auth(api().post('/api/invoices'))
      .send({ items: [{ productId: product._id, variantId: variant._id, quantity: 999 }] })
      .expect(409);

    const look = await auth(api().get('/api/products/lookup').query({ barcode: variant.sku })).expect(200);
    expect(look.body.data.variant.quantity).toBe(5); // unchanged
  });
});

describe('Idempotency & cancellation', () => {
  let product: any;

  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
    product = await createProduct({
      designNumber: 'D300',
      variants: [{ color: 'Green', size: '40', quantity: 50, sellingPrice: 500 }],
    });
  });

  it('deduplicates retried submissions with the same idempotency key', async () => {
    const variant = product.variants[0];
    const payload = {
      items: [{ productId: product._id, variantId: variant._id, quantity: 2 }],
      idempotencyKey: 'fixed-key-123',
    };

    const first = await auth(api().post('/api/invoices')).send(payload).expect(201);
    const second = await auth(api().post('/api/invoices')).send(payload).expect(200);

    expect(second.body.duplicate).toBe(true);
    expect(second.body.data._id).toBe(first.body.data._id);

    // Deducted exactly once: 50 → 48.
    const look = await auth(api().get('/api/products/lookup').query({ barcode: variant.sku })).expect(200);
    expect(look.body.data.variant.quantity).toBe(48);
  });

  it('restores stock when an invoice is cancelled', async () => {
    const variant = product.variants[0];
    const created = await auth(api().post('/api/invoices'))
      .send({ items: [{ productId: product._id, variantId: variant._id, quantity: 5 }] })
      .expect(201);

    let look = await auth(api().get('/api/products/lookup').query({ barcode: variant.sku })).expect(200);
    expect(look.body.data.variant.quantity).toBe(43); // 48 → 43

    await auth(api().post(`/api/invoices/${created.body.data._id}/cancel`)).send({ reason: 'test' }).expect(200);

    look = await auth(api().get('/api/products/lookup').query({ barcode: variant.sku })).expect(200);
    expect(look.body.data.variant.quantity).toBe(48); // restored
  });
});

describe('Public invoice link (no auth)', () => {
  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
  });

  it('serves invoice metadata + PDF by token without authentication and hides internal IDs', async () => {
    const product = await createProduct({ designNumber: 'D400' });
    const created = await auth(api().post('/api/invoices'))
      .send({
        customerName: 'Walk-in',
        items: [{ productId: product._id, variantId: product.variants[0]._id, quantity: 1 }],
      })
      .expect(201);
    const token = created.body.data.publicToken;

    // No Authorization header here — simulates the customer's browser.
    const meta = await api().get(`/api/public/invoices/${token}`).expect(200);
    expect(meta.body.data.invoiceNumber).toBe(created.body.data.invoiceNumber);
    expect(meta.body.data._id).toBeUndefined();
    expect(meta.body.data.customer).toBeUndefined();
    expect(JSON.stringify(meta.body.data)).not.toContain(created.body.data._id);

    const pdf = await api().get(`/api/public/invoices/${token}/pdf`).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');

    // An unknown token is rejected.
    await api().get('/api/public/invoices/not-a-real-token').expect(404);
  });
});

describe('Payments', () => {
  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
  });

  it('records a payment and settles invoice + customer balance', async () => {
    const product = await createProduct({ designNumber: 'D500' });
    const customer = await createCustomer();
    const inv = await auth(api().post('/api/invoices'))
      .send({
        customerId: customer._id,
        items: [{ productId: product._id, variantId: product.variants[0]._id, quantity: 1 }], // 1200
      })
      .expect(201);
    expect(inv.body.data.balance).toBe(1200);

    await auth(api().post('/api/payments'))
      .send({ customerId: customer._id, amount: 1200, method: 'upi' })
      .expect(201);

    const refreshed = await auth(api().get(`/api/invoices/${inv.body.data._id}`)).expect(200);
    expect(refreshed.body.data.balance).toBe(0);
    expect(refreshed.body.data.paymentStatus).toBe('paid');

    const cust = await auth(api().get(`/api/customers/${customer._id}`)).expect(200);
    expect(cust.body.data.balance).toBe(0);
  });
});

describe('Reports', () => {
  beforeAll(async () => {
    await clearDatabase();
    ({ auth } = await bootstrapOwner());
  });

  it('returns a dashboard summary', async () => {
    const product = await createProduct({ designNumber: 'D600' });
    await auth(api().post('/api/invoices'))
      .send({ items: [{ productId: product._id, variantId: product.variants[0]._id, quantity: 1 }], amountPaid: 1200 })
      .expect(201);

    const res = await auth(api().get('/api/reports/dashboard')).expect(200);
    expect(res.body.data.salesToday.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.productCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.lowStock)).toBe(true);
  });
});
