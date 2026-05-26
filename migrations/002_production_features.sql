-- Production features: Tables, KOT, Split Billing, Ingredient Inventory
USE `restaurant_pos`;

-- ─── Dining tables with live status ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `dining_tables` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `zone` VARCHAR(100) DEFAULT 'Main Hall',
  `capacity` INT NOT NULL DEFAULT 4,
  `status` ENUM('available', 'occupied', 'reserved', 'billing') NOT NULL DEFAULT 'available',
  `active_session_id` VARCHAR(100) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Kitchen Order Tickets (KOT) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `kitchen_tickets` (
  `id` VARCHAR(100) PRIMARY KEY,
  `table_id` VARCHAR(50) NULL,
  `table_name` VARCHAR(100) NULL,
  `service_mode` VARCHAR(50) NOT NULL DEFAULT 'Dine-In',
  `status` ENUM('pending', 'preparing', 'ready', 'served', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `cashier` VARCHAR(100),
  `fired_at` DATETIME NOT NULL,
  `prepared_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_kot_status` (`status`),
  INDEX `idx_kot_fired` (`fired_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kitchen_ticket_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` VARCHAR(100) NOT NULL,
  `item_id` VARCHAR(100) NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `item_category` VARCHAR(150),
  `quantity` INT NOT NULL,
  `notes` TEXT,
  `status` ENUM('pending', 'preparing', 'ready', 'served') NOT NULL DEFAULT 'pending',
  FOREIGN KEY (`ticket_id`) REFERENCES `kitchen_tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Split billing linkage on completed orders ──────────────────────────────
-- Run once; ignore "Duplicate column" errors if re-applying.
ALTER TABLE `orders`
  ADD COLUMN `table_id` VARCHAR(50) NULL AFTER `service_mode`,
  ADD COLUMN `split_group_id` VARCHAR(100) NULL AFTER `table_id`,
  ADD COLUMN `split_label` VARCHAR(100) NULL AFTER `split_group_id`;

ALTER TABLE `held_orders`
  ADD COLUMN `table_id` VARCHAR(50) NULL AFTER `service_mode`;

-- ─── Ingredient-level inventory & recipes ───────────────────────────────────
-- NOTE: If you created tables manually with alternate column names, the backend
-- auto-detects both conventions:
--   reorder_level  OR  min_alert_level
--   menu_item_id + qty_per_serving  OR  item_id + quantity_required
--   movement_type  OR  type (on stock_movements)
CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` VARCHAR(100) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'g',
  `current_stock` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `reorder_level` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `menu_item_id` VARCHAR(100) NOT NULL,
  `ingredient_id` VARCHAR(100) NOT NULL,
  `qty_per_serving` DECIMAL(12, 3) NOT NULL,
  UNIQUE KEY `uk_recipe` (`menu_item_id`, `ingredient_id`),
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ingredient_id` VARCHAR(100) NOT NULL,
  `movement_type` ENUM('in', 'out', 'adjust') NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `reason` VARCHAR(255),
  `reference_id` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default dining tables
INSERT INTO `dining_tables` (`id`, `name`, `zone`, `capacity`, `status`) VALUES
('tbl_01', 'Table 1', 'Main Hall', 4, 'available'),
('tbl_02', 'Table 2', 'Main Hall', 4, 'available'),
('tbl_03', 'Table 3', 'Main Hall', 4, 'available'),
('tbl_04', 'Table 4', 'Main Hall', 4, 'available'),
('tbl_05', 'Table 5', 'Main Hall', 6, 'available'),
('tbl_06', 'Table 6', 'Main Hall', 6, 'available'),
('tbl_07', 'Table 7', 'Terrace', 4, 'available'),
('tbl_08', 'Table 8', 'Terrace', 4, 'available'),
('tbl_vip', 'VIP Lounge', 'Private', 8, 'available')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Seed sample ingredients
INSERT INTO `ingredients` (`id`, `name`, `unit`, `current_stock`, `reorder_level`) VALUES
('ing_chicken', 'Chicken Breast', 'g', 5000, 1000),
('ing_bun', 'Burger Bun', 'pcs', 120, 30),
('ing_pasta', 'Fettuccine Pasta', 'g', 3000, 500),
('ing_cream', 'Cooking Cream', 'ml', 2000, 400),
('ing_coffee', 'Espresso Beans', 'g', 1500, 300),
('ing_chocolate', 'Belgian Chocolate', 'g', 800, 200)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Sample recipes for seeded menu items
INSERT INTO `recipe_ingredients` (`menu_item_id`, `ingredient_id`, `qty_per_serving`) VALUES
('item_burger_01', 'ing_chicken', 180),
('item_burger_01', 'ing_bun', 1),
('item_pasta_01', 'ing_pasta', 250),
('item_pasta_01', 'ing_cream', 120),
('item_beverage_01', 'ing_coffee', 18),
('item_dessert_01', 'ing_chocolate', 80)
ON DUPLICATE KEY UPDATE `qty_per_serving` = VALUES(`qty_per_serving`);
