/**
 * Automated API smoke/acceptance runner.
 *
 *   npm run test:api
 *   API_URL=https://api.example.com/api API_EMAIL=... API_PASSWORD=... npm run test:api
 *
 * Hits every REST endpoint against a RUNNING server, prints a PASS/FAIL table, writes a
 * formatted PDF report (backend/api-test-report.pdf), and exits non-zero on any failure.
 * Creates a few throwaway `ZZTEST` records and cleans them up (cancel/soft-delete) at the end.
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const BASE = (process.env.API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const EMAIL = process.env.API_EMAIL || 'owner@mnm.fashion';
const PASSWORD = process.env.API_PASSWORD || 'owner123';
const SFX = Date.now().toString(36).slice(-5).toUpperCase();

interface Result {
  group: string;
  name: string;
  method: string;
  path: string;
  status: number | string;
  ok: boolean;
  detail?: string;
}
const results: Result[] = [];
let token = '';

interface Resp {
  status: number | string;
  body: any;
  buf: Buffer;
  headers?: Headers;
}

async function call(
  method: string,
  p: string,
  opts: { auth?: boolean; body?: unknown; raw?: boolean } = {},
): Promise<Resp> {
  const { auth = true, body, raw = false } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const buf = Buffer.from(await res.arrayBuffer());
  let parsed: any = null;
  if (!raw) {
    try {
      parsed = JSON.parse(buf.toString('utf8'));
    } catch {
      /* non-JSON (e.g. PDF) */
    }
  }
  return { status: res.status, body: parsed, buf, headers: res.headers };
}

function logLine(r: Result) {
  const tag = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  const extra = !r.ok && r.detail ? `  -> ${r.detail}` : '';
  // eslint-disable-next-line no-console
  console.log(`  [${tag}] ${r.group} · ${r.name}  (${r.method} ${r.path}) -> ${r.status}${extra}`);
}

/** Run a call and assert; records + logs the result; returns the response for chaining. */
async function check(
  group: string,
  name: string,
  method: string,
  p: string,
  opts: { auth?: boolean; body?: unknown; raw?: boolean },
  assert: (r: Resp) => boolean,
): Promise<Resp> {
  let r: Resp;
  try {
    r = await call(method, p, opts);
  } catch (e) {
    r = { status: 'ERR', body: null, buf: Buffer.alloc(0) };
    const res: Result = { group, name, method, path: p, status: 'ERR', ok: false, detail: (e as Error).message };
    results.push(res);
    logLine(res);
    return r;
  }
  const ok = (() => {
    try {
      return assert(r);
    } catch {
      return false;
    }
  })();
  const detail = ok ? undefined : (JSON.stringify(r.body)?.slice(0, 140) || String(r.status));
  const res: Result = { group, name, method, path: p, status: r.status, ok, detail };
  results.push(res);
  logLine(res);
  return r;
}

const is = (code: number) => (r: Resp) => r.status === code;
const ok2xx = (r: Resp) => typeof r.status === 'number' && r.status >= 200 && r.status < 300;
const isPdf = (r: Resp) => r.status === 200 && r.buf.slice(0, 4).toString() === '%PDF';

