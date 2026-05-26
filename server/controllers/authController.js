const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/db');
require('dotenv').config();

// ── In-memory login attempt tracker (per username, resets on success) ─────────
// Map: username → { count, lockedUntil }
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

function getAttemptInfo(username) {
  return loginAttempts.get(username.toLowerCase()) || { count: 0, lockedUntil: null };
}

function recordFailedAttempt(username) {
  const key = username.toLowerCase();
  const info = getAttemptInfo(username);
  info.count += 1;
  if (info.count >= MAX_ATTEMPTS) {
    info.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }
  loginAttempts.set(key, info);
}

function resetAttempts(username) {
  loginAttempts.delete(username.toLowerCase());
}

function isLocked(username) {
  const info = getAttemptInfo(username);
  if (!info.lockedUntil) return false;
  if (Date.now() > info.lockedUntil) {
    // Lock expired — reset
    loginAttempts.delete(username.toLowerCase());
    return false;
  }
  return true;
}

function remainingLockMinutes(username) {
  const info = getAttemptInfo(username);
  if (!info.lockedUntil) return 0;
  return Math.ceil((info.lockedUntil - Date.now()) / 60000);
}

// ── Token generator ────────────────────────────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    {
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    // 1. Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { username, password } = req.body;

    // 2. Check if account is temporarily locked
    if (isLocked(username)) {
      const mins = remainingLockMinutes(username);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
        locked: true,
        remainingMinutes: mins,
      });
    }

    // 3. Fetch user from DB
    const [rows] = await pool.query(
      'SELECT * FROM `users` WHERE `username` = ?',
      [username.trim()]
    );

    if (rows.length === 0) {
      recordFailedAttempt(username);
      const info = getAttemptInfo(username);
      const remaining = MAX_ATTEMPTS - info.count;
      return res.status(401).json({
        success: false,
        message: remaining > 0
          ? `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
          : 'Invalid username or password. Account is now locked for 10 minutes.',
        attemptsRemaining: Math.max(0, remaining),
      });
    }

    const user = rows[0];

    // 4. Verify password (support bcrypt hash and plain-text legacy seeds)
    let isMatch = false;
    if (user.password && user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
    }

    if (!isMatch) {
      recordFailedAttempt(username);
      const info = getAttemptInfo(username);
      const remaining = MAX_ATTEMPTS - info.count;
      return res.status(401).json({
        success: false,
        message: remaining > 0
          ? `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
          : 'Invalid username or password. Account is now locked for 10 minutes.',
        attemptsRemaining: Math.max(0, remaining),
      });
    }

    // 5. Success — reset attempt counter and issue JWT
    resetAttempts(username);
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.full_name}!`,
      token,
      user: {
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Public — anyone can register as Cashier.
// Only an existing Admin JWT can register another Admin.
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    // 1. Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { username, fullName, password, role } = req.body;
    const requestedRole = role || 'Cashier';

    // 2. If requesting Admin role, require a valid Admin JWT
    if (requestedRole === 'Admin') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(403).json({
          success: false,
          message: 'Creating an Admin account requires an existing Admin to be logged in.',
        });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'Admin') {
          return res.status(403).json({
            success: false,
            message: 'Only an Admin can register another Admin account.',
          });
        }
      } catch {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token. Please log in as Admin first.',
        });
      }
    }

    // 3. Check username uniqueness
    const [existing] = await pool.query(
      'SELECT `username` FROM `users` WHERE `username` = ?',
      [username.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Username "${username}" is already taken. Please choose another.`,
      });
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Insert user
    await pool.query(
      'INSERT INTO `users` (`username`, `full_name`, `password`, `role`) VALUES (?, ?, ?, ?)',
      [username.trim().toLowerCase(), fullName.trim(), hashedPassword, requestedRole]
    );

    res.status(201).json({
      success: true,
      message: `Account for "${fullName.trim()}" created successfully.`,
      user: { username: username.trim().toLowerCase(), fullName: fullName.trim(), role: requestedRole },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — Returns current user from JWT
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT `username`, `full_name`, `role`, `created_at` FROM `users` WHERE `username` = ?',
      [req.user.username]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const [rows] = await pool.query('SELECT * FROM `users` WHERE `username` = ?', [req.user.username]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];
    let isMatch = user.password.startsWith('$2')
      ? await bcrypt.compare(currentPassword, user.password)
      : currentPassword === user.password;

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE `users` SET `password` = ? WHERE `username` = ?', [hashed, req.user.username]);

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, getMe, changePassword };
