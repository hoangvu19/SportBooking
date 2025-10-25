/**
 * BookingPost Controller - OPTIMIZED VERSION
 * Xử lý các bài đăng "đã đặt sân"
 * 
 * THAY ĐỔI:
 * - Sử dụng Post table với BookingID thay vì bảng BookingPost riêng
 * - Queries now use explicit JOINs across Post/Booking/SportField/Facility/Account so a separate DB view is not required
 * - Đơn giản hóa logic, giảm số queries
 */
const BookingPost = require('../../models/Social/BookingPost');
const BookingModel = require('../../models/Sport/Booking');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized
} = require('../../utils/responseHelper');
const {
  isBlank,
  getAccountId,
  ensurePositiveInteger
} = require('../../utils/requestUtils');

/**
 * Tạo bài đăng "đã đặt sân"
 * Chỉ tạo được sau khi đã thanh toán cọc
 * OPTIMIZED: Sử dụng 1 method thay vì 2 bước (Post + BookingPost)
 */
async function createBookingPost(req, res) {
  try {
    const { bookingId, content, sportTypeId, maxPlayers, imageUrls } = req.body;
    const accountId = getAccountId(req);

    if (!accountId) {
      return sendUnauthorized(res, 'Please log in');
    }

    const bookingCheck = ensurePositiveInteger(bookingId, 'bookingId');
    if (!bookingCheck.ok) {
      return sendValidationError(res, bookingCheck.message);
    }

    if (isBlank(content)) {
      return sendValidationError(res, 'Post content must not be empty');
    }

    // Kiểm tra booking đã có bài đăng chưa
    const existingPost = await BookingPost.getByBookingId(bookingCheck.value);
    if (existingPost) {
      return sendValidationError(res, 'This booking already has a post');
    }

    // ✅ OPTIMIZED: Chỉ 1 method thay vì 2 bước
    // Model sẽ tự verify booking, deposit, và tạo post trong 1 transaction
    // If a file was uploaded via multer (field name 'image'), expose URL
    let imagesToSave = Array.isArray(imageUrls) ? imageUrls : [];
    if (req.file && req.file.filename) {
      // Build URL path that the frontend can access via /uploads
      const imageUrl = `/uploads/posts/${req.file.filename}`;
      imagesToSave = [...imagesToSave, imageUrl];
    }

    const result = await BookingPost.createBookingPost({
      accountId,
      bookingId: bookingCheck.value,
      content: content.trim(),
      sportTypeId,
      maxPlayers: maxPlayers || 10,
      images: imagesToSave
    });

    // Lấy thông tin đầy đủ từ View (bao gồm thông tin booking, field, facility)
    const fullBookingPost = await BookingPost.getById(result.postId);

    return sendCreated(res, {
      bookingPost: fullBookingPost,
      PostID: result.postId
    }, 'Booking post created successfully');
  } catch (error) {
    console.error('Create booking post error:', error);
    
    // Handle specific errors
    if (error.message.includes('not found')) {
      return sendNotFound(res, 'Booking not found');
    }
    if (error.message.includes('deposit')) {
      return sendValidationError(res, 'Booking post can only be created after deposit payment');
    }
    
    return sendError(res, 'Server error creating booking post', 500, { error: error.message });
  }
}

/**
 * Thêm người chơi từ comment vào bài đăng
 */
async function addPlayerFromComment(req, res) {
  try {
    const { postId } = req.params;
    const { playerId, commentId } = req.body;
    const accountId = getAccountId(req);

    if (!accountId) {
      return sendUnauthorized(res, 'Please log in');
    }

    const postCheck = ensurePositiveInteger(postId, 'postId');
    const playerCheck = ensurePositiveInteger(playerId, 'playerId');

    if (!postCheck.ok || !playerCheck.ok) {
      return sendValidationError(res, 'Invalid ID');
    }

    // Kiểm tra bài đăng có phải là booking post không
    const bookingPost = await BookingPost.getByPostId(postCheck.value);
    if (!bookingPost) {
      return sendNotFound(res, 'Booking post not found');
    }

    // Kiểm tra người thêm có phải chủ bài đăng không
    const post = await PostDAL.getById(postCheck.value);
    if (!post || post.AccountID !== accountId) {
      return sendUnauthorized(res, 'Only the post owner can add players');
    }

    // Kiểm tra số lượng người chơi
    if (bookingPost.CurrentPlayers >= bookingPost.MaxPlayers) {
      return sendValidationError(res, 'Player limit reached');
    }

    // Thêm người chơi
    const result = await BookingPost.addPlayer(postCheck.value, playerCheck.value, 'Pending');

    if (result.success) {
      // TODO: Send notification to invited player
      return sendSuccess(res, result, 'Player invited successfully');
    } else {
      return sendValidationError(res, result.message);
    }
  } catch (error) {
    console.error('Add player error:', error);
    return sendError(res, 'Server error adding player', 500, { error });
  }
}

