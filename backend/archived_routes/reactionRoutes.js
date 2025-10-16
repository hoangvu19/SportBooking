/**
 * Reaction Routes - API endpoints cho reactions (like, love, etc.)
 */
const express = require('express');
const router = express.Router();
const ReactionController = require('../controllers/Social/reactionController');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Tất cả routes đều yêu cầu authentication
router.use(authenticateToken);

// POST /api/reactions - Tạo hoặc cập nhật reaction
router.post('/', ReactionController.createOrUpdateReaction);

// GET /api/reactions/post/:postId - Lấy reactions của một post
router.get('/post/:postId', ReactionController.getPostReactions);

// GET /api/reactions/post/:postId/counts - Lấy số lượng reactions theo loại
router.get('/post/:postId/counts', ReactionController.getReactionCounts);

// GET /api/reactions/post/:postId/user - Lấy reaction của user cho một post
router.get('/post/:postId/user', ReactionController.getUserReaction);

// DELETE /api/reactions/post/:postId - Xóa reaction của user cho một post
router.delete('/post/:postId', ReactionController.deleteReaction);

// GET /api/reactions/user - Lấy tất cả reactions của user hiện tại
router.get('/user', ReactionController.getUserReactions);

module.exports = router;