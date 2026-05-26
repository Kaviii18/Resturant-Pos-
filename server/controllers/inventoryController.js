'use strict';

const pool = require('../config/db');
const { getLowStockIngredients } = require('../services/inventoryService');
const { ensureDbReady, runBootstrap } = require('../utils/dbBootstrap');
const { resolveColumns } = require('../config/dbColumns');

const formatIngredient = (row, reorderCol) => {
  const reorder = Number(row[reorderCol] ?? row.reorder_level ?? row.min_alert_level ?? 0);
  const stock = Number(row.current_stock ?? 0);
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    currentStock: stock,
    reorderLevel: reorder,
    isLowStock: stock <= reorder,
  };
};

/**
 * GET /api/inventory/ingredients
 */
const getIngredients = async (req, res, next) => {
  try {
    await ensureDbReady();
    const cols = await resolveColumns(pool);
    const reorderCol = cols.ingredients.reorderLevel;

    let [rows] = await pool.query('SELECT * FROM `ingredients` ORDER BY `name` ASC');

    if (rows.length === 0) {
      await runBootstrap();
      [rows] = await pool.query('SELECT * FROM `ingredients` ORDER BY `name` ASC');
    }

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((r) => formatIngredient(r, reorderCol)),
      message: rows.length === 0 ? 'No ingredients in stock yet' : undefined,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        success: false,
        message: 'Table `ingredients` not found. Restart the backend to auto-create it.',
        code: err.code,
      });
    }
    next(err);
  }
};

/**
 * GET /api/inventory/low-stock
 */
const getLowStock = async (req, res, next) => {
  try {
    await ensureDbReady();
    const cols = await resolveColumns(pool);
    const reorderCol = cols.ingredients.reorderLevel;
    const rows = await getLowStockIngredients();
    res.status(200).json({
      success: true,
      data: rows.map((r) => formatIngredient(r, reorderCol)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/ingredients — Admin
 */
const createIngredient = async (req, res, next) => {
  try {
    const { id, name, unit, currentStock, reorderLevel } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Ingredient id and name are required.' });
    }

    const cols = await resolveColumns(pool);
    const reorderCol = cols.ingredients.reorderLevel;
    await pool.query(
      `INSERT INTO \`ingredients\` (\`id\`, \`name\`, \`unit\`, \`current_stock\`, \`${reorderCol}\`)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, unit || 'g', currentStock || 0, reorderLevel || 0]
    );

    res.status(201).json({ success: true, message: 'Ingredient created.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/inventory/ingredients/:id — Admin
 */
const updateIngredient = async (req, res, next) => {
  try {
    const { name, unit, reorderLevel } = req.body;
    const cols = await resolveColumns(pool);
    const reorderCol = cols.ingredients.reorderLevel;
    const [result] = await pool.query(
      `UPDATE \`ingredients\`
       SET \`name\` = COALESCE(?, \`name\`),
           \`unit\` = COALESCE(?, \`unit\`),
           \`${reorderCol}\` = COALESCE(?, \`${reorderCol}\`)
       WHERE \`id\` = ?`,
      [name, unit, reorderLevel, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }

    res.status(200).json({ success: true, message: 'Ingredient updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/adjust — Admin
 * Body: { ingredientId, quantity, movementType: 'in'|'out'|'adjust', reason }
 */
const adjustStock = async (req, res, next) => {
  try {
    const { ingredientId, quantity, movementType, reason } = req.body;
    const qty = Number(quantity);
    if (!ingredientId || !qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Valid ingredientId and quantity required.' });
    }

    const type = movementType || 'in';
    if (!['in', 'out', 'adjust'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid movement type.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (type === 'out') {
        await conn.query(
          'UPDATE `ingredients` SET `current_stock` = GREATEST(0, `current_stock` - ?) WHERE `id` = ?',
          [qty, ingredientId]
        );
      } else {
        await conn.query(
          'UPDATE `ingredients` SET `current_stock` = `current_stock` + ? WHERE `id` = ?',
          [qty, ingredientId]
        );
      }

      const cols = await resolveColumns(pool);
      const typeCol = cols.stock_movements.movementType;
      if (cols.stock_movements.hasReason) {
        await conn.query(
          `INSERT INTO \`stock_movements\` (\`ingredient_id\`, \`${typeCol}\`, \`quantity\`, \`reason\`)
           VALUES (?, ?, ?, ?)`,
          [ingredientId, type, qty, reason || `Manual ${type}`]
        );
      } else {
        await conn.query(
          `INSERT INTO \`stock_movements\` (\`ingredient_id\`, \`${typeCol}\`, \`quantity\`)
           VALUES (?, ?, ?)`,
          [ingredientId, type, qty]
        );
      }

      await conn.commit();
      res.status(200).json({ success: true, message: 'Stock adjusted.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/recipes/:menuItemId
 */
const getRecipeForMenuItem = async (req, res, next) => {
  try {
    const cols = await resolveColumns(pool);
    const menuCol = cols.recipe_ingredients.menuItemId;
    const qtyCol = cols.recipe_ingredients.qtyPerServing;

    const [rows] = await pool.query(
      `SELECT r.*, i.name AS ingredient_name, i.unit, i.current_stock
       FROM \`recipe_ingredients\` r
       JOIN \`ingredients\` i ON i.id = r.ingredient_id
       WHERE r.\`${menuCol}\` = ?`,
      [req.params.menuItemId]
    );

    res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        menuItemId: r[menuCol],
        ingredientId: r.ingredient_id,
        ingredientName: r.ingredient_name,
        unit: r.unit,
        currentStock: Number(r.current_stock),
        qtyPerServing: Number(r[qtyCol]),
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/inventory/recipes/:menuItemId — Admin (replace all lines)
 * Body: { recipes: [{ ingredientId, qtyPerServing }] }
 */
const saveRecipeForMenuItem = async (req, res, next) => {
  try {
    const menuItemId = req.params.menuItemId;
    const { recipes } = req.body;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const cols = await resolveColumns(pool);
      const menuCol = cols.recipe_ingredients.menuItemId;
      const qtyCol = cols.recipe_ingredients.qtyPerServing;

      await conn.query(`DELETE FROM \`recipe_ingredients\` WHERE \`${menuCol}\` = ?`, [menuItemId]);

      if (Array.isArray(recipes) && recipes.length > 0) {
        const values = recipes.map((r) => [menuItemId, r.ingredientId, r.qtyPerServing]);
        await conn.query(
          `INSERT INTO \`recipe_ingredients\` (\`${menuCol}\`, \`ingredient_id\`, \`${qtyCol}\`) VALUES ?`,
          [values]
        );
      }

      await conn.commit();
      res.status(200).json({ success: true, message: 'Recipe saved.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/movements?ingredientId=
 */
const getStockMovements = async (req, res, next) => {
  try {
    const { ingredientId, limit = 50 } = req.query;
    let query = 'SELECT * FROM `stock_movements`';
    const params = [];

    if (ingredientId) {
      query += ' WHERE `ingredient_id` = ?';
      params.push(ingredientId);
    }

    query += ' ORDER BY `created_at` DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await pool.query(query, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getIngredients,
  getLowStock,
  createIngredient,
  updateIngredient,
  adjustStock,
  getRecipeForMenuItem,
  saveRecipeForMenuItem,
  getStockMovements,
};
