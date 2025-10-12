const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const os = require('os');

// Configure multer to store uploaded files in OS temp dir first
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ========== PUBLIC ROUTES (Không cần auth) ==========

/**
 * GET /api/users/search?q=keyword&limit=20
 * Tìm kiếm users
 */
router.get('/search', UserController.searchUsers);

// ========== PROTECTED ROUTES (Cần auth) ==========
// NOTE: Các route cụ thể phải đặt TRƯỚC route /:userId

/**
 * GET /api/users/suggestions
 * Lấy gợi ý kết bạn
 */
router.get('/suggestions', authenticateToken, UserController.getSuggestions);

/**
 * GET /api/users/followers
 * Lấy danh sách followers của user hiện tại
 */
router.get('/followers', authenticateToken, UserController.getFollowers);

/**
 * GET /api/users/following
 * Lấy danh sách following của user hiện tại
 */
router.get('/following', authenticateToken, UserController.getFollowing);

/**
 * POST /api/users/follow/:userId
 * Follow một user
 */
router.post('/follow/:userId', authenticateToken, UserController.followUser);

/**
 * DELETE /api/users/unfollow/:userId
 * Unfollow một user
 */
router.delete('/unfollow/:userId', authenticateToken, UserController.unfollowUser);

// ========== PUBLIC & PARAM ROUTES ==========
// NOTE: Route /:userId phải đặt CUỐI CÙNG

/**
 * GET /api/users/:userId
 * Lấy thông tin profile user
 */
router.get('/:userId', UserController.getUserProfile);

/**
 * GET /api/users/:userId/posts
 * Lấy bài viết của user
 */
router.get('/:userId/posts', UserController.getUserPosts);

/**
 * GET /api/users/:userId/likes
 * Lấy danh sách bài viết user đã like
 */
router.get('/:userId/likes', UserController.getUserLikedPosts);

/**
 * PUT /api/users/:userId
 * Cập nhật profile
 */
router.put('/:userId', authenticateToken, UserController.updateProfile);

/**
 * POST /api/users/:userId/avatar
 * Upload avatar image (multipart/form-data)
 */
router.post('/:userId/avatar', authenticateToken, upload.single('avatar'), UserController.uploadAvatar);

module.exports = router;
