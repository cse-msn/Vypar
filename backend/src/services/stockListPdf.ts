import PDFDocument from 'pdfkit';
import type { StockListReport } from './stockList';

const INK = '#111111';
const GREY = '#555555';
const LINE = '#333333';
const ZEBRA = '#f7f5f6';

const n2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n0 = new Intl.NumberFormat('en-IN');
const dec = (v: number) => n2.format(v ?? 0);
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

interface Col {
  key: string;
  label: string;
  w: number;
  align: 'left' | 'right';
}

export function generateStockListPdf(report: StockListReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 30;
    const right = doc.page.width - 30;
    const W = right - left;

    const cols: Col[] = [
      { key: 'sr', label: 'Sr.', w: 24, align: 'left' },
      { key: 'designNumber', label: 'Design No', w: 50, align: 'left' },
      { key: 'designCode', label: 'Design Code', w: 58, align: 'left' },
      { key: 'designName', label: 'Design Name', w: 104, align: 'left' },
      { key: 'cs', label: 'Colour / Size', w: 72, align: 'left' },
      { key: 'itemCode', label: 'Item Code', w: 62, align: 'left' },
      { key: 'stock', label: 'Stock', w: 38, align: 'right' },
      { key: 'mrp', label: 'MRP', w: 52, align: 'right' },
      { key: 'value', label: 'Value', w: 0, align: 'right' }, // takes remaining width
    ];
    cols[cols.length - 1].w = W - cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    const x: Record<string, number> = {};
    const w: Record<string, number> = {};
    let cx = left;
    for (const c of cols) {
      x[c.key] = cx;
      w[c.key] = c.w;
      cx += c.w;
    }
    const bounds = [...cols.map((c) => x[c.key]), right];

    const BOTTOM = doc.page.height - 60;
    let y = 0;

    const hr = (yy: number, lw = 0.6) => doc.moveTo(left, yy).lineTo(right, yy).lineWidth(lw).strokeColor(LINE).stroke();

    const drawHead = () => {
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(ddmmyyyy(report.generatedAt), left, 22, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text('STOCK LIST', left, 20, { width: W, align: 'center', underline: true });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(GREY)
        .text(
          `Designs ${report.totals.designs}     Variants ${report.totals.variants}     Units ${n0.format(report.totals.units)}     Stock value Rs. ${dec(report.totals.value)}`,
          left,
          40,
          { width: W, align: 'center' },
        );
      const top = 56;
      hr(top);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK);
      for (const c of cols) doc.text(c.label, x[c.key] + 3, top + 6, { width: c.w - 6, align: c.align, lineBreak: false });
      hr(top + 20);
      y = top + 20;
    };

    const startPage = (first = false) => {
      if (!first) doc.addPage();
      drawHead();
    };
    startPage(true);

    doc.font('Helvetica').fontSize(8);
    report.rows.forEach((r, i) => {
      const nameH = doc.heightOfString(r.designName, { width: w.designName - 6 });
      const rowH = Math.max(nameH, 11) + 5;
      if (y + rowH > BOTTOM) startPage();

      if (i % 2 === 1) doc.rect(left, y, W, rowH).fill(ZEBRA);
      const out = r.stock <= 0;
      doc.fillColor(INK).font('Helvetica').fontSize(8);
      doc.text(String(i + 1), x.sr + 3, y + 4, { width: w.sr - 6, lineBreak: false });
      doc.text(r.designNumber, x.designNumber + 3, y + 4, { width: w.designNumber - 6, lineBreak: false });
      doc.font('Helvetica-Bold').text(String(r.designCode), x.designCode + 3, y + 4, { width: w.designCode - 6, lineBreak: false });
      doc.font('Helvetica').text(r.designName, x.designName + 3, y + 4, { width: w.designName - 6, ellipsis: true });
      doc.text(`${r.color} / ${r.size}`, x.cs + 3, y + 4, { width: w.cs - 6, lineBreak: false, ellipsis: true });
      doc.text(r.itemCode, x.itemCode + 3, y + 4, { width: w.itemCode - 6, lineBreak: false });
      doc.fillColor(out ? '#cc0000' : INK).text(n0.format(r.stock), x.stock + 3, y + 4, { width: w.stock - 6, align: 'right', lineBreak: false });
      doc.fillColor(INK).text(dec(r.mrp), x.mrp + 3, y + 4, { width: w.mrp - 6, align: 'right', lineBreak: false });
      doc.text(dec(r.value), x.value + 3, y + 4, { width: w.value - 6, align: 'right', lineBreak: false });
      y += rowH;
    });

    // Grand total
    if (y + 24 > BOTTOM) startPage();
    hr(y, 0.8);
    y += 4;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
    doc.text('GRAND TOTAL', x.designName + 3, y + 2, { width: w.designName + w.cs, lineBreak: false });
    doc.text(n0.format(report.totals.units), x.stock + 3, y + 2, { width: w.stock - 6, align: 'right', lineBreak: false });
    doc.text(dec(report.totals.value), x.value + 3, y + 2, { width: w.value - 6, align: 'right', lineBreak: false });

    if (report.rows.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(GREY).text('No products match the selected filters.', left, 90, { width: W, align: 'center' });
    }

    // Column separators + page numbers on each buffered page.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY).text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - 22, { width: W, align: 'right', lineBreak: false });
      for (const bx of bounds) doc.moveTo(bx, 76).lineTo(bx, doc.page.height - 30).lineWidth(0.4).strokeColor('#dddddd').stroke();
    }

    doc.end();
  });
}
