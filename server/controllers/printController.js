'use strict';

const { validationResult } = require('express-validator');
const { silentPrintReceipt, listSystemPrinters, VALID_SIZES } = require('../services/printService');

/**
 * POST /api/print/receipt
 * Body: { order, restaurant?, printSize: '58mm'|'80mm'|'A4', copies? }
 */
const printReceipt = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { order, restaurant, printSize, copies } = req.body;

    const result = await silentPrintReceipt({
      order,
      restaurant: restaurant || {},
      printSize,
      copies,
    });

    res.status(200).json({
      success: true,
      message: `Receipt sent to printer (${printSize}).`,
      data: result,
    });
  } catch (err) {
    console.error('Print error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to print receipt. Check printer connection and PRINTER_NAME in .env.',
    });
  }
};

/**
 * GET /api/print/printers
 */
const getPrinters = async (_req, res, next) => {
  try {
    const printers = await listSystemPrinters();
    res.status(200).json({
      success: true,
      data: printers,
      defaultPrinter: process.env.PRINTER_NAME || 'system-default',
      supportedSizes: VALID_SIZES,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { printReceipt, getPrinters };
