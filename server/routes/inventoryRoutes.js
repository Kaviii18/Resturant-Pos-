const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getIngredients,
  getLowStock,
  createIngredient,
  updateIngredient,
  adjustStock,
  getRecipeForMenuItem,
  saveRecipeForMenuItem,
  getStockMovements,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/ingredients', getIngredients);
router.get('/low-stock', getLowStock);
router.get('/movements', getStockMovements);

router.post(
  '/ingredients',
  authorize('Admin'),
  [
    body('id').trim().notEmpty(),
    body('name').trim().notEmpty(),
  ],
  createIngredient
);

router.put('/ingredients/:id', authorize('Admin'), updateIngredient);

router.post(
  '/adjust',
  authorize('Admin'),
  [
    body('ingredientId').notEmpty(),
    body('quantity').isFloat({ min: 0.001 }),
  ],
  adjustStock
);

router.get('/recipes/:menuItemId', getRecipeForMenuItem);
router.put('/recipes/:menuItemId', authorize('Admin'), saveRecipeForMenuItem);

module.exports = router;
