const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { login, register, getMe, changePassword } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// POST /api/auth/login — Public
router.post(
  '/login',
  [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.'),
    body('password')
      .notEmpty().withMessage('Password is required.'),
  ],
  login
);

// POST /api/auth/register
// - Public when registering as Cashier
// - Admin JWT required when registering another Admin
router.post(
  '/register',
  [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be 3–50 characters.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.'),
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required.')
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2–100 characters.'),
    body('password')
      .isLength({ min: 4 }).withMessage('Password must be at least 4 characters.'),
    body('role')
      .optional()
      .isIn(['Admin', 'Cashier']).withMessage('Role must be Admin or Cashier.'),
  ],
  register
);

// GET /api/auth/me — Protected
router.get('/me', protect, getMe);

// PUT /api/auth/change-password — Protected (any logged-in user)
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 4 }).withMessage('New password must be at least 4 characters.'),
  ],
  changePassword
);

module.exports = router;
