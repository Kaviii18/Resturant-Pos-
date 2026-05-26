const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const pool = require('../config/db');

/**
 * GET /api/users
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT `username`, `full_name`, `role`, `created_at` FROM `users` ORDER BY `created_at` DESC'
    );
    res.status(200).json({ success: true, count: rows.length, users: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:username
 * Get single user by username (Admin only)
 */
const getUserByUsername = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT `username`, `full_name`, `role`, `created_at` FROM `users` WHERE `username` = ?',
      [req.params.username]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:username
 * Update a user (Admin only)
 */
const updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { fullName, password, role } = req.body;
    const { username } = req.params;

    const [existing] = await pool.query(
      'SELECT `username` FROM `users` WHERE `username` = ?',
      [username]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // Build dynamic update
    const fields = [];
    const values = [];

    if (fullName) { fields.push('`full_name` = ?'); values.push(fullName); }
    if (hashedPassword) { fields.push('`password` = ?'); values.push(hashedPassword); }
    if (role) { fields.push('`role` = ?'); values.push(role); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(username);
    await pool.query(`UPDATE \`users\` SET ${fields.join(', ')} WHERE \`username\` = ?`, values);

    res.status(200).json({ success: true, message: `User '${username}' updated successfully.` });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:username
 * Delete a user (Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { username } = req.params;

    // Prevent self-deletion
    if (req.user.username === username) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const [result] = await pool.query('DELETE FROM `users` WHERE `username` = ?', [username]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({ success: true, message: `User '${username}' deleted.` });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, getUserByUsername, updateUser, deleteUser };
