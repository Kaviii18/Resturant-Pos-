'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { print, getPrinters } = require('pdf-to-printer');
const { buildReceiptPdf } = require('./receiptPdfBuilder');

const VALID_SIZES = ['58mm', '80mm', 'A4'];

/**
 * Silent print to Windows default (or configured) printer.
 * @param {{ order: object, restaurant: object, printSize: string, copies?: number }} opts
 */
async function silentPrintReceipt({ order, restaurant, printSize, copies }) {
  if (!order || !order.id) {
    throw new Error('Valid order with id is required for printing.');
  }
  if (!VALID_SIZES.includes(printSize)) {
    throw new Error(`Invalid printSize. Use: ${VALID_SIZES.join(', ')}`);
  }

  const tmpDir = path.join(os.tmpdir(), 'gusto-pos-receipts');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const pdfPath = path.join(tmpDir, `receipt-${order.id}-${Date.now()}.pdf`);

  try {
    await buildReceiptPdf(pdfPath, { order, restaurant: restaurant || {}, printSize });

    const printOptions = {
      silent: process.env.PRINT_SILENT !== 'false',
      copies: copies || parseInt(process.env.PRINT_COPIES, 10) || 1,
    };

    if (process.env.PRINTER_NAME) {
      printOptions.printer = process.env.PRINTER_NAME;
    }

    await print(pdfPath, printOptions);

    return {
      printed: true,
      printSize,
      pdfPath: process.env.KEEP_PRINT_PDFS === 'true' ? pdfPath : undefined,
      printer: process.env.PRINTER_NAME || 'system-default',
    };
  } finally {
    if (process.env.KEEP_PRINT_PDFS !== 'true') {
      try {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

async function listSystemPrinters() {
  try {
    const printers = await getPrinters();
    return Array.isArray(printers) ? printers : [];
  } catch {
    return [];
  }
}

module.exports = { silentPrintReceipt, listSystemPrinters, VALID_SIZES };
