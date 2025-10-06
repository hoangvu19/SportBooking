/**
 * Message Routes - API endpoints cho messages
 */
const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Send message
router.post('/', MessageController.sendMessage);

// Get conversation with a user
router.get('/conversation/:userId', MessageController.getConversation);

// Health check for messages DB objects (non-destructive)
router.get('/health', async (req, res) => {
	try {
		const { poolPromise, sql } = require('../config/db');
		const pool = await poolPromise;
		const result = await pool.request()
			.input('tableName', sql.NVarChar(200), 'MessageImage')
			.query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName`);

		res.json({ success: true, exists: result.recordset.length > 0, tables: result.recordset });
	} catch (err) {
		console.error('Message health check error:', err);
		res.status(500).json({ success: false, message: 'DB health check failed', error: err.message });
	}
});

// Get all conversations
router.get('/conversations', MessageController.getConversations);

// Mark message as read
router.put('/:messageId/read', MessageController.markAsRead);

// Mark all messages in conversation as read
router.put('/conversation/:userId/read-all', MessageController.markAsRead);

// Get unread count
router.get('/unread-count', MessageController.getConversations);

// Delete message
router.delete('/:messageId', MessageController.deleteMessage);

module.exports = router;