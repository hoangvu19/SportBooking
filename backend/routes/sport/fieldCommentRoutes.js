/**
 * Field Comment Routes
 * Routes for field comments (multiple comments per user allowed)
 */
const express = require('express');
const router = express.Router();
const fieldCommentController = require('../../controllers/Sport/fieldCommentController');
const { authenticateToken } = require('../../middleware/auth');

// Public routes - anyone can read comments for a target. Place less-generic routes after other fixed routes

// Protected routes - must be logged in to comment
router.use(authenticateToken);

// Create comment
router.post('/', fieldCommentController.createComment);

// Get user's own comments
router.get('/my-comments', fieldCommentController.getMyComments);

// Update comment (only owner)
router.put('/:commentId', fieldCommentController.updateComment);

// Delete comment (owner or admin)
router.delete('/:commentId', fieldCommentController.deleteComment);

// Public route - keep generic param route last so fixed paths like /my-comments do not get shadowed
router.get('/:targetType/:targetId', fieldCommentController.getComments);

module.exports = router;
