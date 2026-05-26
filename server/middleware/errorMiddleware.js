/**
 * Global error handling middleware
 * Must be registered LAST in server.js (after all routes)
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Server Error:', err.stack || err.message);

  // MySQL duplicate entry error
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry — this record already exists.',
      error: err.sqlMessage || err.message,
    });
  }

  // MySQL missing table
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({
      success: false,
      message: `Database table missing: ${err.sqlMessage || err.message}. Restart the backend or run migrations/002_production_features.sql.`,
      code: err.code,
    });
  }

  // MySQL unknown column (migration ALTER not applied)
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(503).json({
      success: false,
      message: `Database column missing: ${err.sqlMessage || err.message}. Restart the backend to auto-apply columns.`,
      code: err.code,
    });
  }

  // MySQL foreign key constraint error
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(409).json({
      success: false,
      message: 'Database constraint error — related record does not exist or is still referenced.',
      error: err.sqlMessage || err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired. Please log in again.',
    });
  }

  // Generic/unhandled server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found middleware — catch unregistered routes
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFound };
