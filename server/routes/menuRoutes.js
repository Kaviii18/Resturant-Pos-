const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllMenuItems, getMenuItemById, createMenuItem,
  updateMenuItem, deleteMenuItem, getCategories
} = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/authMiddleware');

// GET /api/menu — Public (or protect if you want login required for POS)
router.get('/', protect, getAllMenuItems);

// GET /api/menu/categories/list
router.get('/categories/list', protect, getCategories);

// GET /api/menu/:id
router.get('/:id', protect, getMenuItemById);

// POST /api/menu — Admin only
router.post(
  '/',
  protect,
  authorize('Admin'),
  [
    body('id').trim().notEmpty().withMessage('Item ID is required.'),
    body('name').trim().notEmpty().withMessage('Item name is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('category').optional().trim(),
  ],
  createMenuItem
);

// PUT /api/menu/:id — Admin only
router.put(
  '/:id',
  protect,
  authorize('Admin'),
  [
    body('name').trim().notEmpty().withMessage('Item name is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('category').optional().trim(),
  ],
  updateMenuItem
);

// DELETE /api/menu/:id — Admin only
router.delete('/:id', protect, authorize('Admin'), deleteMenuItem);

module.exports = router;