/**
 * Chấp nhận lời mời tham gia
 */
async function acceptInvitation(req, res) {
  try {
    const { postId } = req.params;
    const accountId = getAccountId(req);

    if (!accountId) {
      return sendUnauthorized(res, 'Please log in');
    }

    const postCheck = ensurePositiveInteger(postId, 'postId');
    if (!postCheck.ok) {
      return sendValidationError(res, postCheck.message);
    }

    const result = await BookingPost.acceptInvitation(postCheck.value, accountId);

    if (result.success) {
      return sendSuccess(res, result, 'Invitation accepted');
    } else {
      return sendValidationError(res, result.message);
    }
  } catch (error) {
    console.error('Accept invitation error:', error);
    return sendError(res, 'Server error accepting invitation', 500, { error });
  }
}

/**
 * Từ chối lời mời tham gia
 */
async function rejectInvitation(req, res) {
  try {
    const { postId } = req.params;
    const accountId = getAccountId(req);

    if (!accountId) {
      return sendUnauthorized(res, 'Please log in');
    }

    const postCheck = ensurePositiveInteger(postId, 'postId');
    if (!postCheck.ok) {
      return sendValidationError(res, postCheck.message);
    }

    const result = await BookingPost.rejectInvitation(postCheck.value, accountId);

    if (result.success) {
      return sendSuccess(res, result, 'Invitation rejected');
    } else {
      return sendValidationError(res, result.message);
    }
  } catch (error) {
    console.error('Reject invitation error:', error);
    return sendError(res, 'Server error rejecting invitation', 500, { error });
  }
}

/**
 * Lấy danh sách người chơi
 */
async function getPlayers(req, res) {
  try {
    const { postId } = req.params;

    const postCheck = ensurePositiveInteger(postId, 'postId');
    if (!postCheck.ok) {
      return sendValidationError(res, postCheck.message);
    }

    const players = await BookingPost.getPlayers(postCheck.value);

    return sendSuccess(res, { players }, 'Players list retrieved successfully');
  } catch (error) {
    console.error('Get players error:', error);
    return sendError(res, 'Server error getting players', 500, { error });
  }
}

/**
 * Lấy bài đăng theo môn thể thao
 * Note: The implementation uses join-based queries; an optional view `vw_BookingPosts` is available in the repo for performance reference but is not required.
 */
async function getPostsBySportType(req, res) {
  try {
    const { sportTypeId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const sportCheck = ensurePositiveInteger(sportTypeId, 'sportTypeId');
    if (!sportCheck.ok) {
      return sendValidationError(res, sportCheck.message);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

  // Query uses join-based SQL to fetch booking + post + owner + field/facility details
    const posts = await BookingPost.getBySportType(
      sportCheck.value,
      limitNum,
      offset
    );

    return sendSuccess(res, {
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: posts.length
      }
    }, 'Posts retrieved successfully');
  } catch (error) {
    console.error('Get posts by sport type error:', error);
    return sendError(res, 'Server error getting posts', 500, { error: error.message });
  }
}

/**
 * Lấy thông tin bài đăng booking
 * Note: Uses join-based query to return booking + post + owner + field/facility details
 */
async function getBookingPost(req, res) {
  try {
    const { postId } = req.params;

    const postCheck = ensurePositiveInteger(postId, 'postId');
    if (!postCheck.ok) {
      return sendValidationError(res, postCheck.message);
    }

    // ✅ OPTIMIZED: Query từ View (bao gồm tất cả thông tin)
    const bookingPost = await BookingPost.getById(postCheck.value);
        // If optimized view didn't return a booking post, try the canonical PostDAL.getById
        // which also attaches Booking info for posts that reference a BookingID.
        if (!bookingPost) {
          try {
            const PostDAL = require('../../DAL/Social/PostDAL');
            const post = await PostDAL.getById(postCheck.value);
            if (post) {
              // Convert post model to frontend-safe JSON if needed (controller helpers will later format)
              return sendSuccess(res, post, 'Booking post details retrieved successfully (fallback from PostDAL)');
            }
          } catch (e) {
            console.debug('bookingPostController.getBookingPost: fallback to PostDAL.getById failed', e?.message || e);
          }

          return sendNotFound(res, 'Booking post not found');
        }

        return sendSuccess(res, bookingPost, 'Booking post details retrieved successfully');
  } catch (error) {
    console.error('Get booking post error:', error);
    return sendError(res, 'Server error getting booking post info', 500, { error: error.message });
  }
}

module.exports = {
  createBookingPost,
  addPlayerFromComment,
  acceptInvitation,
  rejectInvitation,
  getPlayers,
  getPostsBySportType,
  getBookingPost
};
