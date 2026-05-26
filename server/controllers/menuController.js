const { validationResult } = require('express-validator');
const pool = require('../config/db');

/**
 * GET /api/menu
 * Get all menu items, optionally filtered by category
 */
const getAllMenuItems = async (req, res, next) => {
  try {
    const { category, available } = req.query;

    let query = 'SELECT * FROM `menu_items`';
    const params = [];
    const conditions = [];

    if (category) {
      conditions.push('`category` = ?');
      params.push(category);
    }

    if (available !== undefined) {
      conditions.push('`is_available` = ?');
      params.push(available === 'true' ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY `category`, `name`';

    const [rows] = await pool.query(query, params);
    res.status(200).json({ success: true, count: rows.length, menuItems: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/menu/:id
 * Get single menu item by ID
 */
const getMenuItemById = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM `menu_items` WHERE `id` = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }
    res.status(200).json({ success: true, menuItem: rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/menu
 * Create a new menu item (Admin only)
 */
const createMenuItem = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id, name, category, price, isAvailable, description, imageUrl } = req.body;

    // Check if ID already exists
    const [existing] = await pool.query('SELECT `id` FROM `menu_items` WHERE `id` = ?', [id]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `Menu item with ID '${id}' already exists.` });
    }

    await pool.query(
      'INSERT INTO `menu_items` (`id`, `name`, `category`, `price`, `is_available`, `description`, `image_url`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, category || 'General', price, isAvailable !== false ? 1 : 0, description || '', imageUrl || '']
    );

    res.status(201).json({
      success: true,
      message: `Menu item '${name}' created successfully.`,
      menuItem: { id, name, category, price, isAvailable, description, imageUrl },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/menu/:id
 * Update a menu item (Admin only)
 */
const updateMenuItem = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { name, category, price, isAvailable, description, imageUrl } = req.body;

    const [existing] = await pool.query('SELECT `id` FROM `menu_items` WHERE `id` = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    await pool.query(
      `INSERT INTO \`menu_items\` (\`id\`, \`name\`, \`category\`, \`price\`, \`is_available\`, \`description\`, \`image_url\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`name\` = VALUES(\`name\`),
         \`category\` = VALUES(\`category\`),
         \`price\` = VALUES(\`price\`),
         \`is_available\` = VALUES(\`is_available\`),
         \`description\` = VALUES(\`description\`),
         \`image_url\` = VALUES(\`image_url\`)`,
      [id, name, category || 'General', price, isAvailable !== false ? 1 : 0, description || '', imageUrl || '']
    );

    res.status(200).json({ success: true, message: `Menu item '${name}' updated successfully.` });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/menu/:id
 * Delete a menu item (Admin only)
 */
const deleteMenuItem = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM `menu_items` WHERE `id` = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    res.status(200).json({ success: true, message: 'Menu item deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/menu/categories/list
 * Get all distinct categories
 */
const getCategories = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT `category` FROM `menu_items` ORDER BY `category`'
    );
    const categories = rows.map((r) => r.category);
    res.status(200).json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllMenuItems, getMenuItemById, createMenuItem, updateMenuItem, deleteMenuItem, getCategories };
