/**
 * Field Comment Routes
 * Routes for field comments (multiple comments per user allowed)
 */
const express = require('express');
const router = express.Router();
const fieldCommentController = require('../../controllers/Sport/fieldCommentController');
const { authenticateToken } = require('../../middleware/auth');

// Public routes - anyone can read comments
router.get('/:targetType/:targetId', fieldCommentController.getComments);

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

module.exports = router;
