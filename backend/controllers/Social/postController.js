/**
 * Post Controller - Hoàn toàn mới theo database schema
 */
const PostDAL = require('../../DAL/Social/PostDAL');
const CommentDAL = require('../../DAL/Social/CommentDAL');
const ReactionDAL = require('../../DAL/Social/ReactionDAL');
const moderationService = require('../../lib/contentModeration');
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
  ensurePositiveInteger,
  normalizePagination
} = require('../../utils/requestUtils');
const {
  buildBaseUrl,
  buildPaginationMeta,
  formatPostForResponse,
  formatCommentForResponse,
  normalizeReactionType
} = require('../../utils/controllerHelpers');

/**
 * Create a new post
 */
async function createPost(req, res) {
  try {
    const { content, imageUrls, bookingId } = req.body || {};

    if (isBlank(content)) {
      return sendValidationError(res, 'Nội dung post không được để trống');
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res, 'Không xác định được người dùng để tạo bài viết');
    }

    // Validate booking if provided
    if (bookingId) {
      const BookingDAL = require('../../DAL/Sport/bookingDAL');
      const booking = await BookingDAL.getById(bookingId);
      
      if (!booking) {
        return sendValidationError(res, 'Booking không tồn tại');
      }
      
      if (booking.CustomerID !== accountId) {
        return sendUnauthorized(res, 'Không có quyền tạo post cho booking này');
      }
    }

    // AI Content Moderation
    const moderationResult = await moderationService.moderatePost(content.trim(), imageUrls || []);
    
    if (!moderationResult.isClean) {
      // Từ chối bài đăng
      await logModeration(null, null, content, moderationResult);
      return sendValidationError(res, moderationResult.reason || 'Nội dung vi phạm quy định cộng đồng');
    }

    const post = await PostDAL.create({
      AccountID: accountId,
      Content: content.trim(),
      ImageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      BookingID: bookingId || null
    });

    // Log moderation nếu cần review
    if (moderationResult.needsReview) {
      await logModeration(post.PostID, null, content, moderationResult);
      // Có thể đặt post status = 'PendingReview' nếu muốn
    }

    const baseUrl = buildBaseUrl(req);

    return sendCreated(res, formatPostForResponse(post, baseUrl), 'Tạo post thành công');
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      number: error.number,
      stack: error.stack
    });
    return sendError(res, 'Lỗi server khi tạo post', 500, { 
      error: error.message,
      code: error.code 
    });
  }
}

/**
 * Get feed posts
 */
async function getFeedPosts(req, res) {
  try {
    const { page, limit } = normalizePagination(req.query, { page: 1, limit: 10 });
    const baseUrl = buildBaseUrl(req);

    const result = await PostDAL.getFeedPosts(page, limit);
    const { posts, hasMore } = result;
    const formattedPosts = posts.map((post) => formatPostForResponse(post, baseUrl));

    return sendSuccess(res, {
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        hasMore
      }
    });
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy feed posts', 500, { error });
  }
}

/**
 * Get posts by user
 */
async function getUserPosts(req, res) {
  try {
    const { userId } = req.params;
    const idCheck = ensurePositiveInteger(userId, 'userId');

    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const { page, limit } = normalizePagination(req.query, { page: 1, limit: 10 });
    const baseUrl = buildBaseUrl(req);

    const posts = await PostDAL.getByUserId(idCheck.value, page, limit);
    const formattedPosts = posts.map((post) => formatPostForResponse(post, baseUrl));

    return sendSuccess(res, {
      posts: formattedPosts,
      pagination: buildPaginationMeta(posts.length, limit, page)
    });
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy posts của người dùng', 500, { error });
  }
}

/**
 * Get post by ID
 */
async function getPostById(req, res) {
  try {
    const { postId } = req.params;
    const idCheck = ensurePositiveInteger(postId, 'postId');

    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const post = await PostDAL.getById(idCheck.value, true);

    if (!post) {
      return sendNotFound(res, 'Post không tồn tại');
    }

    const baseUrl = buildBaseUrl(req);

    return sendSuccess(res, formatPostForResponse(post, baseUrl));
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy thông tin post', 500, { error });
  }
}

/**
 * Update post
 */
async function updatePost(req, res) {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (isBlank(content)) {
      return sendValidationError(res, 'Nội dung post không được để trống');
    }

    const idCheck = ensurePositiveInteger(postId, 'postId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const existing = await PostDAL.getById(idCheck.value);
    if (!existing) {
      return sendNotFound(res, 'Post không tồn tại');
    }

    if (parseInt(existing.AccountID, 10) !== parseInt(accountId, 10)) {
      return sendUnauthorized(res, 'Bạn không có quyền sửa bài viết này');
    }

    const updatedPost = await PostDAL.update(idCheck.value, { Content: content.trim() });

    if (!updatedPost) {
      return sendError(res, 'Không thể cập nhật bài viết', 500);
    }

    const baseUrl = buildBaseUrl(req);

    return sendSuccess(res, formatPostForResponse(updatedPost, baseUrl), 'Cập nhật post thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi cập nhật post', 500, { error });
  }
}

