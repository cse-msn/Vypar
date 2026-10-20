import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { asyncHandler } from '../utils/asyncHandler';
import { validateQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { Invoice } from '../models/Invoice';
import { Product } from '../models/Product';
import { Purchase } from '../models/Purchase';
import { Payment } from '../models/Payment';
import { Customer } from '../models/Customer';
import { Supplier } from '../models/Supplier';
import { round2 } from '../utils/money';
import { buildSupplierStockReport } from '../services/supplierStock';
import { generateSupplierStockPdf } from '../services/supplierStockPdf';
import { buildStockListReport } from '../services/stockList';
import { generateStockListPdf } from '../services/stockListPdf';

const router = Router();
router.use(requireAuth);

const supplierStockQuery = z.object({
  supplier: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const dateRange = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Home dashboard summary. */
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const startToday = dayjs().startOf('day').toDate();
    const startMonth = dayjs().startOf('month').toDate();

    const [todayAgg, monthAgg, outstandingAgg, lowStock, recent, productCount, customerCount] =
      await Promise.all([
        Invoice.aggregate([
          { $match: { status: 'confirmed', date: { $gte: startToday } } },
          { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
          { $match: { status: 'confirmed', date: { $gte: startMonth } } },
          { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
          { $match: { status: 'confirmed' } },
          { $group: { _id: null, total: { $sum: '$balance' } } },
        ]),
        Product.aggregate([
          { $match: { active: true } },
          { $unwind: '$variants' },
          { $match: { $expr: { $lte: ['$variants.quantity', '$variants.lowStockThreshold'] } } },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              designNumber: 1,
              name: 1,
              color: '$variants.color',
              size: '$variants.size',
              quantity: '$variants.quantity',
              threshold: '$variants.lowStockThreshold',
            },
          },
          { $sort: { quantity: 1 } },
          { $limit: 20 },
        ]),
        Invoice.find({ status: 'confirmed' }).sort({ date: -1 }).limit(8).select('invoiceNumber customerSnapshot total balance paymentStatus date'),
        Product.countDocuments({ active: true }),
        Customer.countDocuments({ active: true }),
      ]);

    res.json({
      data: {
        salesToday: { total: round2(todayAgg[0]?.total ?? 0), count: todayAgg[0]?.count ?? 0 },
        salesMonth: { total: round2(monthAgg[0]?.total ?? 0), count: monthAgg[0]?.count ?? 0 },
        outstandingReceivable: round2(outstandingAgg[0]?.total ?? 0),
        productCount,
        customerCount,
        lowStockCount: lowStock.length,
        lowStock,
        recentInvoices: recent,
      },
    });
  }),
);

