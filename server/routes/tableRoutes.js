const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllTables,
  createTable,
  updateTableStatus,
  deleteTable,
} = require('../controllers/tableController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getAllTables);

router.post(
  '/',
  authorize('Admin'),
  [
    body('id').trim().notEmpty().withMessage('Table ID is required.'),
    body('name').trim().notEmpty().withMessage('Table name is required.'),
  ],
  createTable
);

router.patch(
  '/:id/status',
  [body('status').notEmpty().withMessage('Status is required.')],
  updateTableStatus
);

router.delete('/:id', authorize('Admin'), deleteTable);

module.exports = router;
