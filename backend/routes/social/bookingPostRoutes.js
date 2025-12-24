/**
 * Booking Post Routes
 * Routes cho bài đăng "đã đặt sân"
 */
const express = require('express');
const router = express.Router();
const bookingPostController = require('../../controllers/Social/bookingPostController');
const { authenticateToken } = require('../../middleware/auth');
const { uploadPostImage } = require('../../middleware/uploadPostImage');

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Tạo bài đăng "đã đặt sân" (hỗ trợ multipart/form-data với trường 'image')
router.post('/', uploadPostImage, bookingPostController.createBookingPost);

// Lấy bài đăng theo môn thể thao
router.get('/sport/:sportTypeId', bookingPostController.getPostsBySportType);

// Lấy thông tin bài đăng booking
router.get('/:postId', bookingPostController.getBookingPost);

// Thêm người chơi vào bài đăng
router.post('/:postId/players', bookingPostController.addPlayerFromComment);

// Lấy danh sách người chơi
router.get('/:postId/players', bookingPostController.getPlayers);

// Chấp nhận lời mời
router.post('/:postId/accept', bookingPostController.acceptInvitation);

// Từ chối lời mời
router.post('/:postId/reject', bookingPostController.rejectInvitation);

module.exports = router;
