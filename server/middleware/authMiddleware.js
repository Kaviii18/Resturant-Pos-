const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware: Verify JWT token from Authorization header
 * Attaches decoded user payload to req.user
 */
const protect = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

/**
 * Middleware: Restrict route to specific roles only
 * Usage: authorize('Admin') or authorize('Admin', 'Cashier')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. No user context found.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Requires one of: ${roles.join(', ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