async function run() {
  // eslint-disable-next-line no-console
  console.log(`\n▶ API test run against ${BASE}\n`);

  // ── System ──
  await check('System', 'Health check', 'GET', '/health', { auth: false }, (r) => r.status === 200 && r.body?.status === 'ok');

  // ── Auth (login first; abort if it fails) ──
  const login = await call('POST', '/auth/login', { auth: false, body: { email: EMAIL, password: PASSWORD } });
  const loginOk = login.status === 200 && !!login.body?.data?.token;
  results.push({ group: 'Auth', name: 'Login (valid)', method: 'POST', path: '/auth/login', status: login.status, ok: loginOk, detail: loginOk ? undefined : 'no token' });
  logLine(results[results.length - 1]);
  if (!loginOk) {
    // eslint-disable-next-line no-console
    console.error(`\n✖ Cannot log in as ${EMAIL}. Start the server and run \`npm run seed\` first.\n`);
    await emitReport();
    process.exit(1);
  }
  token = login.body.data.token;

  await check('Auth', 'Login (wrong password)', 'POST', '/auth/login', { auth: false, body: { email: EMAIL, password: 'nope-nope' } }, is(401));
  await check('Auth', 'Current user /me', 'GET', '/auth/me', {}, (r) => r.status === 200 && !r.body?.data?.passwordHash);
  await check('Auth', 'List users (owner)', 'GET', '/auth/users', {}, ok2xx);
  const newUser = await check('Auth', 'Create user', 'POST', '/auth/register', { body: { name: 'ZZ Test', email: `zztest_${SFX}@test.local`, password: 'test123', role: 'staff' } }, (r) => r.status === 201);
  const userId = newUser.body?.data?._id;
  if (userId) await check('Auth', 'Update user (deactivate)', 'PATCH', `/auth/users/${userId}`, { body: { active: false } }, ok2xx);

  // ── Products ──
  const prod = await check(
    'Products',
    'Create product + variants',
    'POST',
    '/products',
    {
      body: {
        designNumber: `ZZTEST${SFX}`,
        name: 'API Test Kurti',
        category: 'Test',
        costPrice: 60,
        sellingPrice: 120,
        variants: [
          { color: 'Red', size: '36', quantity: 5, sellingPrice: 120 },
          { color: 'Blue', size: '38', quantity: 3 },
        ],
      },
    },
    (r) => r.status === 201 && r.body?.data?.variants?.length === 2,
  );
  const product = prod.body?.data;
  const pid = product?._id;
  const v0 = product?.variants?.[0];
  const v1 = product?.variants?.[1];

  await check('Products', 'List / search', 'GET', `/products?search=ZZTEST${SFX}`, {}, (r) => r.status === 200 && Array.isArray(r.body?.data));
  if (v0) await check('Products', 'Lookup by barcode/SKU', 'GET', `/products/lookup?barcode=${encodeURIComponent(v0.sku)}`, {}, (r) => r.status === 200 && r.body?.data?.variant?.sku === v0.sku);
  await check('Products', 'Lookup by design/colour/size', 'GET', `/products/lookup?design=ZZTEST${SFX}&color=Red&size=36`, {}, (r) => r.status === 200 && !!r.body?.data?.variant);
  await check('Products', 'Lookup unknown barcode -> 404', 'GET', '/products/lookup?barcode=NOPE-NOPE-NOPE', {}, is(404));
  if (pid) await check('Products', 'Get by id', 'GET', `/products/${pid}`, {}, ok2xx);
  if (pid) await check('Products', 'Update', 'PATCH', `/products/${pid}`, { body: { name: 'API Test Kurti (edited)' } }, ok2xx);
  const added = pid ? await check('Products', 'Add variant', 'POST', `/products/${pid}/variants`, { body: { color: 'Green', size: '40', quantity: 0 } }, (r) => r.status === 201) : null;
  const vGreen = added?.body?.data?.variants?.find((v: any) => v.color === 'Green');
  if (pid && v0) await check('Products', 'Update variant', 'PATCH', `/products/${pid}/variants/${v0._id}`, { body: { sellingPrice: 125 } }, ok2xx);
  if (pid && v0) await check('Products', 'Adjust stock (+1)', 'POST', `/products/${pid}/variants/${v0._id}/adjust`, { body: { delta: 1 } }, ok2xx);
  if (pid) await check('Products', 'Print labels (PDF)', 'GET', `/products/${pid}/labels?copies=1`, { raw: true }, isPdf);
  if (pid && v1) await check('Products', 'Duplicate variant -> 400', 'POST', `/products/${pid}/variants`, { body: { color: 'Blue', size: '38', quantity: 1 } }, is(400));

  // ── Suppliers ──
  const sup = await check('Suppliers', 'Create', 'POST', '/suppliers', { body: { name: `ZZTEST Supplier ${SFX}`, phone: '9000000001' } }, (r) => r.status === 201);
  const supId = sup.body?.data?._id;
  await check('Suppliers', 'List', 'GET', '/suppliers', {}, ok2xx);
  if (supId) await check('Suppliers', 'Get by id', 'GET', `/suppliers/${supId}`, {}, ok2xx);
  if (supId) await check('Suppliers', 'Update', 'PATCH', `/suppliers/${supId}`, { body: { notes: 'test' } }, ok2xx);

  // ── Customers ──
  const cust = await check('Customers', 'Create', 'POST', '/customers', { body: { name: `ZZTEST Customer ${SFX}`, phone: '9000000002' } }, (r) => r.status === 201);
  const custId = cust.body?.data?._id;
  await check('Customers', 'List', 'GET', '/customers', {}, ok2xx);
  if (custId) await check('Customers', 'Get by id', 'GET', `/customers/${custId}`, {}, ok2xx);
  if (custId) await check('Customers', 'Update', 'PATCH', `/customers/${custId}`, { body: { address: 'Test Rd' } }, ok2xx);
  if (custId) await check('Customers', 'Ledger', 'GET', `/customers/${custId}/ledger`, {}, (r) => r.status === 200 && Array.isArray(r.body?.data?.invoices));

  // ── Purchases ──
  let purId: string | undefined;
  if (supId && pid && v1) {
    const pur = await check('Purchases', 'Create (stock-in)', 'POST', '/purchases', { body: { supplierId: supId, items: [{ productId: pid, variantId: v1._id, quantity: 2, costPrice: 60 }], amountPaid: 100 } }, (r) => r.status === 201);
    purId = pur.body?.data?._id;
    await check('Purchases', 'List', 'GET', '/purchases', {}, ok2xx);
    if (purId) await check('Purchases', 'Get by id', 'GET', `/purchases/${purId}`, {}, ok2xx);
  }

  // ── Invoices ──
  let invId: string | undefined;
  let invToken: string | undefined;
  if (pid && v0) {
    const idemKey = `apitest-${SFX}`;
    const inv = await check('Invoices', 'Create (deduct stock)', 'POST', '/invoices', { body: { customerId: custId, items: [{ productId: pid, variantId: v0._id, quantity: 1 }], amountPaid: 50, idempotencyKey: idemKey } }, (r) => r.status === 201 && /^INV-/.test(r.body?.data?.invoiceNumber));
    invId = inv.body?.data?._id;
    invToken = inv.body?.data?.publicToken;
    await check('Invoices', 'Idempotent retry -> duplicate', 'POST', '/invoices', { body: { customerId: custId, items: [{ productId: pid, variantId: v0._id, quantity: 1 }], amountPaid: 50, idempotencyKey: idemKey } }, (r) => r.status === 200 && r.body?.duplicate === true && r.body?.data?._id === invId);
    await check('Invoices', 'Insufficient stock -> 409', 'POST', '/invoices', { body: { items: [{ productId: pid, variantId: v0._id, quantity: 99999 }] } }, is(409));
    await check('Invoices', 'List', 'GET', '/invoices', {}, ok2xx);
    if (invId) await check('Invoices', 'Get by id', 'GET', `/invoices/${invId}`, {}, ok2xx);
    if (invId) await check('Invoices', 'PDF (inline)', 'GET', `/invoices/${invId}/pdf`, { raw: true }, isPdf);
    if (invId) await check('Invoices', 'Regenerate PDF', 'POST', `/invoices/${invId}/pdf/regenerate`, {}, ok2xx);
    if (invId) await check('Invoices', 'WhatsApp share payload', 'GET', `/invoices/${invId}/share`, {}, (r) => r.status === 200 && String(r.body?.data?.whatsappUrl).startsWith('https://wa.me/'));
  }

  // ── Payments ──
  if (custId) {
    await check('Payments', 'Record payment', 'POST', '/payments', { body: { customerId: custId, amount: 30, method: 'cash' } }, (r) => r.status === 201);
    await check('Payments', 'List', 'GET', '/payments', {}, ok2xx);
  }

  // ── Media (uploads + public serve) ──
  try {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const fd = new FormData();
    fd.append('files', new Blob([png], { type: 'image/png' }), 'test.png');
    const up = await fetch(`${BASE}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const upBody: any = await up.json().catch(() => null);
    const mediaUrl: string | undefined = upBody?.data?.[0]?.url;
    const upOk = up.status === 201 && !!mediaUrl;
    const r1: Result = { group: 'Media', name: 'Upload image', method: 'POST', path: '/uploads', status: up.status, ok: upOk, detail: upOk ? undefined : JSON.stringify(upBody)?.slice(0, 120) };
    results.push(r1);
    logLine(r1);
    if (mediaUrl) await check('Media', 'Serve media (public, no auth)', 'GET', mediaUrl.replace('/api', ''), { auth: false, raw: true }, (r) => r.status === 200 && r.buf.length > 0);
  } catch (e) {
    const r1: Result = { group: 'Media', name: 'Upload image', method: 'POST', path: '/uploads', status: 'ERR', ok: false, detail: (e as Error).message };
    results.push(r1);
    logLine(r1);
  }
  await check('Media', 'Reject non-image upload → 400', 'POST', '/uploads', {}, is(400)); // empty body → no files

  // ── Reports ──
  await check('Reports', 'Dashboard', 'GET', '/reports/dashboard', {}, (r) => r.status === 200 && r.body?.data?.salesToday);
  await check('Reports', 'Sales', 'GET', '/reports/sales', {}, ok2xx);
  await check('Reports', 'Inventory', 'GET', '/reports/inventory', {}, ok2xx);
  await check('Reports', 'Financial', 'GET', '/reports/financial', {}, ok2xx);
  await check('Reports', 'Supplier stock (JSON)', 'GET', '/reports/supplier-stock', {}, (r) => r.status === 200 && Array.isArray(r.body?.data?.groups));
  await check('Reports', 'Supplier stock (PDF)', 'GET', '/reports/supplier-stock/pdf', { raw: true }, isPdf);

  // ── Public (no auth) ──
  if (invToken) {
    await check('Public', 'Invoice by token (no auth)', 'GET', `/public/invoices/${invToken}`, { auth: false }, (r) => r.status === 200 && !r.body?.data?._id && !!r.body?.data?.invoiceNumber);
    await check('Public', 'Invoice PDF by token (no auth)', 'GET', `/public/invoices/${invToken}/pdf`, { auth: false, raw: true }, isPdf);
  }
  await check('Public', 'Unknown token -> 404', 'GET', '/public/invoices/not-a-real-token-xyz', { auth: false }, is(404));

  // ── Security / negative ──
  await check('Security', 'Protected route without token -> 401', 'GET', '/products', { auth: false }, is(401));

  // ── Cleanup (also exercises cancel + soft-delete endpoints) ──
  if (invId) await check('Cleanup', 'Cancel invoice (restock)', 'POST', `/invoices/${invId}/cancel`, { body: { reason: 'api-test' } }, ok2xx);
  if (purId) await check('Cleanup', 'Cancel purchase (reverse stock)', 'POST', `/purchases/${purId}/cancel`, {}, ok2xx);
  if (pid && vGreen) await check('Cleanup', 'Delete empty variant', 'DELETE', `/products/${pid}/variants/${vGreen._id}`, {}, ok2xx);
  if (pid) await check('Cleanup', 'Soft-delete product (owner)', 'DELETE', `/products/${pid}`, {}, ok2xx);
  if (supId) await check('Cleanup', 'Soft-delete supplier (owner)', 'DELETE', `/suppliers/${supId}`, {}, ok2xx);
  if (custId) await check('Cleanup', 'Soft-delete customer (owner)', 'DELETE', `/customers/${custId}`, {}, ok2xx);

  await emitReport();

  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\n${failed.length === 0 ? '\x1b[32m' : '\x1b[31m'}=== ${results.length - failed.length}/${results.length} checks passed ===\x1b[0m`);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.log(`Failed: ${failed.map((f) => `${f.group}/${f.name}`).join(', ')}`);
  }
  process.exit(failed.length ? 1 : 0);
}

