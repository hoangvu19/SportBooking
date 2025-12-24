const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const moderationController = require('../../controllers/Moderation/moderationController');

router.post('/warn', authenticateToken, moderationController.warnUser);

module.exports = router;
