/**
 * Optimized Validation Middleware - Compact and efficient
 */

const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors.push(`${field} là bắt buộc`);
        continue;
      }
      
      if (value) {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} phải có ít nhất ${rules.minLength} ký tự`);
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} không được quá ${rules.maxLength} ký tự`);
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} không đúng định dạng`);
        }
        
        if (rules.isInteger && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
          errors.push(`${field} phải là số nguyên dương`);
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${field} phải là một trong: ${rules.enum.join(', ')}`);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors
      });
    }
    
    next();
  };
};

// Validation schemas
const schemas = {
  register: {
    username: { required: true, minLength: 3, maxLength: 50, pattern: /^[a-zA-Z0-9_]+$/ },
    password: { required: true, minLength: 6, maxLength: 100 },
    email: { maxLength: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    fullName: { maxLength: 255 }
  },
  
  login: {
    identifier: { required: true, maxLength: 255 },
    password: { required: true }
  },
  
  createPost: {
    content: { required: true, maxLength: 5000 }
  },
  
  createComment: {
    postId: { required: true, isInteger: true },
    content: { required: true, maxLength: 2000 }
  },
  
  createMessage: {
    receiverId: { required: true, isInteger: true },
    content: { required: true, maxLength: 1000 }
  },
  
  createReaction: {
    postId: { required: true, isInteger: true },
    reactionType: { required: true, enum: ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry'] }
  },
  
  createShare: {
    postId: { required: true, isInteger: true },
    note: { maxLength: 500 }
  },
  
  createRole: {
    roleName: { required: true, maxLength: 50, pattern: /^[a-zA-Z0-9_\s]+$/ },
    description: { maxLength: 255 }
  }
};

// Simple pagination validation
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page && (isNaN(page) || page < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Page phải là số nguyên dương'
    });
  }
  
  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Limit phải là số từ 1 đến 100'
    });
  }
  
  next();
};

// Search query validation
const validateSearchQuery = (req, res, next) => {
  const { query } = req.query;
  
  if (!query || query.length < 2 || query.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'Query tìm kiếm phải có từ 2-255 ký tự'
    });
  }
  
  next();
};

module.exports = {
  validate,
  schemas,
  validatePagination,
  validateSearchQuery
};