/* ──────────────────────── PDF report (same format family as shop reports) ──────────────────────── */
async function emitReport() {
  const outPath = path.resolve(process.cwd(), 'api-test-report.pdf');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const now = new Date();
  const ddmmyyyy = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);

    const left = 36;
    const right = doc.page.width - 36;
    const contentWidth = right - left;
    const RED = '#cc0000';
    const GREEN = '#15803d';
    const cols = [
      { key: 'idx', label: '#', w: 22, align: 'left' as const },
      { key: 'group', label: 'Module', w: 70, align: 'left' as const },
      { key: 'name', label: 'Test', w: 150, align: 'left' as const },
      { key: 'method', label: 'Method', w: 44, align: 'left' as const },
      { key: 'path', label: 'Endpoint', w: 148, align: 'left' as const },
      { key: 'status', label: 'Status', w: 38, align: 'right' as const },
      { key: 'result', label: 'Result', w: contentWidth - (22 + 70 + 150 + 44 + 148 + 38), align: 'right' as const },
    ];
    const xOf: Record<string, number> = {};
    let cx = left;
    for (const c of cols) {
      xOf[c.key] = cx;
      cx += c.w;
    }
    const BOTTOM = doc.page.height - 70;
    let y = 0;

    const hr = (yy: number, w = 0.6) => doc.moveTo(left, yy).lineTo(right, yy).lineWidth(w).strokeColor('#333').stroke();
    const header = () => {
      doc.font('Helvetica').fontSize(9).fillColor('#111').text(ddmmyyyy, left, 24, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111').text('MNM FASHION — API TEST REPORT', left, 22, { width: contentWidth, align: 'center', underline: true });
      doc.font('Helvetica').fontSize(8).fillColor('#555').text(`${BASE}   ·   ${now.toLocaleString('en-IN')}   ·   ${passed} passed / ${failed} failed of ${results.length}`, left, 42, { width: contentWidth, align: 'center' });
      const top = 58;
      hr(top);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111');
      for (const c of cols) doc.text(c.label, xOf[c.key] + 2, top + 6, { width: c.w - 4, align: c.align, lineBreak: false });
      hr(top + 20);
      y = top + 25;
    };
    const startPage = (first = false) => {
      if (!first) doc.addPage();
      header();
    };
    startPage(true);

    doc.font('Helvetica').fontSize(8);
    results.forEach((r, i) => {
      const nameH = doc.heightOfString(r.name, { width: cols[2].w - 4 });
      const pathH = doc.heightOfString(r.path, { width: cols[4].w - 4 });
      const rowH = Math.max(nameH, pathH, 10) + 5;
      if (y + rowH > BOTTOM) startPage();
      if (i % 2 === 1) doc.rect(left, y - 1, contentWidth, rowH).fill('#f7f7f7');
      doc.font('Helvetica').fontSize(8).fillColor('#111');
      doc.text(String(i + 1), xOf.idx + 2, y, { width: cols[0].w - 4, lineBreak: false });
      doc.text(r.group, xOf.group + 2, y, { width: cols[1].w - 4, lineBreak: false });
      doc.text(r.name, xOf.name + 2, y, { width: cols[2].w - 4 });
      doc.text(r.method, xOf.method + 2, y, { width: cols[3].w - 4, lineBreak: false });
      doc.fillColor('#444').text(r.path, xOf.path + 2, y, { width: cols[4].w - 4 });
      doc.fillColor('#111').text(String(r.status), xOf.status + 2, y, { width: cols[5].w - 4, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(r.ok ? GREEN : RED).text(r.ok ? 'PASS' : 'FAIL', xOf.result + 2, y, { width: cols[6].w - 4, align: 'right', lineBreak: false });
      y += rowH;
    });

    hr(y + 2, 0.8);
    y += 8;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(failed ? RED : GREEN).text(`${passed} / ${results.length} checks passed${failed ? ` · ${failed} FAILED` : '  (all passed)'}`, left, y, { width: contentWidth, align: 'right' });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#111').text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - 26, { width: contentWidth, align: 'right', lineBreak: false });
    }
    doc.end();
  });

  // eslint-disable-next-line no-console
  console.log(`\n📄 PDF report written to ${outPath}`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('API test run crashed:', err);
  process.exit(1);
});
