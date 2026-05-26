const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { settleSplitBill, getSplitGroup } = require('../controllers/splitController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post(
  '/settle',
  [
    body('splits').isArray({ min: 1 }).withMessage('At least one split is required.'),
    body('splits.*.total').isFloat({ min: 0 }),
    body('splits.*.paymentMethod').notEmpty(),
  ],
  settleSplitBill
);

router.get('/:groupId', getSplitGroup);

module.exports = router;
