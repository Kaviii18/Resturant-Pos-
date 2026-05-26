const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllOrders, getOrderById, createOrder, deleteOrder,
  getHeldOrders, saveHeldOrder, deleteHeldOrder,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All order routes require authentication
router.use(protect);

/* ===== HELD ORDERS ===== */
// GET /api/orders/held
router.get('/held', getHeldOrders);

// POST /api/orders/held
router.post('/held', saveHeldOrder);

// DELETE /api/orders/held/:id
router.delete('/held/:id', deleteHeldOrder);

/* ===== COMPLETED ORDERS ===== */
// GET /api/orders
router.get('/', getAllOrders);

// GET /api/orders/:id
router.get('/:id', getOrderById);

// POST /api/orders — Cashier and Admin
router.post(
  '/',
  [
    body('id').notEmpty().withMessage('Order ID is required.'),
    body('total').isFloat({ min: 0 }).withMessage('Total must be a non-negative number.'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required.'),
    body('serviceMode').notEmpty().withMessage('Service mode is required.'),
  ],
  createOrder
);

// DELETE /api/orders/:id — Admin only
router.delete('/:id', authorize('Admin'), deleteOrder);

module.exports = router;
