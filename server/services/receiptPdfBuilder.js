'use strict';

const fs = require('fs');
const PDFDocument = require('pdfkit');

const MM_TO_PT = 72 / 25.4;

const PRINT_PROFILES = {
  '58mm': { widthMm: 58, fontSize: 7.5, lineH: 10, margin: 6, thermal: true },
  '80mm': { widthMm: 80, fontSize: 9, lineH: 12, margin: 8, thermal: true },
  A4: { widthMm: 210, fontSize: 10, lineH: 14, margin: 40, thermal: false },
};

function mmToPt(mm) {
  return mm * MM_TO_PT;
}

function money(symbol, n) {
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}

function normalizeOrder(order) {
  const items = (order.items || []).map((line) => {
    const mi = line.menuItem || line;
    return {
      name: mi.name || line.item_name || 'Item',
      qty: Number(line.quantity) || 1,
      price: Number(mi.price ?? line.item_price ?? 0),
      notes: line.notes || '',
    };
  });
  return { ...order, items };
}

function estimateThermalHeight(profile, order) {
  const base = 180;
  const perItem = 22;
  const perNote = 10;
  let h = base + order.items.length * perItem;
  order.items.forEach((i) => {
    if (i.notes) h += perNote;
  });
  if (order.amountReceived !== undefined) h += 40;
  return Math.min(Math.max(h, 280), 1600);
}

function drawDashed(doc, profile) {
  const y = doc.y;
  const x1 = profile.margin;
  const x2 = doc.page.width - profile.margin;
  doc
    .moveTo(x1, y)
    .lineTo(x2, y)
    .dash(2, { space: 2 })
    .strokeColor('#333')
    .stroke()
    .undash();
  doc.moveDown(0.4);
}

function drawRow(doc, profile, left, right, bold = false) {
  const y = doc.y;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(profile.fontSize);
  doc.text(left, profile.margin, y, {
    width: doc.page.width - profile.margin * 2 - 70,
    align: 'left',
  });
  doc.text(right, profile.margin, y, {
    width: doc.page.width - profile.margin * 2,
    align: 'right',
  });
  doc.y = y + profile.lineH;
}

/**
 * Continuous roll receipt (58mm / 80mm)
 */
