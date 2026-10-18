import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

export interface LabelItem {
  designNumber: string;
  shopName: string;
  itemCode: string; // numeric, becomes the Code-128 barcode
  color: string;
  designName: string;
  size: string;
  priceCode: string;
}

export interface LabelOptions {
  /** 'sheet' → A4, 12 labels/page. 'roll' → one label/page at the physical size below. */
  format?: 'sheet' | 'roll';
  /** Roll label physical size in millimetres (default 50 × 25). */
  widthMm?: number;
  heightMm?: number;
}

const INK = '#111111';
const BORDER = '#bbbbbb';
const MM = 2.834645669; // points per millimetre

async function barcodePng(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 9,
    includetext: false,
    paddingwidth: 2,
    paddingheight: 0,
    backgroundcolor: 'FFFFFF',
  });
}

export async function generateLabelsPdf(items: LabelItem[], opts: LabelOptions = {}): Promise<Buffer> {
  // Pre-render each unique barcode once (labels often repeat for multiple copies).
  const cache = new Map<string, Buffer>();
  for (const it of items) {
    if (!cache.has(it.itemCode)) cache.set(it.itemCode, await barcodePng(it.itemCode));
  }

  return opts.format === 'roll'
    ? renderRoll(items, cache, opts.widthMm ?? 50, opts.heightMm ?? 25)
    : renderSheet(items, cache);
}

/* ───────────────── A4 sheet: 2 × 6 = 12 tags per page ───────────────── */
function renderSheet(items: LabelItem[], cache: Map<string, Buffer>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 28 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 28;
    const cols = 2;
    const rows = 6;
    const perPage = cols * rows;
    const gutterX = 14;
    const gutterY = 12;
    const labelW = (doc.page.width - margin * 2 - gutterX * (cols - 1)) / cols;
    const labelH = 120;

    items.forEach((it, i) => {
      const idx = i % perPage;
      if (i > 0 && idx === 0) doc.addPage();
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = margin + col * (labelW + gutterX);
      const y = margin + row * (labelH + gutterY);

      const p = 7;
      const right = x + labelW - p;
      doc.roundedRect(x + 1, y + 1, labelW - 2, labelH - 2, 6).lineWidth(0.6).strokeColor(BORDER).stroke();
      doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(it.designNumber, x + p, y + p, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(it.shopName, x + labelW / 2, y + p + 3, { width: labelW / 2 - p, align: 'right', lineBreak: false });
      const barY = y + p + 20;
      const barH = 30;
      doc.image(cache.get(it.itemCode)!, x + p, barY, { width: labelW - p * 2, height: barH });
      const row1 = barY + barH + 2;
      doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(it.itemCode, x + p, row1, { lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(it.color, x + labelW / 2, row1, { width: labelW / 2 - p, align: 'right', lineBreak: false });
      const row2 = row1 + 13;
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(it.designName, x + p, row2 + 3, { width: labelW * 0.62, lineBreak: false, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(it.size, right - 60, row2, { width: 60, align: 'right', lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(it.priceCode, x + p, y + labelH - 13, { width: labelW - p * 2, align: 'center', lineBreak: false });
    });

    doc.end();
  });
}

/* ───────────────── Roll/label printer: one tag per page at exact size ───────────────── */
function renderRoll(items: LabelItem[], cache: Map<string, Buffer>, widthMm: number, heightMm: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const w = widthMm * MM;
    const h = heightMm * MM;
    const pageOpts = { size: [w, h] as [number, number], margin: 0 };
    const doc = new PDFDocument(pageOpts);
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    items.forEach((it, i) => {
      if (i > 0) doc.addPage(pageOpts);
      const p = 3;
      const right = w - p;

      // Design number (left) · shop name (right, small)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(it.designNumber, p, p, { lineBreak: false });
      doc.font('Helvetica').fontSize(5.5).fillColor(INK).text(it.shopName, w / 2, p + 2, { width: w / 2 - p, align: 'right', lineBreak: false });

      // Barcode (full width)
      const barY = p + 11;
      const barH = 19;
      doc.image(cache.get(it.itemCode)!, p, barY, { width: w - p * 2, height: barH });

      // Item code (left) · colour (right)
      const r1 = barY + barH + 1;
      doc.font('Helvetica').fontSize(5.5).fillColor(INK).text(it.itemCode, p, r1, { lineBreak: false });
      doc.font('Helvetica').fontSize(6).fillColor(INK).text(it.color, w / 2, r1, { width: w / 2 - p, align: 'right', lineBreak: false });

      // Design name (left) · size (right, large)
      const r2 = r1 + 8;
      doc.font('Helvetica').fontSize(6).fillColor(INK).text(it.designName, p, r2 + 3, { width: w * 0.6, lineBreak: false, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(it.size, right - 34, r2, { width: 34, align: 'right', lineBreak: false });

      // Coded price (centered, bottom)
      doc.font('Helvetica').fontSize(6).fillColor(INK).text(it.priceCode, p, h - 9, { width: w - p * 2, align: 'center', lineBreak: false });
    });

    doc.end();
  });
}
