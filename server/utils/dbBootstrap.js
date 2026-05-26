'use strict';

/**
 * Ensures production-feature tables exist and default rows are present.
 * Safe to call on every startup and before feature API reads.
 */
const pool = require('../config/db');
const { resolveColumns } = require('../config/dbColumns');

/** Canonical table names used by all controllers (must match MySQL exactly). */
const REQUIRED_TABLES = [
  'restaurant_config',
  'menu_items',
  'users',
  'orders',
  'order_items',
  'held_orders',
  'held_order_items',
  'dining_tables',
  'kitchen_tickets',
  'kitchen_ticket_items',
  'ingredients',
  'recipe_ingredients',
  'stock_movements',
];

const CREATE_STATEMENTS = {
  dining_tables: `
    CREATE TABLE IF NOT EXISTS \`dining_tables\` (
      \`id\` VARCHAR(50) PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`zone\` VARCHAR(100) DEFAULT 'Main Hall',
      \`capacity\` INT NOT NULL DEFAULT 4,
      \`status\` ENUM('available', 'occupied', 'reserved', 'billing') NOT NULL DEFAULT 'available',
      \`active_session_id\` VARCHAR(100) NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  kitchen_tickets: `
    CREATE TABLE IF NOT EXISTS \`kitchen_tickets\` (
      \`id\` VARCHAR(100) PRIMARY KEY,
      \`table_id\` VARCHAR(50) NULL,
      \`table_name\` VARCHAR(100) NULL,
      \`service_mode\` VARCHAR(50) NOT NULL DEFAULT 'Dine-In',
      \`status\` ENUM('pending', 'preparing', 'ready', 'served', 'cancelled') NOT NULL DEFAULT 'pending',
      \`notes\` TEXT,
      \`cashier\` VARCHAR(100),
      \`fired_at\` DATETIME NOT NULL,
      \`prepared_at\` DATETIME NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  kitchen_ticket_items: `
    CREATE TABLE IF NOT EXISTS \`kitchen_ticket_items\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`ticket_id\` VARCHAR(100) NOT NULL,
      \`item_id\` VARCHAR(100) NOT NULL,
      \`item_name\` VARCHAR(255) NOT NULL,
      \`item_category\` VARCHAR(150),
      \`quantity\` INT NOT NULL,
      \`notes\` TEXT,
      \`status\` ENUM('pending', 'preparing', 'ready', 'served') NOT NULL DEFAULT 'pending',
      FOREIGN KEY (\`ticket_id\`) REFERENCES \`kitchen_tickets\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  ingredients: `
    CREATE TABLE IF NOT EXISTS \`ingredients\` (
      \`id\` VARCHAR(100) PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`unit\` VARCHAR(50) NOT NULL DEFAULT 'g',
      \`current_stock\` DECIMAL(12, 3) NOT NULL DEFAULT 0,
      \`reorder_level\` DECIMAL(12, 3) NOT NULL DEFAULT 0,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  recipe_ingredients: `
    CREATE TABLE IF NOT EXISTS \`recipe_ingredients\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`menu_item_id\` VARCHAR(100) NOT NULL,
      \`ingredient_id\` VARCHAR(100) NOT NULL,
      \`qty_per_serving\` DECIMAL(12, 3) NOT NULL,
      UNIQUE KEY \`uk_recipe\` (\`menu_item_id\`, \`ingredient_id\`),
      FOREIGN KEY (\`menu_item_id\`) REFERENCES \`menu_items\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  stock_movements: `
    CREATE TABLE IF NOT EXISTS \`stock_movements\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`ingredient_id\` VARCHAR(100) NOT NULL,
      \`movement_type\` ENUM('in', 'out', 'adjust') NOT NULL,
      \`quantity\` DECIMAL(12, 3) NOT NULL,
      \`reason\` VARCHAR(255),
      \`reference_id\` VARCHAR(100) NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
};

const ORDER_COLUMN_ALTERS = [
  'ALTER TABLE `orders` ADD COLUMN `table_id` VARCHAR(50) NULL AFTER `service_mode`',
  'ALTER TABLE `orders` ADD COLUMN `split_group_id` VARCHAR(100) NULL AFTER `table_id`',
  'ALTER TABLE `orders` ADD COLUMN `split_label` VARCHAR(100) NULL AFTER `split_group_id`',
  'ALTER TABLE `held_orders` ADD COLUMN `table_id` VARCHAR(50) NULL AFTER `service_mode`',
];

let bootstrapPromise = null;

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0].cnt) > 0;
}

async function ensureOrderColumns() {
  const checks = [
    { table: 'orders', column: 'table_id', sql: ORDER_COLUMN_ALTERS[0] },
    { table: 'orders', column: 'split_group_id', sql: ORDER_COLUMN_ALTERS[1] },
    { table: 'orders', column: 'split_label', sql: ORDER_COLUMN_ALTERS[2] },
    { table: 'held_orders', column: 'table_id', sql: ORDER_COLUMN_ALTERS[3] },
  ];

  for (const { table, column, sql } of checks) {
    const exists = await columnExists(table, column);
    if (!exists) {
      try {
        await pool.query(sql);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      }
    }
  }
}

async function ensureFeatureTables() {
  for (const table of Object.keys(CREATE_STATEMENTS)) {
    await pool.query(CREATE_STATEMENTS[table]);
  }
  await ensureOrderColumns();
}

async function seedDiningTablesIfEmpty() {
  const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM `dining_tables`');
  if (Number(countRows[0].cnt) > 0) return false;

  await pool.query(
    `INSERT INTO \`dining_tables\` (\`id\`, \`name\`, \`zone\`, \`capacity\`, \`status\`) VALUES
     ('tbl_01', 'Table 1', 'Main Hall', 4, 'available'),
     ('tbl_02', 'Table 2', 'Main Hall', 4, 'available'),
     ('tbl_03', 'Table 3', 'Main Hall', 4, 'available'),
     ('tbl_04', 'Table 4', 'Main Hall', 4, 'available'),
     ('tbl_05', 'Table 5', 'Main Hall', 6, 'available'),
     ('tbl_06', 'Table 6', 'Main Hall', 6, 'available'),
     ('tbl_07', 'Table 7', 'Terrace', 4, 'available'),
     ('tbl_08', 'Table 8', 'Terrace', 4, 'available'),
     ('tbl_vip', 'VIP Lounge', 'Private', 8, 'available')`
  );
  return true;
}

