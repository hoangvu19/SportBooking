/**
 * Simple Auth Routes for Testing
 */
const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  requestLoginOtp,
  sendLoginCode,
  verifyLoginOtp,
  getCurrentUser, 
  updateProfile, 
  changePassword, 
  searchUsers,
  forgotPassword
} = require('../../controllers/Auth/authController');

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token not provided'
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
      message: 'Invalid token'
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

// OTP-based login (two-step)
router.post('/login-otp-request', (req, res, next) => {
  console.log('🚀 Login OTP request endpoint hit:', req.body && { identifier: req.body.identifier });
  next();
}, requestLoginOtp);

// Passwordless OTP: send login code to email only
router.post('/send-login-code', (req, res, next) => {
  console.log('🚀 Send login code endpoint hit:', req.body && { email: req.body.email });
  next();
}, sendLoginCode);

router.post('/verify-otp', (req, res, next) => {
  console.log('🚀 Verify OTP endpoint hit');
  next();
}, verifyLoginOtp);

router.post('/forgot-password', (req, res, next) => {
  console.log('🚀 Forgot password endpoint hit:', req.body);
  next();
}, forgotPassword);

// Activation endpoints removed (registrations create user immediately)

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
