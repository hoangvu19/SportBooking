/**
 * Share Routes - API endpoints for shares
 */
const express = require('express');
const router = express.Router();
const ShareController = require('../../controllers/Social/shareController');
const PostController = require('../../controllers/Social/postController');
const { authenticateToken } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// POST /api/shares - create a share-post
router.post('/', validate(schemas.createShare), PostController.sharePost);

// GET /api/shares/post/:postId - get shares of a post
router.get('/post/:postId', ShareController.getPostShares);

// GET /api/shares/post/:postId/count - get share count
router.get('/post/:postId/count', ShareController.getShareCount);

// GET /api/shares/post/:postId/check - check if user shared
router.get('/post/:postId/check', ShareController.checkUserShared);

// DELETE /api/shares/post/:postId - delete share
router.delete('/post/:postId', ShareController.deleteShare);

// GET /api/shares/user - get user shares
router.get('/user', ShareController.getUserShares);

module.exports = router;
