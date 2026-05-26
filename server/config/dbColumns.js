'use strict';

/**
 * Maps API field names to actual MySQL column names.
 * Supports both migration-002 schema and manually created tables.
 */
const COLUMN_MAP = {
  ingredients: {
    reorderLevel: 'min_alert_level', // migration uses reorder_level
    reorder_level: 'min_alert_level',
    min_alert_level: 'min_alert_level',
  },
  recipe_ingredients: {
    menu_item_id: 'item_id',
    item_id: 'item_id',
    qty_per_serving: 'quantity_required',
    quantity_required: 'quantity_required',
  },
  stock_movements: {
    movement_type: 'type',
    type: 'type',
  },
};

/** Resolved at runtime after inspecting INFORMATION_SCHEMA */
let resolved = null;

async function resolveColumns(pool) {
  if (resolved) return resolved;

  const [ingCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ingredients'`
  );
  const ingSet = new Set(ingCols.map((r) => r.COLUMN_NAME));

  const reorderCol = ingSet.has('reorder_level')
    ? 'reorder_level'
    : ingSet.has('min_alert_level')
      ? 'min_alert_level'
      : 'reorder_level';

  const [recipeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe_ingredients'`
  );
  const recipeSet = new Set(recipeCols.map((r) => r.COLUMN_NAME));

  const menuItemCol = recipeSet.has('menu_item_id') ? 'menu_item_id' : 'item_id';
  const qtyCol = recipeSet.has('qty_per_serving') ? 'qty_per_serving' : 'quantity_required';

  const [movCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements'`
  );
  const movSet = new Set(movCols.map((r) => r.COLUMN_NAME));
  const movementTypeCol = movSet.has('movement_type') ? 'movement_type' : 'type';
  const hasReasonCol = movSet.has('reason');

  resolved = {
    ingredients: { reorderLevel: reorderCol },
    recipe_ingredients: { menuItemId: menuItemCol, qtyPerServing: qtyCol },
    stock_movements: { movementType: movementTypeCol, hasReason: hasReasonCol },
  };

  return resolved;
}

function getResolvedSync() {
  return resolved;
}

module.exports = { COLUMN_MAP, resolveColumns, getResolvedSync };