/**
 * Delete post
 */
async function deletePost(req, res) {
  try {
    const { postId } = req.params;
    const idCheck = ensurePositiveInteger(postId, 'postId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const existing = await PostDAL.getById(idCheck.value);
    if (!existing) {
      return sendNotFound(res, 'Post không tồn tại');
    }

    if (parseInt(existing.AccountID, 10) !== parseInt(accountId, 10)) {
      return sendUnauthorized(res, 'Bạn không có quyền xóa bài viết này');
    }

    const success = await PostDAL.delete(idCheck.value);

    if (!success) {
      return sendError(res, 'Không thể xóa bài viết', 500);
    }

    return sendSuccess(res, null, 'Xóa post thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi xóa post', 500, { error });
  }
}

/**
 * Add reaction to post
 */
async function reactToPost(req, res) {
  try {
    const { postId } = req.params;
    const { reactionType } = req.body;

    const idCheck = ensurePositiveInteger(postId, 'postId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const normalizedReaction = normalizeReactionType(reactionType);
    if (!normalizedReaction) {
      return sendValidationError(res, 'Loại reaction không hợp lệ');
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const result = await ReactionDAL.createOrUpdate({
      AccountID: accountId,
      PostID: idCheck.value,
      ReactionType: normalizedReaction
    });

    // Gửi thông báo nếu là like mới
    if (result?.action === 'created') {
      try {
        const PostDAL = require('../../DAL/Social/PostDAL');
        const notifications = require('../../lib/notifications');
        const post = await PostDAL.getById(idCheck.value);
        if (post && post.AccountID && post.AccountID !== accountId) {
          const UserDAL = require('../../DAL/Auth/userDAL');
          const fromUser = await UserDAL.getUserById(accountId);
          if (fromUser) {
            const notify = {
              type: 'like',
              postId: idCheck.value,
              fromUser: {
                id: fromUser.AccountID,
                fullName: fromUser.FullName,
                username: fromUser.Username,
                avatar: fromUser.AvatarUrl
              },
              message: `${fromUser.FullName || fromUser.Username} đã thích bài viết của bạn!`,
              link: `/post/${idCheck.value}`,
              createdAt: new Date(),
              read: false
            };
            if (!notifications[post.AccountID]) notifications[post.AccountID] = [];
            notifications[post.AccountID].unshift(notify);
          }
        }
      } catch (e) { /* ignore */ }
    }

    const messageByAction = {
      created: 'React thành công',
      updated: 'Cập nhật reaction thành công',
      removed: 'Đã bỏ reaction'
    };

    return sendSuccess(res, result, messageByAction[result?.action] || 'Xử lý reaction thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi react', 500, { error });
  }
}

/**
 * Remove reaction from post
 */
async function removeReaction(req, res) {
  try {
    const { postId } = req.params;
    const idCheck = ensurePositiveInteger(postId, 'postId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const existingReaction = await ReactionDAL.getUserReaction(accountId, idCheck.value);

    if (!existingReaction) {
      return sendNotFound(res, 'Không tìm thấy reaction để xóa');
    }

    await ReactionDAL.delete(existingReaction.ReactionID);

    return sendSuccess(res, { reactionId: existingReaction.ReactionID }, 'Bỏ react thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi bỏ react', 500, { error });
  }
}

/**
 * Add comment to post
 */
async function addComment(req, res) {
  try {
    const { postId } = req.params;
    const { content, imageUrls } = req.body;

    if (isBlank(content)) {
      return sendValidationError(res, 'Nội dung comment không được để trống');
    }

    const postCheck = ensurePositiveInteger(postId, 'postId');
    if (!postCheck.ok) {
      return sendValidationError(res, postCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const comment = await CommentDAL.create({
      PostID: postCheck.value,
      AccountID: accountId,
      Content: content.trim()
    });

    if (!comment) {
      return sendError(res, 'Không thể tạo comment', 500);
    }

    const images = Array.isArray(imageUrls) ? imageUrls : [];
    if (images.length > 0) {
      const insertedImages = await CommentDAL.addImages(comment.CommentID, images);
      comment.Images = insertedImages;
    }

    // Gửi thông báo cho chủ post khi có comment mới
    try {
      const PostDAL = require('../../DAL/Social/PostDAL');
      const notifications = require('../../lib/notifications');
      const post = await PostDAL.getById(postCheck.value);
      if (post && post.AccountID && post.AccountID !== accountId) {
        const UserDAL = require('../../DAL/Auth/userDAL');
        const fromUser = await UserDAL.getUserById(accountId);
        if (fromUser) {
          const notify = {
            type: 'comment',
            postId: postCheck.value,
            commentId: comment.CommentID,
            fromUser: {
              id: fromUser.AccountID,
              fullName: fromUser.FullName,
              username: fromUser.Username,
              avatar: fromUser.AvatarUrl
            },
            message: `${fromUser.FullName || fromUser.Username} đã bình luận bài viết của bạn!`,
            link: `/post/${postCheck.value}`,
            createdAt: new Date(),
            read: false
          };
          if (!notifications[post.AccountID]) notifications[post.AccountID] = [];
          notifications[post.AccountID].unshift(notify);
        }
      }
    } catch (e) { /* ignore */ }

    const baseUrl = buildBaseUrl(req);

    return sendCreated(res, formatCommentForResponse(comment, baseUrl), 'Tạo comment thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi tạo comment', 500, { error });
  }
}

/**
 * Get comments for a post
 */
async function getPostComments(req, res) {
  try {
    const { postId } = req.params;
    const idCheck = ensurePositiveInteger(postId, 'postId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const { page, limit } = normalizePagination(req.query, { page: 1, limit: 20 });
    const baseUrl = buildBaseUrl(req);

    const comments = await CommentDAL.getByPostId(idCheck.value, page, limit);
    const formattedComments = comments.map((comment) => formatCommentForResponse(comment, baseUrl));

    return sendSuccess(res, {
      comments: formattedComments,
      pagination: buildPaginationMeta(comments.length, limit, page)
    });
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy comments', 500, { error });
  }
}

/**
 * Update comment
 */
async function updateComment(req, res) {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (isBlank(content)) {
      return sendValidationError(res, 'Nội dung comment không được để trống');
    }

    const idCheck = ensurePositiveInteger(commentId, 'commentId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const isOwner = await CommentDAL.isOwner(idCheck.value, accountId);
    if (!isOwner) {
      return sendUnauthorized(res, 'Comment không tồn tại hoặc bạn không có quyền sửa');
    }

    const updatedComment = await CommentDAL.update(idCheck.value, content.trim());
    const baseUrl = buildBaseUrl(req);

    return sendSuccess(res, formatCommentForResponse(updatedComment, baseUrl), 'Cập nhật comment thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi cập nhật comment', 500, { error });
  }
}

/**
 * Delete comment
 */
async function deleteComment(req, res) {
  try {
    const { commentId } = req.params;
    const idCheck = ensurePositiveInteger(commentId, 'commentId');
    if (!idCheck.ok) {
      return sendValidationError(res, idCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const isOwner = await CommentDAL.isOwner(idCheck.value, accountId);
    if (!isOwner) {
      return sendUnauthorized(res, 'Comment không tồn tại hoặc bạn không có quyền xóa');
    }

    await CommentDAL.delete(idCheck.value);

    return sendSuccess(res, null, 'Xóa comment thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi xóa comment', 500, { error });
  }
}

/**
 * Share post
 */
async function sharePost(req, res) {
  try {
    const { postId: postIdFromBody, note } = req.body || {};
    const rawPostId = postIdFromBody ?? req.params?.postId;

    const postCheck = ensurePositiveInteger(rawPostId, 'postId');
    if (!postCheck.ok) {
      return sendValidationError(res, postCheck.message);
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res);
    }

    const sharedPost = await PostDAL.createSharePost({
      accountId,
      originalPostId: postCheck.value,
      note: isBlank(note) ? null : note
    });

    if (!sharedPost) {
      return sendError(res, 'Không thể chia sẻ post', 500);
    }

    const baseUrl = buildBaseUrl(req);

    return sendCreated(res, formatPostForResponse(sharedPost, baseUrl), 'Chia sẻ post thành công');
  } catch (error) {
    if (error && error.code === 'ORIGINAL_NOT_FOUND') {
      return sendNotFound(res, 'Bài viết gốc không tồn tại');
    }

    return sendError(res, 'Lỗi server khi chia sẻ post', 500, {
      error,
      details: { code: error?.code || 'INTERNAL_ERROR' }
    });
  }
}

/**
 * Helper: Log moderation result
 */
async function logModeration(postId, commentId, content, moderationResult) {
  try {
    const { poolPromise, sql } = require('../../config/db');
    const pool = await poolPromise;
    
    await pool.request()
      .input('PostID', sql.Int, postId)
      .input('CommentID', sql.Int, commentId)
      .input('Content', sql.NVarChar, content)
      .input('IsClean', sql.Bit, moderationResult.isClean)
      .input('Confidence', sql.Decimal(3, 2), moderationResult.confidence)
      .input('Reason', sql.NVarChar, moderationResult.reason)
      .input('NeedsReview', sql.Bit, moderationResult.needsReview)
      .input('Flags', sql.NVarChar, JSON.stringify(moderationResult.flags))
      .query(`
        INSERT INTO ContentModerationLog 
        (PostID, CommentID, Content, IsClean, Confidence, Reason, NeedsReview, Flags)
        VALUES (@PostID, @CommentID, @Content, @IsClean, @Confidence, @Reason, @NeedsReview, @Flags)
      `);
  } catch (error) {
    console.error('Error logging moderation:', error);
    // Don't throw error, just log
  }
}

module.exports = {
  createPost,
  getFeedPosts,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  reactToPost,
  removeReaction,
  addComment,
  getPostComments,
  updateComment,
  deleteComment,
  sharePost
};