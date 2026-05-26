-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: May 26, 2026 at 11:24 AM
-- Server version: 9.1.0
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `restaurant_pos`
--

-- --------------------------------------------------------

--
-- Table structure for table `dining_tables`
--

DROP TABLE IF EXISTS `dining_tables`;
CREATE TABLE IF NOT EXISTS `dining_tables` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `zone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Main Hall',
  `capacity` int NOT NULL DEFAULT '4',
  `status` enum('available','occupied','reserved','billing') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `active_session_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_zone` (`status`,`zone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `dining_tables`
--

INSERT INTO `dining_tables` (`id`, `name`, `zone`, `capacity`, `status`, `active_session_id`, `updated_at`) VALUES
('tbl_01', 'Table 1', 'Main Hall', 4, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_02', 'Table 2', 'Main Hall', 4, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_03', 'Table 3', 'Main Hall', 4, 'available', NULL, '2026-05-25 07:12:42'),
('tbl_04', 'Table 4', 'Main Hall', 4, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_05', 'Table 5', 'Main Hall', 6, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_06', 'Table 6', 'Main Hall', 6, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_07', 'Table 7', 'Terrace', 4, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_08', 'Table 8', 'Terrace', 4, 'available', NULL, '2026-05-24 08:56:47'),
('tbl_vip', 'VIP Lounge', 'Private', 8, 'available', NULL, '2026-05-24 08:56:47');

-- --------------------------------------------------------

--
-- Table structure for table `held_orders`
--

DROP TABLE IF EXISTS `held_orders`;
CREATE TABLE IF NOT EXISTS `held_orders` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime NOT NULL,
  `service_mode` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `held_order_items`
--

