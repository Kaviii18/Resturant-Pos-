const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { printReceipt, getPrinters } = require('../controllers/printController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/printers', getPrinters);

router.post(
  '/receipt',
  [
    body('order').isObject().withMessage('Order payload is required.'),
    body('order.id').notEmpty().withMessage('Order id is required.'),
    body('order.items').isArray({ min: 1 }).withMessage('Order must include items.'),
    body('printSize')
      .isIn(['58mm', '80mm', 'A4'])
      .withMessage('printSize must be 58mm, 80mm, or A4'),
    body('restaurant').optional().isObject(),
    body('copies').optional().isInt({ min: 1, max: 5 }),
  ],
  printReceipt
);

module.exports = router;
