const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getSentNotifications,
  deleteSentNotification,
  deleteSentNotificationGroup,
} = require('../../controllers/Notification/notificationController');

const { broadcastNotification } = require('../../controllers/Notification/notificationController');

// Get notifications for current user (with pagination)
router.get('/', authenticateToken, getNotifications);

// Get unread notification count
router.get('/unread-count', authenticateToken, getUnreadCount);

// Mark a specific notification as read
router.put('/:notificationId/read', authenticateToken, markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticateToken, markAllAsRead);

// Delete a notification
router.delete('/:notificationId', authenticateToken, deleteNotification);

// Admin: broadcast a notification to all users
router.post('/broadcast', authenticateToken, requireAdmin, broadcastNotification);

// Admin: list notifications sent by current admin
router.get('/sent', authenticateToken, requireAdmin, getSentNotifications);

// Admin: delete a sent notification by id
router.delete('/sent/:notificationId', authenticateToken, requireAdmin, deleteSentNotification);

// Admin: delete a grouped sent notification (delete all recipients for same content+type)
router.post('/sent/delete-group', authenticateToken, requireAdmin, deleteSentNotificationGroup);

module.exports = router;