DROP TABLE IF EXISTS `held_order_items`;
CREATE TABLE IF NOT EXISTS `held_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `held_order_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_category` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `held_order_id` (`held_order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ingredients`
--

DROP TABLE IF EXISTS `ingredients`;
CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `current_stock` decimal(10,3) NOT NULL DEFAULT '0.000',
  `min_alert_level` decimal(10,3) NOT NULL DEFAULT '1.000',
  `unit` varchar(20) NOT NULL DEFAULT 'kg',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `ingredients`
--

INSERT INTO `ingredients` (`id`, `name`, `current_stock`, `min_alert_level`, `unit`, `updated_at`) VALUES
('ing_bun', 'Burger Bun', 120.000, 30.000, 'pcs', '2026-05-24 08:59:01'),
('ing_cheese', 'Cheese', 8.000, 2.000, 'kg', '2026-05-24 09:13:11'),
('ing_chicken', 'Chicken', 4996.000, 1000.000, 'g', '2026-05-25 07:12:42'),
('ing_chocolate', 'Belgian Chocolate', 801.000, 200.000, 'g', '2026-05-24 09:17:49'),
('ing_coffee', 'Espresso Beans', 1500.000, 300.000, 'g', '2026-05-24 08:59:01'),
('ing_cream', 'Cooking Cream', 2000.000, 400.000, 'ml', '2026-05-24 08:59:01'),
('ing_flour', 'Flour', 25.000, 5.000, 'kg', '2026-05-24 09:13:11'),
('ing_pasta', 'Fettuccine Pasta', 3000.000, 500.000, 'g', '2026-05-24 08:59:01'),
('ing_rice', 'Rice', 30.000, 6.000, 'kg', '2026-05-24 09:13:11');

-- --------------------------------------------------------

--
-- Table structure for table `kitchen_tickets`
--

DROP TABLE IF EXISTS `kitchen_tickets`;
CREATE TABLE IF NOT EXISTS `kitchen_tickets` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_mode` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Dine-In',
  `status` enum('pending','preparing','ready','served','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `cashier` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fired_at` datetime NOT NULL,
  `prepared_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `kitchen_tickets`
--

INSERT INTO `kitchen_tickets` (`id`, `table_id`, `table_name`, `service_mode`, `status`, `notes`, `cashier`, `fired_at`, `prepared_at`, `created_at`) VALUES
('KOT-1779614202264', 'tbl_03', 'Table 3', 'Dine-In', 'served', '', 'admin', '2026-05-24 09:16:42', NULL, '2026-05-24 09:16:42'),
('KOT-1779693116500', 'tbl_03', 'Table 3', 'Dine-In', 'preparing', '', 'admin', '2026-05-25 07:11:56', NULL, '2026-05-25 07:11:56');

-- --------------------------------------------------------

--
-- Table structure for table `kitchen_ticket_items`
--

DROP TABLE IF EXISTS `kitchen_ticket_items`;
CREATE TABLE IF NOT EXISTS `kitchen_ticket_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_category` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','preparing','ready','served') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `kitchen_ticket_items`
--

INSERT INTO `kitchen_ticket_items` (`id`, `ticket_id`, `item_id`, `item_name`, `item_category`, `quantity`, `notes`, `status`) VALUES
(1, 'KOT-1779614202264', 'item-1', 'Sri Lankan Spice Burger', 'Burgers', 1, '', 'served'),
(2, 'KOT-1779614202264', 'item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1, '', 'served'),
(3, 'KOT-1779693116500', 'item-1', 'Sri Lankan Spice Burger', 'Burgers', 1, '', 'preparing'),
(4, 'KOT-1779693116500', 'item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1, '', 'preparing'),
(5, 'KOT-1779693116500', 'item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1, '', 'preparing');

-- --------------------------------------------------------

--
-- Table structure for table `menu_items`
--

DROP TABLE IF EXISTS `menu_items`;
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `is_available` tinyint(1) NOT NULL DEFAULT '1',
  `description` text COLLATE utf8mb4_unicode_ci,
  `image_url` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `menu_items`
--

INSERT INTO `menu_items` (`id`, `name`, `category`, `price`, `is_available`, `description`, `image_url`, `created_at`) VALUES
('item_beverage_01', 'Double Shot Ice Shaken Cappuccino', 'Beverages', 850.00, 1, 'Premium dark Arabica espresso extract double blended sweet shaker syrup, topped with foaming thick dense milk micro-froth cap.', '', '2026-05-23 04:48:19'),
('item_burger_01', 'Signature Spicy Crispy Chicken Burger', 'Burgers', 1250.00, 1, 'Golden-fried spicy chicken steak fileted with fresh crisp iceberg lettuce, layered cheese, tomato slices and our in-house secret dynamic mustard dress.', '', '2026-05-23 04:48:19'),
('item_dessert_01', 'Decadent Chocolate Lava Fondant Cake', 'Desserts', 1100.00, 1, 'Warm oven-baked rich Belgian chocolate casing holding a warm flowing liquid core, dusted with snow icing sugar and a side of cold option vanilla bean gelato.', '', '2026-05-23 04:48:19'),
('item_pasta_01', 'Creamy Tuscan Alfredo Pasta with Mushroom', 'Mains', 1850.00, 1, 'Classic Italian-style fettuccine tossed in rich white alfredo creamy base, sautéed wild porcini mushrooms, parmigiano shavings, and fresh garlic croutons.', '', '2026-05-23 04:48:19'),
('item-1', 'Sri Lankan Spice Burger', 'Burgers', 1650.00, 1, 'Angus beef patty infused with native Ceylon cardamoms and black pepper, caramelized onions, curry leaf mayo.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-10', 'Gourmet Cardamom Watalappam', 'Desserts', 750.00, 1, 'Steamed coconut custard sweetened with authentic dark kitul jaggery syrup and roasted aromatic cashews.', 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1550.00, 1, 'Crispy devilled chicken thigh, spicy Lankan kochchi chili aioli, sliced red onions, and sweet banana pepper rings.', 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1850.00, 1, 'Freshly chopped parotta flatbread cooked on iron griddle with rich chicken curry gravy, vegetables, eggs, and dynamic cheddar melting.', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-4', 'Signature Pol Roti & Black Pork Curry', 'Rice & Mains', 1950.00, 1, '3 freshly baked rustic grated-coconut flatbreads served with gourmet slow-simmered rich Ceylon black pork curry.', 'https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-5', 'Aromatic Seafood Fried Rice', 'Rice & Mains', 2150.00, 1, 'Premium basmati wok-tossed with local fresh lagoon prawns, cuttlefish, organic egg, spring leeks, and chili paste.', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-6', 'Crispy Egg Hopper Basket', 'Sides', 520.00, 1, 'Lacy, bowl-shaped thin fermented rice flour pancakes (1 Egg Hopper + 2 Plains) served with spicy Katta Sambol.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-7', 'Cassava Fries with Chili Salt', 'Sides', 650.00, 1, 'Fried local manioc strips tossed in a fiery mixture of sea salt and dynamic crushed Ceylon Kochchi chili seasoning.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-8', 'Classic Sweet Royal Faluda', 'Beverages', 850.00, 1, 'Rose syrup milk beverage layered with soft basil seeds, vermicelli, vanilla ice cream scoop, and cashew nuts garnish.', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30'),
('item-9', 'Organic Woodapple Smoothie', 'Beverages', 680.00, 1, 'Chilled blended fresh local woodapple fruit pulp mixed with organic coconut water and a dash of sweet brown sugar syrup.', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=200', '2026-05-23 08:03:30');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `tax` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_mode` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `split_group_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `split_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cashier` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `timestamp`, `subtotal`, `tax`, `discount`, `total`, `payment_method`, `service_mode`, `table_id`, `split_group_id`, `split_label`, `cashier`, `created_at`) VALUES
('ORD-20260521-123011', '2026-05-22 07:00:00', 2400.00, 240.00, 0.00, 2640.00, 'Cash', 'Dine-In', NULL, NULL, NULL, 'System', '2026-05-23 08:03:30'),
('ORD-20260522-131544', '2026-05-23 07:45:00', 2050.00, 184.50, 205.00, 2029.50, 'Card', 'Takeaway', NULL, NULL, NULL, 'System', '2026-05-23 08:03:30'),
('ORD-20260522-194503', '2026-05-23 14:15:00', 5700.00, 570.00, 0.00, 6270.00, 'UPI', 'Dine-In', NULL, NULL, NULL, 'System', '2026-05-23 08:03:30'),
('ORD-20260524-150722', '2026-05-24 09:37:22', 5050.00, 505.00, 0.00, 5555.00, 'Cash', 'Dine-In', 'tbl_03', NULL, NULL, 'admin', '2026-05-24 09:37:22'),
('ORD-20260524-153832', '2026-05-24 10:08:32', 3400.00, 340.00, 0.00, 3740.00, 'Cash', 'Takeaway', NULL, NULL, NULL, 'admin', '2026-05-24 10:08:32'),
('ORD-20260524-153903', '2026-05-24 10:09:03', 3400.00, 340.00, 0.00, 3740.00, 'Cash', 'Dine-In', 'tbl_03', NULL, NULL, 'admin', '2026-05-24 10:09:03'),
('ORD-20260525-124242', '2026-05-25 07:12:42', 5050.00, 505.00, 0.00, 5555.00, 'Cash', 'Dine-In', 'tbl_03', NULL, NULL, 'admin', '2026-05-25 07:12:42');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_category` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=234 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `item_id`, `item_name`, `item_category`, `item_price`, `quantity`, `notes`) VALUES
(216, 'ORD-20260524-153903', 'item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1850.00, 1, ''),
(217, 'ORD-20260524-153903', 'item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1550.00, 1, ''),
(218, 'ORD-20260524-153832', 'item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1550.00, 1, ''),
(219, 'ORD-20260524-153832', 'item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1850.00, 1, ''),
(220, 'ORD-20260524-150722', 'item-1', 'Sri Lankan Spice Burger', 'Burgers', 1650.00, 1, ''),
(221, 'ORD-20260524-150722', 'item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1550.00, 1, ''),
(222, 'ORD-20260524-150722', 'item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1850.00, 1, ''),
(223, 'ORD-20260522-194503', 'item-5', 'Aromatic Seafood Fried Rice', 'Rice & Mains', 2150.00, 1, ''),
(224, 'ORD-20260522-194503', 'item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1850.00, 1, ''),
(225, 'ORD-20260522-194503', 'item-8', 'Classic Sweet Royal Faluda', 'Beverages', 850.00, 2, 'Less ice'),
(226, 'ORD-20260522-131544', 'item-6', 'Crispy Egg Hopper Basket', 'Sides', 520.00, 1, ''),
(227, 'ORD-20260522-131544', 'item-8', 'Classic Sweet Royal Faluda', 'Beverages', 850.00, 1, ''),
(228, 'ORD-20260522-131544', 'item-9', 'Organic Woodapple Smoothie', 'Beverages', 680.00, 1, 'Takeaway packing'),
(229, 'ORD-20260521-123011', 'item-1', 'Sri Lankan Spice Burger', 'Burgers', 1650.00, 1, 'No raw onions'),
(230, 'ORD-20260521-123011', 'item-10', 'Gourmet Cardamom Watalappam', 'Desserts', 750.00, 1, 'Low sweetness'),
(231, 'ORD-20260525-124242', 'item-1', 'Sri Lankan Spice Burger', 'Burgers', 1650.00, 1, ''),
(232, 'ORD-20260525-124242', 'item-2', 'Crispy Devilled Chicken Burger', 'Burgers', 1550.00, 1, ''),
(233, 'ORD-20260525-124242', 'item-3', 'Cheese Kottu Roti (Chicken)', 'Rice & Mains', 1850.00, 1, '');

-- --------------------------------------------------------

--
-- Table structure for table `recipe_ingredients`
--

DROP TABLE IF EXISTS `recipe_ingredients`;
CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` varchar(100) NOT NULL,
  `ingredient_id` varchar(50) NOT NULL,
  `quantity_required` decimal(10,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recipe_item_ing` (`item_id`,`ingredient_id`),
  KEY `ingredient_id` (`ingredient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `recipe_ingredients`
--

INSERT INTO `recipe_ingredients` (`id`, `item_id`, `ingredient_id`, `quantity_required`) VALUES
(1, 'item_burger_01', 'ing_chicken', 180.000),
(2, 'item_burger_01', 'ing_bun', 1.000),
(3, 'item_pasta_01', 'ing_pasta', 250.000),
(4, 'item_pasta_01', 'ing_cream', 120.000),
(5, 'item_beverage_01', 'ing_coffee', 18.000),
(6, 'item_dessert_01', 'ing_chocolate', 80.000),
(7, 'item-1', 'ing_chicken', 2.000);

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_config`
--

DROP TABLE IF EXISTS `restaurant_config`;
CREATE TABLE IF NOT EXISTS `restaurant_config` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_rate` decimal(5,4) NOT NULL DEFAULT '0.1000',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LKR',
  `currency_symbol` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Rs.',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `restaurant_config`
--

INSERT INTO `restaurant_config` (`id`, `name`, `address`, `phone`, `tax_rate`, `currency`, `currency_symbol`, `updated_at`) VALUES
('default', 'Gusto Ceylon Bistro', 'No. 45, Galle Road, Colombo 03, Sri Lanka', '+94 11 234 5678', 0.1000, 'LKR', 'Rs.', '2026-05-23 08:03:30');

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ingredient_id` varchar(50) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `type` enum('in','out','waste','correction') NOT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ingredient_id` (`ingredient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `stock_movements`
--

INSERT INTO `stock_movements` (`id`, `ingredient_id`, `quantity`, `type`, `reference_id`, `created_at`) VALUES
(1, 'ing_chocolate', 1.000, 'in', NULL, '2026-05-24 09:17:49'),
(2, 'ing_chicken', 2.000, 'out', 'ORD-20260524-150722', '2026-05-24 09:37:22'),
(3, 'ing_chicken', 2.000, 'out', 'ORD-20260525-124242', '2026-05-25 07:12:42');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('Admin','Cashier') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cashier',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`username`, `full_name`, `password`, `role`, `created_at`) VALUES
('admin', 'System Director', 'admin123', 'Admin', '2026-05-23 04:48:19'),
('cashier1', 'Anura Perera', '1234', 'Cashier', '2026-05-23 04:48:19'),
('cashier2', 'Dilini Silva', '4321', 'Cashier', '2026-05-23 04:48:19'),
('kavindumaleesha', 'Arsamarakkala Kavindu Maleesha', '$2a$10$2batdaG9sBUkrCVUBadlSe4lcV5FvG7MILuTPpeCsqndBGBkZd.bS', 'Cashier', '2026-05-23 09:51:59');

--
-- Constraints for dumped tables
--

--
-- Constraints for table `held_order_items`
--
ALTER TABLE `held_order_items`
  ADD CONSTRAINT `held_order_items_ibfk_1` FOREIGN KEY (`held_order_id`) REFERENCES `held_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `kitchen_ticket_items`
--
ALTER TABLE `kitchen_ticket_items`
  ADD CONSTRAINT `kitchen_ticket_items_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `kitchen_tickets` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `recipe_ingredients`
--
ALTER TABLE `recipe_ingredients`
  ADD CONSTRAINT `recipe_ingredients_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
