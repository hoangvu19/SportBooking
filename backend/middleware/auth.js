/**
 * Authentication Middleware - Xử lý xác thực JWT và phân quyền
 */
const jwt = require('jsonwebtoken');
const AccountDAL = require('../DAL/Auth/accountDAL');
const Account = require('../models/Auth/account');
const AccountRoleModel = require('../models/Auth/AccountRole');

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// Simple in-memory cache for user data (5 minutes TTL)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware xác thực JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token không được cung cấp'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check cache first
    const cacheKey = `user_${decoded.AccountID}`;
    const cached = userCache.get(cacheKey);
    
    let user;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      user = cached.data;
    } else {
      // Get user info from database using AccountDAL
      user = await AccountDAL.getById(decoded.AccountID);
      
      if (user) {
        // Cache user data
        userCache.set(cacheKey, {
          data: user,
          timestamp: Date.now()
        });
      }
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Check if user is active
    const status = user.Status || (typeof user.isActive === 'function' ? (user.isActive() ? 'Active' : 'Inactive') : 'Active');
    
    if (status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Attach user info to request
    req.user = {
      userId: user.AccountID,      // Sử dụng userId để đồng nhất
      AccountID: user.AccountID,   // Giữ lại AccountID cho backward compatibility
      Username: user.Username,
      Email: user.Email,
      FullName: user.FullName,
      Status: status
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực'
    });
  }
};

/**
 * Middleware optional auth (không bắt buộc đăng nhập)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await AccountModel.findById(decoded.AccountID);
    
    if (user && user.Status === 'Active') {
      req.user = {
        AccountID: user.AccountID,
        Username: user.Username,
        Email: user.Email,
        FullName: user.FullName,
        Status: user.Status
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    req.user = null;
    next();
  }
};

/**
 * Middleware kiểm tra quyền admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    const hasAdminRole = await AccountRoleModel.hasRoleByName(req.user.AccountID, 'Admin');
    
    if (!hasAdminRole) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm tra quyền'
    });
  }
};

/**
 * Middleware kiểm tra quyền tùy chỉnh
 */
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      // Convert single role to array for consistent handling
      const roleArray = Array.isArray(roles) ? roles : [roles];
      
      // Check if user has any of the required roles
      let hasRequiredRole = false;
      for (const roleName of roleArray) {
        const hasRole = await AccountRoleModel.hasRoleByName(req.user.AccountID, roleName);
        if (hasRole) {
          hasRequiredRole = true;
          break;
        }
      }
      
      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          message: `Bạn cần có một trong các quyền sau để truy cập: ${roleArray.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error(`Role check error (${roles}):`, error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi kiểm tra quyền'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireRole
};