/** Ensures core staples exist even if the table already has other rows */
async function seedEssentialIngredients() {
  const cols = await resolveColumns(pool);
  const reorderCol = cols.ingredients.reorderLevel;

  await pool.query(
    `INSERT INTO \`ingredients\` (\`id\`, \`name\`, \`unit\`, \`current_stock\`, \`${reorderCol}\`) VALUES
     ('ing_flour', 'Flour', 'kg', 25, 5),
     ('ing_chicken', 'Chicken', 'kg', 18, 4),
     ('ing_cheese', 'Cheese', 'kg', 8, 2),
     ('ing_rice', 'Rice', 'kg', 30, 6)
     ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`)`
  );
}

async function seedIngredientsIfEmpty() {
  const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM `ingredients`');
  if (Number(countRows[0].cnt) > 0) return false;

  const cols = await resolveColumns(pool);
  const reorderCol = cols.ingredients.reorderLevel;
  const menuCol = cols.recipe_ingredients.menuItemId;
  const qtyCol = cols.recipe_ingredients.qtyPerServing;

  await pool.query(
    `INSERT INTO \`ingredients\` (\`id\`, \`name\`, \`unit\`, \`current_stock\`, \`${reorderCol}\`) VALUES
     ('ing_flour', 'Flour', 'kg', 25, 5),
     ('ing_chicken', 'Chicken', 'kg', 18, 4),
     ('ing_cheese', 'Cheese', 'kg', 8, 2),
     ('ing_rice', 'Rice', 'kg', 30, 6),
     ('ing_bun', 'Burger Bun', 'pcs', 120, 30),
     ('ing_pasta', 'Fettuccine Pasta', 'g', 3000, 500),
     ('ing_cream', 'Cooking Cream', 'ml', 2000, 400),
     ('ing_coffee', 'Espresso Beans', 'g', 1500, 300),
     ('ing_chocolate', 'Belgian Chocolate', 'g', 800, 200)`
  );

  await pool.query(
    `INSERT IGNORE INTO \`recipe_ingredients\` (\`${menuCol}\`, \`ingredient_id\`, \`${qtyCol}\`) VALUES
     ('item_burger_01', 'ing_chicken', 180),
     ('item_burger_01', 'ing_bun', 1),
     ('item_pasta_01', 'ing_pasta', 250),
     ('item_pasta_01', 'ing_cream', 120),
     ('item_beverage_01', 'ing_coffee', 18),
     ('item_dessert_01', 'ing_chocolate', 80)`
  );
  return true;
}

/**
 * @returns {Promise<{ ok: boolean, missingTables: string[], seeded: { tables: boolean, ingredients: boolean } }>}
 */
async function getSchemaStatus() {
  const [rows] = await pool.query('SHOW TABLES');
  const existing = new Set(
    rows.map((r) => Object.values(r)[0].toLowerCase())
  );

  const missingTables = REQUIRED_TABLES.filter((t) => !existing.has(t.toLowerCase()));

  return {
    ok: missingTables.length === 0,
    missingTables,
    existingTables: [...existing],
    database: process.env.MYSQL_DATABASE || 'restaurant_pos',
  };
}

async function runBootstrap() {
  await ensureFeatureTables();
  await resolveColumns(pool);
  const seededTables = await seedDiningTablesIfEmpty();
  const seededIngredients = await seedIngredientsIfEmpty();
  await seedEssentialIngredients();
  const status = await getSchemaStatus();

  return {
    ...status,
    seeded: { tables: seededTables, ingredients: seededIngredients },
  };
}

function ensureDbReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

module.exports = {
  REQUIRED_TABLES,
  ensureDbReady,
  getSchemaStatus,
  runBootstrap,
  seedDiningTablesIfEmpty,
};
