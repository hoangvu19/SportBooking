/**
 * Simple Auth Routes for Testing
 */
const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getCurrentUser, 
  updateProfile, 
  changePassword, 
  searchUsers,
  forgotPassword
} = require('../controllers/Auth/authController');

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token không được cung cấp'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};

// Public routes with logging
router.post('/register', (req, res, next) => {
  console.log('🚀 Register endpoint hit:', req.body);
  next();
}, register);

router.post('/login', (req, res, next) => {
  console.log('🚀 Login endpoint hit:', req.body);
  next();
}, login);

router.post('/forgot-password', (req, res, next) => {
  console.log('🚀 Forgot password endpoint hit:', req.body);
  next();
}, forgotPassword);

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.json({ success: true, message: 'API is working!' });
});

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);
router.put('/profile', authenticateToken, updateProfile);
router.put('/password', authenticateToken, changePassword);
router.get('/search', authenticateToken, searchUsers);

module.exports = router;