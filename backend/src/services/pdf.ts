import PDFDocument from 'pdfkit';
import { env } from '../config/env';
import { rupeesInWords } from '../utils/numberToWords';
import type { ShopProfileShape } from './shopProfile';

export interface InvoicePdfItem {
  designNumber: string;
  productName: string;
  category?: string;
  color: string;
  size: string;
  sku?: string;
  hsnCode?: string;
  quantity: number;
  rate: number; // unit list price
  discountPercent: number; // per-line discount %
  amount: number; // line amount after per-line discount
}

export interface InvoicePdfData {
  invoiceNumber: string;
  date: Date;
  buyer: { name: string; phone?: string; address?: string; gstin?: string };
  items: InvoicePdfItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  totalQty: number;
  amountPaid: number;
  balance: number;
  paymentMethod: string;
  paymentStatus: string;
  /** Seller/shop details; falls back to config defaults when omitted. */
  shop?: ShopProfileShape;
}

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => inr.format(n ?? 0);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : String(n));
const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank: 'Bank',
  credit: 'Credit (pay later)',
  other: 'Other',
};
const methodLabel = (m: string) => PAYMENT_METHOD_LABELS[m] ?? m.toUpperCase();

const DARK = '#111111';
const GREY = '#555555';
const LINE = '#333333';

/** Render a GST-style TAX INVOICE matching the shop's existing bill format. */
export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 24, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const s = data.shop ?? env.shop;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = 24;
    const right = pageW - 24;
    const W = right - left;

    const line = (x1: number, y1: number, x2: number, y2: number, w = 0.7, color = LINE) =>
      doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(w).strokeColor(color).stroke();
    const hr = (y: number, w = 0.7) => line(left, y, right, y, w);

    // Table columns.
    const widths = { sr: 26, desc: 220, hsn: 40, gst: 34, qty: 32, rate: 56, per: 28, disc: 38, amt: 0 };
    widths.amt = W - (widths.sr + widths.desc + widths.hsn + widths.gst + widths.qty + widths.rate + widths.per + widths.disc);
    const colX: Record<string, number> = {};
    let cx = left;
    (['sr', 'desc', 'hsn', 'gst', 'qty', 'rate', 'per', 'disc', 'amt'] as const).forEach((k) => {
      colX[k] = cx;
      cx += widths[k];
    });
    const bounds = [left, colX.desc, colX.hsn, colX.gst, colX.qty, colX.rate, colX.per, colX.disc, colX.amt, right];

    let y = 0;

    const drawTitle = () => {
      doc.font('Helvetica').fontSize(11).fillColor(DARK).text('TAX INVOICE', left, 14, { width: W, align: 'center' });
    };

    // ── Seller / Buyer / meta header ──
    const drawHeader = () => {
      const top = 30;
      const splitX = left + Math.round(W * 0.63);
      const sellerH = 86;
      const buyerH = 74;
      const boxH = sellerH + buyerH;

      // outer box + middle split
      doc.rect(left, top, W, boxH).lineWidth(0.7).strokeColor(LINE).stroke();
      line(splitX, top, splitX, top + boxH);
      line(left, top + sellerH, splitX, top + sellerH); // seller/buyer divider (left side only)

      // Seller
      let sy = top + 5;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(`Seller :  ${s.name}`, left + 5, sy, { width: splitX - left - 10 });
      sy += 14;
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY);
      if (s.address) { doc.text(s.address, left + 5, sy, { width: splitX - left - 10 }); sy += doc.heightOfString(s.address, { width: splitX - left - 10 }) + 1; }
      if (s.gstin) { doc.text(`GSTIN/UIN : ${s.gstin}`, left + 5, sy); sy += 10; }
      if (s.phone) { doc.text(`Contact : ${s.phone}`, left + 5, sy); sy += 10; }
      if (s.state) doc.text(`State Name : ${s.state}   State Code : ${s.stateCode}`, left + 5, sy);

      // Buyer
      let by = top + sellerH + 4;
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY).text('Buyer :', left + 5, by);
      by += 10;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK).text(data.buyer.name || 'Walk-in Customer', left + 5, by, { width: splitX - left - 10 });
      by += 13;
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY);
      if (data.buyer.address) { doc.text(data.buyer.address, left + 5, by, { width: splitX - left - 10 }); by += doc.heightOfString(data.buyer.address, { width: splitX - left - 10 }) + 1; }
      doc.text(`GSTIN/UIN : ${data.buyer.gstin || ''}`, left + 5, by);
      by += 10;
      if (data.buyer.phone) doc.text(`Contact : ${data.buyer.phone}`, left + 5, by);

      // Meta grid (right)
      const mx = splitX;
      const mw = right - splitX;
      const half = mw / 2;
      const rowsH = boxH / 4;
      for (let i = 1; i < 4; i++) line(mx, top + rowsH * i, right, top + rowsH * i);
      line(mx + half, top, mx + half, top + rowsH * 3);
      const cell = (cxx: number, cyy: number, label: string, value: string) => {
        doc.font('Helvetica').fontSize(6.5).fillColor(GREY).text(label, cxx + 4, cyy + 3, { width: half - 8, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(value, cxx + 4, cyy + 12, { width: half - 8, lineBreak: false });
      };
      cell(mx, top, 'Invoice No.', data.invoiceNumber);
      cell(mx + half, top, 'Dated', ddmmyyyy(data.date));
      cell(mx, top + rowsH, 'Payment Mode', methodLabel(data.paymentMethod));
      cell(mx + half, top + rowsH, 'Status', data.paymentStatus.toUpperCase());
      cell(mx, top + rowsH * 2, 'Amount Paid', money(data.amountPaid));
      cell(mx + half, top + rowsH * 2, 'Balance', money(data.balance));
      doc.font('Helvetica').fontSize(6.5).fillColor(GREY).text('Terms Of Delivery', mx + 4, top + rowsH * 3 + 3);

      y = top + boxH;
    };

    const drawColHeader = () => {
      const h = 22;
      doc.rect(left, y, W, h).lineWidth(0.7).strokeColor(LINE).stroke();
      bounds.forEach((bx) => line(bx, y, bx, y + h));
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(DARK);
      const put = (k: string, label: string, align: 'left' | 'center' | 'right' = 'center') =>
        doc.text(label, colX[k] + 3, y + 7, { width: widths[k as keyof typeof widths] - 6, align, lineBreak: false });
      put('sr', 'Sr.', 'center');
      doc.text('Description Of Goods', colX.desc + 4, y + 7, { width: widths.desc - 8, align: 'left', lineBreak: false });
      put('hsn', 'HSN', 'center');
      put('gst', 'GST%', 'center');
      put('qty', 'Qty', 'center');
      put('rate', 'Rate', 'right');
      put('per', 'Per', 'center');
      put('disc', 'Disc%', 'right');
      put('amt', 'Amount', 'right');
      y += h;
    };

    const ROWS_BOTTOM = pageH - 30;

    const drawRow = (it: InvoicePdfItem, idx: number) => {
      const parts = [it.designNumber, it.productName, it.category, it.size, it.color, it.sku].filter(Boolean).join('-');
      doc.font('Helvetica').fontSize(7.5);
      const descH = doc.heightOfString(parts, { width: widths.desc - 8 });
      const rowH = Math.max(descH + 6, 20);

      if (y + rowH > ROWS_BOTTOM) {
        doc.addPage();
        drawTitle();
        y = 30;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(`${s.name} — Invoice ${data.invoiceNumber} (contd.)`, left, y);
        y += 16;
        drawColHeader();
      }

      // borders
      bounds.forEach((bx) => line(bx, y, bx, y + rowH));
      line(left, y + rowH, right, y + rowH);

      doc.fillColor(DARK).font('Helvetica').fontSize(7.5);
      doc.text(String(idx + 1), colX.sr + 2, y + 4, { width: widths.sr - 4, align: 'center', lineBreak: false });
      // description — design number in bold, rest normal
      doc.font('Helvetica-Bold').text(it.designNumber, colX.desc + 4, y + 4, { continued: true });
      doc.font('Helvetica').text(`-${[it.productName, it.category, it.size, it.color, it.sku].filter(Boolean).join('-')}`, { width: widths.desc - 8 });
      doc.font('Helvetica').fontSize(7.5).fillColor(DARK);
      doc.text(it.hsnCode || s.defaultHsn || '', colX.hsn + 2, y + 4, { width: widths.hsn - 4, align: 'center', lineBreak: false });
      doc.text(`${data.taxPercent}%`, colX.gst + 2, y + 4, { width: widths.gst - 4, align: 'center', lineBreak: false });
      doc.text(qty(it.quantity), colX.qty + 2, y + 4, { width: widths.qty - 4, align: 'center', lineBreak: false });
      doc.text(money(it.rate), colX.rate + 2, y + 4, { width: widths.rate - 5, align: 'right', lineBreak: false });
      doc.text('Pcs', colX.per + 2, y + 4, { width: widths.per - 4, align: 'center', lineBreak: false });
      doc.text(it.discountPercent ? it.discountPercent.toFixed(2) : '0.00', colX.disc + 2, y + 4, { width: widths.disc - 5, align: 'right', lineBreak: false });
      doc.text(money(it.amount), colX.amt + 2, y + 4, { width: widths.amt - 5, align: 'right', lineBreak: false });
      y += rowH;
    };

    const drawTotals = () => {
      const needed = 232;
      if (y + needed > pageH - 24) {
        doc.addPage();
        drawTitle();
        y = 30;
      }

      const splitX = left + Math.round(W * 0.63);

      // Amount in words strip
      const wordsH = 16;
      doc.rect(left, y, W, wordsH).lineWidth(0.7).strokeColor(LINE).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(DARK).text(rupeesInWords(data.total), left + 5, y + 4, { width: splitX - left - 10, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(8).text(`Total Qty : ${data.totalQty}`, splitX + 5, y + 4, { width: right - splitX - 10, align: 'right', lineBreak: false });
      y += wordsH;

      // Left (declaration + bank) | Right (totals)
      const blockH = 92;
      doc.rect(left, y, W, blockH).lineWidth(0.7).strokeColor(LINE).stroke();
      line(splitX, y, splitX, y + blockH);

      // left
      doc.font('Helvetica').fontSize(7).fillColor(GREY).text('Declaration : We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', left + 5, y + 5, { width: splitX - left - 10 });
      let ly = y + 32;
      if (s.bank.name || s.bank.account) {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(DARK).text("Company's Bank Detail :", left + 5, ly);
        ly += 11;
        doc.font('Helvetica').fontSize(7).fillColor(GREY);
        if (s.bank.name) { doc.text(`Bank Name : ${s.bank.name}`, left + 5, ly); ly += 9; }
        if (s.bank.account) { doc.text(`A/c No. : ${s.bank.account}`, left + 5, ly); ly += 9; }
        if (s.bank.ifsc) { doc.text(`IFSC Code : ${s.bank.ifsc}`, left + 5, ly); ly += 9; }
      }

      // right — totals rows
      const tx = splitX;
      const tw = right - splitX;
      const labelW = tw * 0.58;
      let ty = y + 5;
      const trow = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 9.5 : 8).fillColor(bold ? DARK : GREY);
        doc.text(label, tx + 5, ty, { width: labelW - 10, align: 'right', lineBreak: false });
        doc.fillColor(DARK).font(bold ? 'Helvetica-Bold' : 'Helvetica').text(value, tx + labelW, ty, { width: tw - labelW - 5, align: 'right', lineBreak: false });
        ty += bold ? 15 : 12;
      };
      trow('Sub Total', money(data.subtotal));
      if (data.discountAmount > 0) trow(`Discount (${data.discountPercent || ((data.discountAmount / (data.subtotal || 1)) * 100).toFixed(2)}%)`, `- ${money(data.discountAmount)}`);
      if (data.cgst > 0) trow('CGST', money(data.cgst));
      if (data.sgst > 0) trow('SGST', money(data.sgst));
      if (data.roundOff) trow('Round Off', money(data.roundOff));
      line(tx, ty + 1, right, ty + 1);
      ty += 4;
      trow('Grand Total', money(data.total), true);
      y += blockH;

      // GST summary strip
      const gstH = 26;
      doc.rect(left, y, W, gstH).lineWidth(0.7).strokeColor(LINE).stroke();
      const gcols = ['GST%', 'Taxable', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'Total GST'];
      const gcw = W / gcols.length;
      doc.font('Helvetica').fontSize(6.5).fillColor(GREY);
      gcols.forEach((c, i) => doc.text(c, left + gcw * i, y + 3, { width: gcw, align: 'center', lineBreak: false }));
      const taxable = data.subtotal - data.discountAmount;
      const gvals = [`${data.taxPercent}`, money(taxable), (data.taxPercent / 2).toFixed(1), money(data.cgst), (data.taxPercent / 2).toFixed(1), money(data.sgst), money(data.taxAmount)];
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(DARK);
      gvals.forEach((v, i) => doc.text(v, left + gcw * i, y + 14, { width: gcw, align: 'center', lineBreak: false }));
      y += gstH;

      // Terms + signatures
      const sigH = 58;
      doc.rect(left, y, W, sigH).lineWidth(0.7).strokeColor(LINE).stroke();
      line(splitX, y, splitX, y + sigH);
      doc.font('Helvetica').fontSize(6.5).fillColor(GREY).text(
        '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.\n3. This is a computer-generated invoice.',
        left + 5,
        y + 5,
        { width: splitX - left - 10 },
      );
      doc.font('Helvetica').fontSize(8).fillColor(DARK).text(`For ${s.name}`, splitX + 5, y + 6, { width: right - splitX - 10, align: 'right' });
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY).text('Authorised Signatory', splitX + 5, y + sigH - 14, { width: right - splitX - 10, align: 'right' });
      doc.text("Receiver's Signature", left + 5, y + sigH - 14);
      y += sigH;
    };

    // ── Render ──
    drawTitle();
    drawHeader();
    drawColHeader();
    data.items.forEach((it, i) => drawRow(it, i));
    drawTotals();

    // Page numbers
    const range = doc.bufferedPageRange();
    if (range.count > 1) {
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7).fillColor(GREY).text(`Page ${i + 1} of ${range.count}`, left, pageH - 18, { width: W, align: 'right', lineBreak: false });
      }
    }

    doc.end();
  });
}
