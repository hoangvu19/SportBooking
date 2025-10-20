const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const notifications = require('../../lib/notifications');

// Get notifications for current user
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user?.AccountID || req.user?.id || req.user;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không xác định được người dùng' });
  }
  const list = notifications[userId] || [];
  res.json({ success: true, notifications: list });
});

// Mark all as read
router.post('/read-all', authenticateToken, (req, res) => {
  const userId = req.user?.AccountID || req.user?.id || req.user;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không xác định được người dùng' });
  }
  if (notifications[userId]) {
    notifications[userId].forEach(n => n.read = true);
  }
  res.json({ success: true });
});

module.exports = router;
