const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAllUsers, getUserByUsername, updateUser, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All user management routes are Admin-only
router.use(protect, authorize('Admin'));

// GET /api/users
router.get('/', getAllUsers);

// GET /api/users/:username
router.get('/:username', getUserByUsername);

// PUT /api/users/:username
router.put(
  '/:username',
  [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty.'),
    body('role').optional().isIn(['Admin', 'Cashier']).withMessage('Role must be Admin or Cashier.'),
    body('password').optional().isLength({ min: 4 }).withMessage('Password must be at least 4 characters.'),
  ],
  updateUser
);

// DELETE /api/users/:username
router.delete('/:username', deleteUser);

module.exports = router;
