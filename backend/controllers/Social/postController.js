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
      return sendValidationError(res, 'Post content must not be empty');
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res, 'Could not identify user to create post');
    }

    // Validate booking if provided
    if (bookingId) {
      const BookingDAL = require('../../DAL/Sport/bookingDAL');
      const booking = await BookingDAL.getById(bookingId);
      
      if (!booking) {
        return sendValidationError(res, 'Booking does not exist');
      }
      
      if (booking.CustomerID !== accountId) {
        return sendUnauthorized(res, 'Not authorized to create post for this booking');
      }
    }

    // AI Content Moderation
    const moderationResult = await moderationService.moderatePost(content.trim(), imageUrls || []);
    
    if (!moderationResult.isClean) {
      // Reject post
      await logModeration(null, null, content, moderationResult);
      return sendValidationError(res, moderationResult.reason || 'Content violates community guidelines');
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

  return sendCreated(res, formatPostForResponse(post, baseUrl), 'Post created successfully');
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      number: error.number,
      stack: error.stack
    });
    return sendError(res, 'Server error creating post', 500, { 
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
  return sendError(res, 'Server error fetching feed posts', 500, { error });
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
  return sendError(res, 'Server error fetching user posts', 500, { error });
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
      return sendNotFound(res, 'Post not found');
    }

    const baseUrl = buildBaseUrl(req);

    return sendSuccess(res, formatPostForResponse(post, baseUrl));
  } catch (error) {
  return sendError(res, 'Server error fetching post details', 500, { error });
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
      return sendValidationError(res, 'Post content must not be empty');
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
      return sendNotFound(res, 'Post not found');
    }

    if (parseInt(existing.AccountID, 10) !== parseInt(accountId, 10)) {
      return sendUnauthorized(res, 'You are not authorized to edit this post');
    }

    const updatedPost = await PostDAL.update(idCheck.value, { Content: content.trim() });

    if (!updatedPost) {
      return sendError(res, 'Unable to update post', 500);
    }

    const baseUrl = buildBaseUrl(req);

  return sendSuccess(res, formatPostForResponse(updatedPost, baseUrl), 'Post updated successfully');
  } catch (error) {
  return sendError(res, 'Server error updating post', 500, { error });
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
      return sendNotFound(res, 'Post not found');
    }

    if (parseInt(existing.AccountID, 10) !== parseInt(accountId, 10)) {
      return sendUnauthorized(res, 'You are not authorized to delete this post');
    }

    const success = await PostDAL.delete(idCheck.value);

    if (!success) {
      return sendError(res, 'Unable to delete post', 500);
    }

    return sendSuccess(res, null, 'Post deleted successfully');
  } catch (error) {
  return sendError(res, 'Server error deleting post', 500, { error });
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
      return sendValidationError(res, 'Invalid reaction type');
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
              message: `${fromUser.FullName || fromUser.Username} liked your post!`,
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
      created: 'Reaction added',
      updated: 'Reaction updated successfully',
      removed: 'Reaction removed'
    };

    return sendSuccess(res, result, messageByAction[result?.action] || 'Reaction processed successfully');
  } catch (error) {
  return sendError(res, 'Server error reacting to post', 500, { error });
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
      return sendNotFound(res, 'Reaction to delete not found');
    }

    await ReactionDAL.delete(existingReaction.ReactionID);

  return sendSuccess(res, { reactionId: existingReaction.ReactionID }, 'Reaction removed successfully');
  } catch (error) {
  return sendError(res, 'Server error removing reaction', 500, { error });
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
      return sendValidationError(res, 'Comment content must not be empty');
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
      return sendError(res, 'Unable to create comment', 500);
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
            message: `${fromUser.FullName || fromUser.Username} commented on your post!`,
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

  return sendCreated(res, formatCommentForResponse(comment, baseUrl), 'Comment created successfully');
  } catch (error) {
  return sendError(res, 'Server error creating comment', 500, { error });
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
  return sendError(res, 'Server error fetching comments', 500, { error });
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
      return sendValidationError(res, 'Comment content must not be empty');
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
      return sendUnauthorized(res, 'Comment not found or you do not have permission to edit');
    }

    const updatedComment = await CommentDAL.update(idCheck.value, content.trim());
    const baseUrl = buildBaseUrl(req);

  return sendSuccess(res, formatCommentForResponse(updatedComment, baseUrl), 'Comment updated successfully');
  } catch (error) {
  return sendError(res, 'Server error updating comment', 500, { error });
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
      return sendUnauthorized(res, 'Comment not found or you do not have permission to delete');
    }

    await CommentDAL.delete(idCheck.value);

  return sendSuccess(res, null, 'Comment deleted successfully');
  } catch (error) {
  return sendError(res, 'Server error deleting comment', 500, { error });
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
      return sendError(res, 'Unable to share post', 500);
    }

    const baseUrl = buildBaseUrl(req);

  return sendCreated(res, formatPostForResponse(sharedPost, baseUrl), 'Post shared successfully');
  } catch (error) {
    if (error && error.code === 'ORIGINAL_NOT_FOUND') {
      return sendNotFound(res, 'Original post not found');
    }

    return sendError(res, 'Server error sharing post', 500, {
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