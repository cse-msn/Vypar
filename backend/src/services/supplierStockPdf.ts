import PDFDocument from 'pdfkit';
import type { SupplierStockReport, SupplierStockGroup } from './supplierStock';

const COLORS = {
  black: '#111111',
  blue: '#0b3d91',
  red: '#cc0000',
  line: '#333333',
  faint: '#999999',
};

const n2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec = (v: number) => n2.format(v ?? 0);
const int = (v: number) => String(Math.round(v ?? 0));
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

interface Col {
  key: string;
  label: string;
  x: number;
  w: number;
  align: 'left' | 'right';
}

/**
 * Render the Supplier Wise Stock Report as a PDF, laid out to match the shop's
 * existing software: title + date header, grouped purchase batches, per-item rows,
 * red subtotals, blue dates, and page numbers.
 */
export function generateSupplierStockPdf(report: SupplierStockReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 36;
    const right = doc.page.width - 36; // 559.28
    const contentWidth = right - left;

    // Column geometry (sums to contentWidth).
    const widths = {
      name: 140,
      itemCode: 66,
      purQty: 44,
      purRate: 48,
      pAmount: 56,
      stockQty: 46,
      diff: 28,
      mrp: 42,
      stockAmt: contentWidth - (140 + 66 + 44 + 48 + 56 + 46 + 28 + 42),
    };
    const cols: Col[] = [];
    let cx = left;
    const push = (key: keyof typeof widths, label: string, align: 'left' | 'right') => {
      cols.push({ key, label, x: cx, w: widths[key], align });
      cx += widths[key];
    };
    push('name', 'Supplier And Product Name', 'left');
    push('itemCode', 'Item Code', 'left');
    push('purQty', 'Pur. Qty.', 'right');
    push('purRate', 'Pur. Rate', 'right');
    push('pAmount', 'P. Amount', 'right');
    push('stockQty', 'Stock Qty', 'right');
    push('diff', 'Diff.', 'right');
    push('mrp', 'MRP', 'right');
    push('stockAmt', 'Stock Amt.', 'right');
    const byKey = Object.fromEntries(cols.map((c) => [c.key, c])) as Record<string, Col>;

    // Leave generous room so a tall (wrapped) row can never cross pdfkit's auto-paginate line.
    const BOTTOM = doc.page.height - 70;
    let y = 0;

    const cell = (
      col: Col,
      text: string,
      opts: { color?: string; bold?: boolean; size?: number; wrap?: boolean; yy?: number } = {},
    ) => {
      doc
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.size ?? 8)
        .fillColor(opts.color ?? COLORS.black)
        .text(text, col.x + 2, opts.yy ?? y, {
          width: col.w - 4,
          align: col.align,
          lineBreak: opts.wrap ?? false,
        });
    };

    const hr = (yy: number, color = COLORS.line, width = 0.6) => {
      doc.moveTo(left, yy).lineTo(right, yy).lineWidth(width).strokeColor(color).stroke();
    };

    const drawPageFurniture = () => {
      // Report date (top-left) + centered underlined title.
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.black).text(ddmmyyyy(report.generatedAt), left, 24, { lineBreak: false });
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(COLORS.black)
        .text('SUPPLIER WISE STOCK REPORT', left, 22, { width: contentWidth, align: 'center', underline: true });

      // Column header band.
      const headTop = 48;
      hr(headTop);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.black);
      for (const c of cols) doc.text(c.label, c.x + 2, headTop + 6, { width: c.w - 4, align: c.align, lineBreak: false });
      hr(headTop + 20);
      y = headTop + 26;
    };

    const startPage = (first = false) => {
      if (!first) doc.addPage();
      drawPageFurniture();
    };

    const ensure = (h: number) => {
      if (y + h > BOTTOM) startPage();
    };

    const drawGroupHeader = (g: SupplierStockGroup) => {
      ensure(30);
      y += 8; // gap above each group
      cell(byKey.name, g.supplier, { bold: true, color: COLORS.black });
      cell(byKey.itemCode, ddmmyyyy(g.date), { color: COLORS.blue });
      cell(byKey.purRate, g.lot, { color: COLORS.red });
      cell(byKey.pAmount, String(g.year), { color: COLORS.red });
      cell(byKey.mrp, 'P', { color: COLORS.red });
      y += 16;
    };

    const drawItem = (line: SupplierStockGroup['lines'][number]) => {
      doc.font('Helvetica').fontSize(8);
      const nameH = doc.heightOfString(line.name, { width: byKey.name.w - 4 });
      const codeH = doc.heightOfString(line.itemCode, { width: byKey.itemCode.w - 4 });
      const rowH = Math.max(nameH, codeH, 10) + 5;
      ensure(rowH);
      const stockColor = line.sold ? COLORS.red : COLORS.black;
      cell(byKey.name, line.name, { wrap: true });
      cell(byKey.itemCode, line.itemCode, { wrap: true });
      cell(byKey.purQty, dec(line.purQty));
      cell(byKey.purRate, dec(line.purRate));
      cell(byKey.pAmount, dec(line.pAmount));
      cell(byKey.stockQty, dec(line.stockQty), { color: stockColor });
      cell(byKey.diff, int(line.diff), { color: line.diff !== 0 ? COLORS.red : COLORS.black });
      cell(byKey.mrp, dec(line.mrp));
      cell(byKey.stockAmt, dec(line.stockAmt));
      y += rowH;
    };

    const drawSubtotal = (t: SupplierStockGroup['totals']) => {
      ensure(24);
      y += 2;
      cell(byKey.purQty, dec(t.purQty), { color: COLORS.red, bold: true });
      cell(byKey.pAmount, dec(t.pAmount), { color: COLORS.red, bold: true });
      cell(byKey.stockQty, dec(t.stockQty), { color: COLORS.red, bold: true });
      cell(byKey.diff, int(t.diff), { color: COLORS.red, bold: true });
      cell(byKey.stockAmt, dec(t.stockAmt), { color: COLORS.red, bold: true });
      y += 16;
      hr(y, COLORS.line, 0.8);
      y += 4;
    };

    // ── Render ──
    startPage(true);

    if (report.groups.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(COLORS.faint).text('No purchase records match the selected filters.', left, y + 20, {
        width: contentWidth,
        align: 'center',
      });
    } else {
      for (const g of report.groups) {
        drawGroupHeader(g);
        for (const line of g.lines) drawItem(line);
        drawSubtotal(g.totals);
      }

      // Grand total
      ensure(30);
      y += 6;
      cell(byKey.name, 'GRAND TOTAL', { bold: true });
      cell(byKey.purQty, dec(report.grand.purQty), { bold: true });
      cell(byKey.pAmount, dec(report.grand.pAmount), { bold: true });
      cell(byKey.stockQty, dec(report.grand.stockQty), { bold: true });
      cell(byKey.diff, int(report.grand.diff), { bold: true });
      cell(byKey.stockAmt, dec(report.grand.stockAmt), { bold: true });
    }

    // Page numbers — drawn after all content via buffered pages. Temporarily zero the
    // bottom margin so writing near the page foot doesn't trigger auto-pagination.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.black)
        .text(String(i + 1), left, doc.page.height - 26, { width: contentWidth, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}