/** Sales report: totals, daily trend, and top-selling products. */
router.get(
  '/sales',
  validateQuery(dateRange),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as z.infer<typeof dateRange>;
    const match: Record<string, unknown> = { status: 'confirmed' };
    if (from || to) match.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

    const [summary, daily, topProducts, byMethod] = await Promise.all([
      Invoice.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$total' },
            totalCollected: { $sum: '$amountPaid' },
            totalOutstanding: { $sum: '$balance' },
            invoiceCount: { $sum: 1 },
            unitsSold: { $sum: { $sum: '$items.quantity' } },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Invoice.aggregate([
        { $match: match },
        { $unwind: '$items' },
        {
          $group: {
            _id: { designNumber: '$items.designNumber', productName: '$items.productName' },
            quantity: { $sum: '$items.quantity' },
            amount: { $sum: '$items.amount' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            designNumber: '$_id.designNumber',
            productName: '$_id.productName',
            quantity: 1,
            amount: { $round: ['$amount', 2] },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentMethod',
            total: { $sum: '$total' },
            collected: { $sum: '$amountPaid' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const s = summary[0] ?? {};
    res.json({
      data: {
        summary: {
          totalSales: round2(s.totalSales ?? 0),
          totalCollected: round2(s.totalCollected ?? 0),
          totalOutstanding: round2(s.totalOutstanding ?? 0),
          invoiceCount: s.invoiceCount ?? 0,
          unitsSold: s.unitsSold ?? 0,
        },
        daily: daily.map((d) => ({ date: d._id, total: round2(d.total), count: d.count })),
        topProducts,
        byMethod: byMethod.map((m) => ({
          method: m._id ?? 'other',
          total: round2(m.total),
          collected: round2(m.collected),
          count: m.count,
        })),
      },
    });
  }),
);

/** Inventory valuation + low/out-of-stock. */
router.get(
  '/inventory',
  asyncHandler(async (_req, res) => {
    const [valuation, lowStock, byCategory] = await Promise.all([
      Product.aggregate([
        { $match: { active: true } },
        { $unwind: '$variants' },
        {
          $group: {
            _id: null,
            totalUnits: { $sum: '$variants.quantity' },
            variantCount: { $sum: 1 },
            costValue: {
              $sum: { $multiply: ['$variants.quantity', { $ifNull: ['$variants.costPrice', '$costPrice'] }] },
            },
            retailValue: {
              $sum: { $multiply: ['$variants.quantity', { $ifNull: ['$variants.sellingPrice', '$sellingPrice'] }] },
            },
            outOfStock: { $sum: { $cond: [{ $eq: ['$variants.quantity', 0] }, 1, 0] } },
          },
        },
      ]),
      Product.aggregate([
        { $match: { active: true } },
        { $unwind: '$variants' },
        { $match: { $expr: { $lte: ['$variants.quantity', '$variants.lowStockThreshold'] } } },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            designNumber: 1,
            name: 1,
            color: '$variants.color',
            size: '$variants.size',
            sku: '$variants.sku',
            quantity: '$variants.quantity',
            threshold: '$variants.lowStockThreshold',
          },
        },
        { $sort: { quantity: 1 } },
      ]),
      Product.aggregate([
        { $match: { active: true } },
        { $unwind: '$variants' },
        {
          $group: {
            _id: { $ifNull: ['$category', 'Uncategorised'] },
            units: { $sum: '$variants.quantity' },
            costValue: {
              $sum: { $multiply: ['$variants.quantity', { $ifNull: ['$variants.costPrice', '$costPrice'] }] },
            },
          },
        },
        { $sort: { units: -1 } },
      ]),
    ]);

    const v = valuation[0] ?? {};
    res.json({
      data: {
        summary: {
          totalUnits: v.totalUnits ?? 0,
          variantCount: v.variantCount ?? 0,
          costValue: round2(v.costValue ?? 0),
          retailValue: round2(v.retailValue ?? 0),
          outOfStock: v.outOfStock ?? 0,
          lowStockCount: lowStock.length,
        },
        lowStock,
        byCategory: byCategory.map((c) => ({ category: c._id, units: c.units, costValue: round2(c.costValue) })),
      },
    });
  }),
);

/** Financial snapshot: period sales/purchases/receipts + current receivables/payables. */
router.get(
  '/financial',
  validateQuery(dateRange),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as z.infer<typeof dateRange>;
    const range = from || to ? { ...(from && { $gte: from }), ...(to && { $lte: to }) } : undefined;

    const [salesAgg, purchaseAgg, paymentAgg, receivableAgg, payableAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: { status: 'confirmed', ...(range && { date: range }) } },
        { $group: { _id: null, total: { $sum: '$total' }, collected: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { status: 'received', ...(range && { date: range }) } },
        { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { ...(range && { date: range }) } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Supplier.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
    ]);

    res.json({
      data: {
        periodSales: round2(salesAgg[0]?.total ?? 0),
        periodSalesCollected: round2(salesAgg[0]?.collected ?? 0),
        periodSalesCount: salesAgg[0]?.count ?? 0,
        periodPurchases: round2(purchaseAgg[0]?.total ?? 0),
        periodPurchasesPaid: round2(purchaseAgg[0]?.paid ?? 0),
        periodPurchaseCount: purchaseAgg[0]?.count ?? 0,
        periodPaymentsReceived: round2(paymentAgg[0]?.total ?? 0),
        outstandingReceivable: round2(receivableAgg[0]?.total ?? 0),
        outstandingPayable: round2(payableAgg[0]?.total ?? 0),
      },
    });
  }),
);

/** Supplier-wise stock report — JSON (for on-screen summary / preview). */
router.get(
  '/supplier-stock',
  validateQuery(supplierStockQuery),
  asyncHandler(async (req, res) => {
    const { supplier, from, to } = req.query as unknown as z.infer<typeof supplierStockQuery>;
    const report = await buildSupplierStockReport({ supplierId: supplier, from, to });
    res.json({ data: report });
  }),
);

/** Supplier-wise stock report — PDF (formatted like the shop's existing report). */
router.get(
  '/supplier-stock/pdf',
  validateQuery(supplierStockQuery),
  asyncHandler(async (req, res) => {
    const { supplier, from, to } = req.query as unknown as z.infer<typeof supplierStockQuery>;
    const report = await buildSupplierStockReport({ supplierId: supplier, from, to });
    const buffer = await generateSupplierStockPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    const disposition = req.query.download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="supplier-wise-stock.pdf"`);
    res.send(buffer);
  }),
);

const stockListQuery = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  includeOutOfStock: z.coerce.boolean().optional(),
});

/** Design-wise stock list — JSON. */
router.get(
  '/stock-list',
  validateQuery(stockListQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof stockListQuery>;
    res.json({ data: await buildStockListReport(q) });
  }),
);

/** Design-wise stock list — PDF (Sr, Design No, Design Code, Design Name, Colour/Size, Item Code, Stock, MRP, Value). */
router.get(
  '/stock-list/pdf',
  validateQuery(stockListQuery),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof stockListQuery>;
    const pdf = await generateStockListPdf(await buildStockListReport(q));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="stock-list.pdf"`);
    res.send(pdf);
  }),
);

export default router;
