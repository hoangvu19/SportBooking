/**
 * Comment Routes - API endpoints cho comments
 */
const express = require('express');
const router = express.Router();
const CommentController = require('../controllers/commentController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const os = require('os');

// reuse multer temp storage with same limits as users
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Get comments for a post
router.get('/post/:postId', optionalAuth, CommentController.getCommentsByPost);

// Create new comment (supports multiple images)
router.post('/', authenticateToken, upload.array('images', 4), CommentController.createComment);

// Get comment by ID
router.get('/:commentId', optionalAuth, CommentController.getCommentById);

// Update comment
router.put('/:commentId', authenticateToken, CommentController.updateComment);

// Delete comment
router.delete('/:commentId', authenticateToken, CommentController.deleteComment);

// Get comment count for a post
router.get('/post/:postId/count', CommentController.getCommentsByPost);

module.exports = router;