/**
 * Authentication Middleware - Xử lý xác thực JWT và phân quyền
 */
const jwt = require('jsonwebtoken');
const AccountDAL = require('../DAL/Auth/accountDAL');

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

    // If no token and header-based dev bypass is enabled, accept a dev header
    if (!token) {
      try {
        const headerRole = (req.headers['x-active-role'] || req.headers['X-Active-Role'] || '').toString().toLowerCase();
        const devAccountId = req.headers['x-dev-accountid'] || req.headers['X-Dev-AccountID'] || null;
        // Debug: log bypass attempt for local troubleshooting
        try { console.info('[auth] header-bypass check:', { headerRole, devAccountId, allowBypass: process.env.ALLOW_HEADER_ADMIN_BYPASS }); } catch(e) { /* ignore */ }
        // Allow header-based admin bypass when explicitly enabled OR when request is local (dev/test)
        const requesterIp = (req.ip || (req.connection && req.connection.remoteAddress) || '').toString();
        const isLocalRequest = requesterIp === '127.0.0.1' || requesterIp === '::1' || requesterIp.includes('::1');
        if (headerRole === 'admin' && (process.env.ALLOW_HEADER_ADMIN_BYPASS === 'true' || isLocalRequest)) {
          // Populate a minimal req.user so downstream handlers think this is an admin account
          req.user = {
            userId: devAccountId ? Number(devAccountId) : null,
            AccountID: devAccountId ? Number(devAccountId) : null,
            Username: 'dev-admin',
            Email: null,
            FullName: 'Dev Admin',
            Status: 'Active',
            Roles: [{ RoleName: 'Admin' }],
            _roleNamesLower: ['admin'],
            isAdmin: true
          };
          if (process.env.DEBUG_AUTH === 'true') {
            console.warn('[auth] ALLOW_HEADER_ADMIN_BYPASS granted req.user (dev)');
          }
          return next();
        }
      } catch (bypassErr) {
        console.error('[auth] header bypass parse error:', bypassErr);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token không được cung cấp'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Extra debug when enabled
    try {
      if (process.env.DEBUG_AUTH === 'true') {
        console.debug('[auth] Decoded JWT payload:', decoded);
        console.debug('[auth] Using cacheKey:', `user_${decoded.AccountID}`);
      }
    } catch (dbgErr) { /* ignore */ }
    
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
    // Normalize roles array if provided by AccountDAL (may be array of objects with RoleName)
    const rolesArr = Array.isArray(user.Roles) ? user.Roles : [];
    const roleNames = rolesArr.map(r => (r.RoleName || r.roleName || '').toString().toLowerCase());

    req.user = {
      userId: user.AccountID,      // Sử dụng userId để đồng nhất
      AccountID: user.AccountID,   // Giữ lại AccountID cho backward compatibility
      Username: user.Username,
      Email: user.Email,
      FullName: user.FullName,
      Status: status,
      Roles: rolesArr,
      _roleNamesLower: roleNames,
      isAdmin: roleNames.includes('admin')
    };

    // DEBUG: log resolved account and role names to help trace permission issues (temporary)
    // By default we DO NOT print full AccountID/Username to terminal to avoid leaking PII.
    // Enable detailed auth logs only when DEBUG_AUTH=true in environment (for local debugging).
    try {
      if (process.env.DEBUG_AUTH === 'true') {
        // Masking helper: show first and last char of username, mask middle; hide AccountID
        const maskUsername = (u) => {
          if (!u) return '';
          const s = String(u);
          if (s.length <= 2) return '*'.repeat(s.length);
          return s[0] + '*'.repeat(Math.max(1, s.length - 2)) + s[s.length - 1];
        };

        const maskedUsername = maskUsername(user.Username);
        // Do not print raw AccountID; show placeholder to indicate presence
        console.info(`[auth] Account=${'***'} Username=${maskedUsername} Roles=${roleNames.join(',')}`);
        try {
          console.debug('[auth] Full user object (DEBUG_AUTH):', user);
        } catch { /* ignore */ }
      }
    } catch (logErr) {
      // ignore logging errors
    }

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
      // First, try to check roles from req.user if available (populated by authenticateToken)
      if (req.user && Array.isArray(req.user.Roles) && req.user.Roles.length > 0) {
        const lowerRequired = roleArray.map(r => r.toString().toLowerCase());
        const userRoleNames = (req.user._roleNamesLower || []).slice();

        // flexible matching: exact or substring match (e.g., 'owner' matches 'court owner')
        const matched = lowerRequired.some(reqRole => userRoleNames.some(ur => ur === reqRole || ur.includes(reqRole) || reqRole.includes(ur)));
        if (matched) return next();
      }

      // Fallback: fetch roles from DB and perform flexible matching (case-insensitive, substring)
      let hasRequiredRole = false;
      try {
        const dbRoles = await AccountRoleModel.getAccountRoles(req.user.AccountID);
        const dbRoleNames = (dbRoles || []).map(r => (r.RoleName || r.roleName || '').toString().toLowerCase());
        const lowerRequired = roleArray.map(r => r.toString().toLowerCase());

        const matched = lowerRequired.some(reqRole => dbRoleNames.some(dr => dr === reqRole || dr.includes(reqRole) || reqRole.includes(dr)));
        if (matched) hasRequiredRole = true;
      } catch (dbErr) {
        // If DB fetch fails for some reason, fall back to the original exact-match check
        for (const roleName of roleArray) {
          const hasRole = await AccountRoleModel.hasRoleByName(req.user.AccountID, roleName);
          if (hasRole) {
            hasRequiredRole = true;
            break;
          }
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