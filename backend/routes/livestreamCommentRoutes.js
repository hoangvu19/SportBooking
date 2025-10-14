const express = require('express');
const router = express.Router({ mergeParams: true });
const LivestreamCommentController = require('../controllers/Livestream/livestreamCommentController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/livestreams/:id/comments
router.get('/', LivestreamCommentController.listComments);
// POST /api/livestreams/:id/comments
router.post('/', authenticateToken, LivestreamCommentController.createComment);

module.exports = router;
