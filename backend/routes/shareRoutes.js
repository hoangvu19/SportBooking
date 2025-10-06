/**
 * Share Routes - API endpoints cho chia sẻ bài viết
 */
const express = require('express');
const router = express.Router();
const ShareController = require('../controllers/shareController');
const PostController = require('../controllers/postController');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Tất cả routes đều yêu cầu authentication
router.use(authenticateToken);

// POST /api/shares - Chia sẻ bài viết
// POST creates a share-post (a new Post marked as a share) and a Share record
router.post('/', validate(schemas.createShare), PostController.sharePost);

// GET /api/shares/post/:postId - Lấy danh sách shares của một post
router.get('/post/:postId', ShareController.getPostShares);

// GET /api/shares/post/:postId/count - Lấy số lượng shares của một post
router.get('/post/:postId/count', ShareController.getShareCount);

// GET /api/shares/post/:postId/check - Kiểm tra user đã share post chưa
router.get('/post/:postId/check', ShareController.checkUserShared);

// DELETE /api/shares/post/:postId - Hủy chia sẻ bài viết
router.delete('/post/:postId', ShareController.deleteShare);

// GET /api/shares/user - Lấy danh sách bài viết đã chia sẻ của user hiện tại
router.get('/user', ShareController.getUserShares);

module.exports = router;