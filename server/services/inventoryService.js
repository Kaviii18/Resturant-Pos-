'use strict';

const pool = require('../config/db');
const { resolveColumns } = require('../config/dbColumns');

/**
 * Deduct ingredient stock when menu items are sold.
 * @param {Array} orderLines - cart lines with menuItem + quantity
 * @param {string} referenceId - order id
 * @param {import('mysql2/promise').PoolConnection} [conn] - optional transaction connection
 */
async function deductStockForOrder(orderLines, referenceId, conn = null) {
  if (!Array.isArray(orderLines) || orderLines.length === 0) return;

  const db = conn || pool;
  const ownTransaction = !conn;
  const cols = await resolveColumns(pool);
  const menuCol = cols.recipe_ingredients.menuItemId;
  const qtyCol = cols.recipe_ingredients.qtyPerServing;
  const typeCol = cols.stock_movements.movementType;

  let connection = conn;
  if (ownTransaction) {
    connection = await pool.getConnection();
    await connection.beginTransaction();
  }

  try {
    for (const line of orderLines) {
      const menuItem = line.menuItem || line;
      const menuItemId = menuItem.id || line.item_id;
      const qtySold = Number(line.quantity) || 0;
      if (!menuItemId || qtySold <= 0) continue;

      const [recipes] = await connection.query(
        `SELECT \`ingredient_id\`, \`${qtyCol}\` AS qty_per_serving
         FROM \`recipe_ingredients\` WHERE \`${menuCol}\` = ?`,
        [menuItemId]
      );

      for (const recipe of recipes) {
        const deductQty = Number(recipe.qty_per_serving) * qtySold;

        await connection.query(
          'UPDATE `ingredients` SET `current_stock` = GREATEST(0, `current_stock` - ?) WHERE `id` = ?',
          [deductQty, recipe.ingredient_id]
        );

        if (cols.stock_movements.hasReason) {
          await connection.query(
            `INSERT INTO \`stock_movements\` (\`ingredient_id\`, \`${typeCol}\`, \`quantity\`, \`reason\`, \`reference_id\`)
             VALUES (?, 'out', ?, ?, ?)`,
            [recipe.ingredient_id, deductQty, `Sale — order ${referenceId}`, referenceId]
          );
        } else {
          await connection.query(
            `INSERT INTO \`stock_movements\` (\`ingredient_id\`, \`${typeCol}\`, \`quantity\`, \`reference_id\`)
             VALUES (?, 'out', ?, ?)`,
            [recipe.ingredient_id, deductQty, referenceId]
          );
        }
      }
    }

    if (ownTransaction) await connection.commit();
  } catch (err) {
    if (ownTransaction) await connection.rollback();
    throw err;
  } finally {
    if (ownTransaction && connection) connection.release();
  }
}

/**
 * @returns {Promise<Array>} ingredients below reorder level
 */
async function getLowStockIngredients() {
  const cols = await resolveColumns(pool);
  const reorderCol = cols.ingredients.reorderLevel;
  const [rows] = await pool.query(
    `SELECT * FROM \`ingredients\`
     WHERE \`current_stock\` <= \`${reorderCol}\`
     ORDER BY \`current_stock\` ASC`
  );
  return rows;
}

module.exports = { deductStockForOrder, getLowStockIngredients };
