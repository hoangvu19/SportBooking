/**
 * Reaction Routes - API endpoints cho reactions (like, love, etc.)
 */
const express = require('express');
const router = express.Router();
const ReactionController = require('../../controllers/Social/reactionController');
const { authenticateToken } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// POST /api/reactions - create or update reaction
router.post('/', ReactionController.createOrUpdateReaction);

// GET /api/reactions/post/:postId - get reactions for a post
router.get('/post/:postId', ReactionController.getPostReactions);

// GET /api/reactions/post/:postId/counts - get reaction counts
router.get('/post/:postId/counts', ReactionController.getReactionCounts);

// GET /api/reactions/post/:postId/user - get user reaction for a post
router.get('/post/:postId/user', ReactionController.getUserReaction);

// DELETE /api/reactions/post/:postId - delete user's reaction
router.delete('/post/:postId', ReactionController.deleteReaction);

// GET /api/reactions/user - get all reactions by current user
router.get('/user', ReactionController.getUserReactions);

module.exports = router;
