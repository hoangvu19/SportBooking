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

    let imagesToSave = Array.isArray(imageUrls) ? imageUrls : [];
    if (req.file && req.file.filename) {
      const imageUrl = `/uploads/posts/${req.file.filename}`;
      imagesToSave = [...imagesToSave, imageUrl];
    }

    // If client sent a facilityImageUrl (frontend may include it when user didn't upload a file),
    // use it as the post image so the booking post shows the facility picture.
    try {
      const facilityImageUrl = req.body?.facilityImageUrl || req.body?.facilityimageurl || req.body?.facility_image_url;
      if ((!imagesToSave || imagesToSave.length === 0) && facilityImageUrl) {
        imagesToSave = [...imagesToSave, facilityImageUrl];
      }
    } catch (ex) {
      // ignore
    }

    // If still no images provided, attempt server-side auto-attach:
    // Find the facility for this booking and use its first media asset (if any) as the post image.
    if ((!imagesToSave || imagesToSave.length === 0)) {
      try {
        // bookingModel returns { success, data: Booking }
        const bookingRes = await BookingModel.getBookingById(bookingCheck.value);
        const fieldId = bookingRes && bookingRes.success && bookingRes.data ? (bookingRes.data.FieldID || bookingRes.data.field?.FieldID) : null;
        if (fieldId) {
          const SportFieldDAL = require('../../DAL/Sport/SportFieldDAL');
          const fieldRes = await SportFieldDAL.getSportFieldById(fieldId);
          const facilityId = fieldRes && fieldRes.success && fieldRes.data ? (fieldRes.data.FacilityID || fieldRes.data.facilityId || fieldRes.data.FacilityId) : null;
          if (facilityId) {
            const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');
            const facMedia = await MediaAssetDAL.getByTarget('Facility', facilityId);
            if (Array.isArray(facMedia) && facMedia.length > 0) {
              const firstUrl = (facMedia.map(r => r.URL || r.Data).filter(Boolean) || [])[0];
              if (firstUrl) {
                imagesToSave = [...imagesToSave, firstUrl];
              }
            }
          }
        }
      } catch (autoEx) {
        // Non-fatal - if anything goes wrong, continue without images
        console.debug('createBookingPost: auto-attach facility image failed', autoEx?.message || autoEx);
      }
    }

    const result = await BookingPost.createBookingPost({
      accountId,
      bookingId: bookingCheck.value,
      content: content.trim(),
      sportTypeId,
      maxPlayers: maxPlayers || 10,
      images: imagesToSave
    });

    const fullBookingPost = await BookingPost.getById(result.postId);
    const payload = { bookingPost: fullBookingPost, PostID: result.postId };
    try {
      const emitter = require('../../lib/realtimeEmitter');
      emitter.emitEvent('bookingpost:created', null, payload);
      // Also emit a generic post:created event for backwards compatibility so
      // clients that only listen for 'post:created' (the feed's original event)
      // will also receive the new booking post without needing a reload.
      try {
        const formattedPost = {
          _id: result.postId,
          PostID: result.postId,
          content: fullBookingPost.content || fullBookingPost.Content || '',
          createdAt: fullBookingPost.createdAt || fullBookingPost.CreatedDate || new Date(),
          image_urls: fullBookingPost.ImageUrls || fullBookingPost.image_urls || fullBookingPost.imageUrls || [],
          media_urls: fullBookingPost.media_urls || fullBookingPost.mediaUrls || [],
          user: fullBookingPost.user || fullBookingPost.Owner || null,
          booking: fullBookingPost,
          BookingID: fullBookingPost.BookingID || fullBookingPost.bookingId || null,
        };
        emitter.emitEvent('post:created', null, { post: formattedPost });
      } catch (e2) { console.debug('bookingpost: post:created emit failed', e2 && e2.message); }
    } catch (e) { console.debug('bookingpost:created emit failed', e && e.message); }

    return sendCreated(res, payload, 'Booking post created successfully');
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
    let bookingPost = await BookingPost.getById(postCheck.value);

    // If optimized view didn't return a booking post, try the canonical PostDAL.getById
    // which also attaches Booking info and media for posts that reference a BookingID.
    if (!bookingPost) {
      try {
        const PostDAL = require('../../DAL/Social/PostDAL');
        const post = await PostDAL.getById(postCheck.value);
        if (post) {
          // Return the PostDAL representation which already includes images/booking
          return sendSuccess(res, post, 'Booking post details retrieved successfully (fallback from PostDAL)');
        }
      } catch (e) {
        console.debug('bookingPostController.getBookingPost: fallback to PostDAL.getById failed', e?.message || e);
      }

      return sendNotFound(res, 'Booking post not found');
    }

    // Enrich bookingPost with media assets: post images and facility's primary image when available
    try {
      const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');

      // Post images
      try {
        const postMedia = await MediaAssetDAL.getByTarget('Post', postCheck.value);
        if (Array.isArray(postMedia) && postMedia.length > 0) {
          bookingPost.ImageUrls = postMedia.map(r => r.URL || r.Data).filter(Boolean);
        } else {
          bookingPost.ImageUrls = bookingPost.ImageUrls || [];
        }
      } catch (e) {
        bookingPost.ImageUrls = bookingPost.ImageUrls || [];
        console.debug('bookingPostController.getBookingPost: could not load Post media', e?.message || e);
      }

      // Facility primary image (if facility id present)
      try {
        const facilityId = bookingPost.FacilityID || bookingPost.FacilityId || null;
        if (facilityId) {
          const facMedia = await MediaAssetDAL.getByTarget('Facility', facilityId);
          if (Array.isArray(facMedia) && facMedia.length > 0) {
            bookingPost.FacilityImage = facMedia.map(r => r.URL || r.Data).filter(Boolean)[0] || null;
            bookingPost.FacilityImages = facMedia.map(r => r.URL || r.Data).filter(Boolean);
          }
        }
      } catch (e) {
        console.debug('bookingPostController.getBookingPost: could not load Facility media', e?.message || e);
      }
    } catch (e) {
      console.debug('bookingPostController.getBookingPost: media enrichment failed', e?.message || e);
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
