const errorHandler = (err, req, res, next) => {
  // Sanitize error logs to avoid leaking PII or large payloads in terminal.
  try {
    const ts = (function(){ try { const vn = require('../utils/vnTime'); return vn.toVnIso(); } catch(e) { return new Date().toISOString().replace('Z', '+07:00'); } })();
    const shortStack = err.stack ? err.stack.split('\n').slice(0,2).join(' | ') : null;
    const errorId = Math.random().toString(36).slice(2,9);
    console.error(`[${ts}] [errorId:${errorId}] Error: ${err.message} (${req.method} ${req.url})`, shortStack ? `stack:${shortStack}` : '');
    // For advanced debugging, full error can be retrieved using the errorId in logs storage (not printed here).
  } catch (logErr) {
    // Fallback minimal log
    console.error('Error occurred (logging failed):', err.message);
  }


  let error = {
    success: false,
    message: 'Đã có lỗi xảy ra'
  };


  if (err.name === 'ValidationError') {
    error.message = 'Dữ liệu không hợp lệ';
    error.details = err.message;
    return res.status(400).json(error);
  }

  if (err.name === 'CastError') {
    error.message = 'ID không hợp lệ';
    return res.status(400).json(error);
  }

  if (err.code === 11000) {
    error.message = 'Dữ liệu đã tồn tại';
    return res.status(400).json(error);
  }

  if (err.name === 'JsonWebTokenError') {
    error.message = 'Token không hợp lệ';
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token đã hết hạn';
    return res.status(401).json(error);
  }

  // SQL Server specific errors
  if (err.number) {
    switch (err.number) {
      case 2: // Cannot open database
        error.message = 'Không thể kết nối database';
        return res.status(500).json(error);
      
      case 18456: // Login failed
        error.message = 'Lỗi xác thực database';
        return res.status(500).json(error);
      
      case 2627: // Violation of PRIMARY KEY constraint
      case 2601: // Cannot insert duplicate key
        error.message = 'Dữ liệu đã tồn tại';
        return res.status(400).json(error);
      
      case 547: // Foreign key constraint
        error.message = 'Dữ liệu tham chiếu không hợp lệ';
        return res.status(400).json(error);
      
      case 515: // Cannot insert NULL
        error.message = 'Thiếu thông tin bắt buộc';
        return res.status(400).json(error);
      
      default:
        error.message = 'Lỗi database';
        return res.status(500).json(error);
    }
  }

  // Handle custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // Default to 500 server error
  res.status(500).json(error);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.url} không tồn tại`
  });
};

/**
 * Async error wrapper - Wrap async functions to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Rate limiting error handler
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau'
  });
};

/**
 * Request timeout handler
 */
const timeoutHandler = (req, res) => {
  res.status(408).json({
    success: false,
    message: 'Yêu cầu đã hết thời gian chờ'
  });
};

/**
 * Body parser error handler
 */
const bodyParserErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON không hợp lệ'
    });
  }
  next(err);
};

/**
 * CORS error handler
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS không được phép'
    });
  }
  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  rateLimitHandler,
  timeoutHandler,
  bodyParserErrorHandler,
  corsErrorHandler
};