function buildThermalPdf(doc, order, restaurant, profile) {
  const sym = restaurant.currencySymbol || 'Rs.';
  const w = doc.page.width - profile.margin * 2;

  doc.font('Helvetica-Bold').fontSize(profile.fontSize + 3);
  doc.text(restaurant.name || 'Restaurant', profile.margin, doc.y, { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(profile.fontSize - 1);
  doc.text(restaurant.address || '', { width: w, align: 'center' });
  doc.text(`Tel: ${restaurant.phone || '-'}`, { width: w, align: 'center' });
  doc.moveDown(0.5);
  drawDashed(doc, profile);

  doc.font('Helvetica-Bold').fontSize(profile.fontSize + 1);
  doc.text('SALES RECEIPT', { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(profile.fontSize);
  doc.moveDown(0.4);

  drawRow(doc, profile, 'Receipt:', order.id);
  drawRow(doc, profile, 'Date:', new Date(order.timestamp).toLocaleString());
  drawRow(doc, profile, 'Service:', order.serviceMode || 'Dine-In');
  drawRow(doc, profile, 'Payment:', order.paymentMethod || 'Cash');
  if (order.cashier) drawRow(doc, profile, 'Cashier:', order.cashier);
  drawDashed(doc, profile);

  doc.font('Helvetica-Bold').fontSize(profile.fontSize);
  drawRow(doc, profile, 'ITEM', 'AMT', true);
  drawDashed(doc, profile);

  order.items.forEach((line) => {
    const amt = money(sym, line.price * line.qty);
    const title = `${line.name} x${line.qty}`;
    drawRow(doc, profile, title, amt);
    if (line.notes) {
      doc.font('Helvetica-Oblique').fontSize(profile.fontSize - 1);
      doc.text(`* ${line.notes}`, profile.margin + 4, doc.y, { width: w });
      doc.y += profile.lineH - 2;
      doc.font('Helvetica').fontSize(profile.fontSize);
    }
  });

  drawDashed(doc, profile);
  drawRow(doc, profile, 'Subtotal:', money(sym, order.subtotal));
  if (Number(order.discount) > 0) {
    drawRow(doc, profile, 'Discount:', `-${money(sym, order.discount)}`);
  }
  drawRow(doc, profile, 'Tax:', money(sym, order.tax));
  doc.moveDown(0.2);
  drawRow(doc, profile, 'GRAND TOTAL:', money(sym, order.total), true);

  if (order.amountReceived !== undefined) {
    doc.moveDown(0.3);
    drawRow(doc, profile, 'Received:', money(sym, order.amountReceived));
    drawRow(doc, profile, 'Change:', money(sym, order.changeGiven ?? 0));
  }

  drawDashed(doc, profile);
  doc.font('Helvetica-Bold').fontSize(profile.fontSize);
  doc.text('THANK YOU!', { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(profile.fontSize - 1);
  doc.text('Please visit again', { width: w, align: 'center' });
}

/**
 * Formal A4 tax invoice layout
 */
function buildA4InvoicePdf(doc, order, restaurant, profile) {
  const sym = restaurant.currencySymbol || 'Rs.';
  const pageW = doc.page.width;
  const contentW = pageW - profile.margin * 2;
  let y = profile.margin;

  doc.font('Helvetica-Bold').fontSize(22).text(restaurant.name || 'Restaurant', profile.margin, y);
  y += 28;
  doc.font('Helvetica').fontSize(10).fillColor('#444');
  doc.text(restaurant.address || '', profile.margin, y);
  y += 14;
  doc.text(`Phone: ${restaurant.phone || '-'}`, profile.margin, y);
  y += 24;

  doc.fillColor('#000').font('Helvetica-Bold').fontSize(16);
  doc.text('TAX INVOICE', profile.margin, y, { width: contentW, align: 'right' });
  y += 28;

  doc.font('Helvetica').fontSize(10);
  const col2 = profile.margin + contentW / 2;
  doc.text(`Invoice No: ${order.id}`, profile.margin, y);
  doc.text(`Date: ${new Date(order.timestamp).toLocaleString()}`, col2, y);
  y += 16;
  doc.text(`Service: ${order.serviceMode || 'Dine-In'}`, profile.margin, y);
  doc.text(`Payment: ${order.paymentMethod || 'Cash'}`, col2, y);
  y += 24;

  const tableTop = y;
  const cols = {
    item: profile.margin,
    qty: profile.margin + contentW * 0.55,
    unit: profile.margin + contentW * 0.68,
    total: profile.margin + contentW * 0.82,
  };

  doc.rect(profile.margin, tableTop, contentW, 20).fill('#1e293b');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  doc.text('Description', cols.item + 6, tableTop + 6);
  doc.text('Qty', cols.qty, tableTop + 6);
  doc.text('Unit', cols.unit, tableTop + 6);
  doc.text('Amount', cols.total, tableTop + 6);
  y = tableTop + 22;

  doc.fillColor('#000').font('Helvetica').fontSize(9);
  order.items.forEach((line, idx) => {
    const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    doc.rect(profile.margin, y, contentW, 18).fill(bg);
    doc.fillColor('#000');
    doc.text(line.name, cols.item + 6, y + 4, { width: contentW * 0.5 });
    doc.text(String(line.qty), cols.qty, y + 4);
    doc.text(money(sym, line.price), cols.unit, y + 4);
    doc.text(money(sym, line.price * line.qty), cols.total, y + 4);
    y += 18;
    if (line.notes) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#b45309');
      doc.text(`Note: ${line.notes}`, cols.item + 10, y);
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#000');
    }
  });

  y += 16;
  const totalsX = profile.margin + contentW * 0.58;
  doc.text('Subtotal:', totalsX, y);
  doc.text(money(sym, order.subtotal), cols.total, y);
  y += 14;
  if (Number(order.discount) > 0) {
    doc.text('Discount:', totalsX, y);
    doc.text(`-${money(sym, order.discount)}`, cols.total, y);
    y += 14;
  }
  doc.text('Tax:', totalsX, y);
  doc.text(money(sym, order.tax), cols.total, y);
  y += 16;
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('Grand Total:', totalsX, y);
  doc.text(money(sym, order.total), cols.total, y);

  if (order.amountReceived !== undefined) {
    y += 20;
    doc.font('Helvetica').fontSize(10);
    doc.text(`Amount Received: ${money(sym, order.amountReceived)}`, totalsX, y);
    y += 14;
    doc.text(`Change: ${money(sym, order.changeGiven ?? 0)}`, totalsX, y);
  }

  y += 40;
  doc.font('Helvetica').fontSize(9).fillColor('#64748b');
  doc.text('This is a computer-generated invoice. Thank you for your business.', profile.margin, y, {
    width: contentW,
    align: 'center',
  });
}

/**
 * @param {string} outputPath
 * @param {{ order: object, restaurant: object, printSize: string }} payload
 */
function buildReceiptPdf(outputPath, { order, restaurant, printSize }) {
  const profile = PRINT_PROFILES[printSize] || PRINT_PROFILES['80mm'];
  const normalized = normalizeOrder(order);

  return new Promise((resolve, reject) => {
    try {
      let docOptions;
      if (profile.thermal) {
        const widthPt = mmToPt(profile.widthMm);
        const heightPt = estimateThermalHeight(profile, normalized);
        docOptions = { size: [widthPt, heightPt], margin: profile.margin };
      } else {
        docOptions = { size: 'A4', margin: profile.margin };
      }

      const doc = new PDFDocument({ ...docOptions, autoFirstPage: true });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      if (profile.thermal) {
        buildThermalPdf(doc, normalized, restaurant, profile);
      } else {
        buildA4InvoicePdf(doc, normalized, restaurant, profile);
      }

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildReceiptPdf, PRINT_PROFILES };
