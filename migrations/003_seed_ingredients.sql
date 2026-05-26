-- Seed core raw materials (safe to re-run with INSERT IGNORE / ON DUPLICATE KEY)
USE `restaurant_pos`;

-- Works with reorder_level OR min_alert_level column (pick one that exists in your DB)
INSERT INTO `ingredients` (`id`, `name`, `unit`, `current_stock`, `min_alert_level`) VALUES
('ing_flour', 'Flour', 'kg', 25, 5),
('ing_chicken', 'Chicken', 'kg', 18, 4),
('ing_cheese', 'Cheese', 'kg', 8, 2),
('ing_rice', 'Rice', 'kg', 30, 6),
('ing_tomato', 'Tomato', 'kg', 12, 3),
('ing_onion', 'Onion', 'kg', 10, 2),
('ing_oil', 'Cooking Oil', 'L', 15, 3)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
