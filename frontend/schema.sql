-- CREATE DATABASE IF NOT EXISTS
CREATE DATABASE IF NOT EXISTS `restaurant_pos` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `restaurant_pos`;

-- 1. Restaurant Config Table
CREATE TABLE IF NOT EXISTS `restaurant_config` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `phone` VARCHAR(50),
  `tax_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'LKR',
  `currency_symbol` VARCHAR(10) NOT NULL DEFAULT 'Rs.',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Menu Items Table
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` VARCHAR(100) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(150) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `is_available` BOOLEAN NOT NULL DEFAULT TRUE,
  `description` TEXT,
  `image_url` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `username` VARCHAR(100) PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255),
  `role` ENUM('Admin', 'Cashier') NOT NULL DEFAULT 'Cashier',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Completed Sales Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(100) PRIMARY KEY,
  `timestamp` DATETIME NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `tax` DECIMAL(10, 2) NOT NULL,
  `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10, 2) NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `service_mode` VARCHAR(50) NOT NULL,
  `cashier` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Order Purchased Items Table (Nested CartItems)
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(100) NOT NULL,
  `item_id` VARCHAR(100) NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `item_category` VARCHAR(150),
  `item_price` DECIMAL(10, 2) NOT NULL,
  `quantity` INT NOT NULL,
  `notes` TEXT,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Held/Draft Orders Table
CREATE TABLE IF NOT EXISTS `held_orders` (
  `id` VARCHAR(100) PRIMARY KEY,
  `customer_name` VARCHAR(255) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `service_mode` VARCHAR(50) NOT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Held Orders Shared Items Table (Nested Draft CartItems)
CREATE TABLE IF NOT EXISTS `held_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `held_order_id` VARCHAR(100) NOT NULL,
  `item_id` VARCHAR(100) NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `item_category` VARCHAR(150),
  `item_price` DECIMAL(10, 2) NOT NULL,
  `quantity` INT NOT NULL,
  `notes` TEXT,
  FOREIGN KEY (`held_order_id`) REFERENCES `held_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- See migrations/002_production_features.sql for:
-- dining_tables, kitchen_tickets, kitchen_ticket_items,
-- ingredients, recipe_ingredients, stock_movements,
-- and orders.table_id / split_group_id / split_label columns.


-- ==========================================
-- SEED INITIAL DATA FOR THE RESTAURANT POS --
-- ==========================================

-- Seed Initial Default Configuration
INSERT INTO `restaurant_config` (`id`, `name`, `address`, `phone`, `tax_rate`, `currency`, `currency_symbol`)
VALUES ('default', 'Gusto Bistro & Cafe', '102 Marina Promenade, Colombo 03', '+94 11 234 5678', 0.1000, 'LKR', 'Rs.')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Seed Basic General Admins & Cashiers
INSERT INTO `users` (`username`, `full_name`, `password`, `role`) VALUES
('admin', 'System Director', 'admin123', 'Admin'),
('cashier1', 'Anura Perera', '1234', 'Cashier'),
('cashier2', 'Dilini Silva', '4321', 'Cashier')
ON DUPLICATE KEY UPDATE `full_name`=VALUES(`full_name`);

-- Seed Default Menu Items
INSERT INTO `menu_items` (`id`, `name`, `category`, `price`, `is_available`, `description`, `image_url`) VALUES
('item_burger_01', 'Signature Spicy Crispy Chicken Burger', 'Burgers', 1250.00, 1, 'Golden-fried spicy chicken steak fileted with fresh crisp iceberg lettuce, layered cheese, tomato slices and our in-house secret dynamic mustard dress.', ''),
('item_pasta_01', 'Creamy Tuscan Alfredo Pasta with Mushroom', 'Mains', 1850.00, 1, 'Classic Italian-style fettuccine tossed in rich white alfredo creamy base, sautéed wild porcini mushrooms, parmigiano shavings, and fresh garlic croutons.', ''),
('item_beverage_01', 'Double Shot Ice Shaken Cappuccino', 'Beverages', 850.00, 1, 'Premium dark Arabica espresso extract double blended sweet shaker syrup, topped with foaming thick dense milk micro-froth cap.', ''),
('item_dessert_01', 'Decadent Chocolate Lava Fondant Cake', 'Desserts', 1100.00, 1, 'Warm oven-baked rich Belgian chocolate casing holding a warm flowing liquid core, dusted with snow icing sugar and a side of cold option vanilla bean gelato.', '')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `price`=VALUES(`price`);
