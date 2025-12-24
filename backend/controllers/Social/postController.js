const PostDAL = require('../../DAL/Social/PostDAL');
const CommentDAL = require('../../DAL/Social/CommentDAL');
const ReactionDAL = require('../../DAL/Social/ReactionDAL');
const AI = require('../../../AI'); 
const { createNotification } = require('../Notification/notificationController');
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
    const filesProvided = Array.isArray(req.files) && req.files.length > 0;
    const imagesProvided = (Array.isArray(imageUrls) && imageUrls.length > 0) || filesProvided;
    if (isBlank(content) && !imagesProvided) {
      return sendValidationError(res, 'Post content must not be empty');
    }

    const accountId = getAccountId(req);
    if (!accountId) {
      return sendUnauthorized(res, 'Could not identify user to create post');
    }

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

    // Normalize content safely (may be undefined when posting images only)
    const contentSafe = (typeof content === 'string') ? content.trim() : '';

    // 🤖 AI Content Moderation (New AI Module)
    const imageUrlsForModeration = Array.isArray(imageUrls) && imageUrls.length > 0 
      ? imageUrls 
      : (filesProvided ? new Array(req.files.length).fill('file') : []);
    
    const moderationResult = await AI.moderation.moderate(contentSafe, imageUrlsForModeration);
    let forceCreateAsFlagged = false;
    if (moderationResult.decision === 'removed' || moderationResult.recommendedAction === 'remove') {
      // Log the moderation decision. Instead of rejecting the post, create it as Visible
      // but attach moderation metadata so UI can show a red-flag and admins can review.
      await logModeration(null, null, contentSafe, moderationResult);
      forceCreateAsFlagged = true;
    }
    const post = await PostDAL.create({
      AccountID: accountId,
      Content: contentSafe,
      ImageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      BookingID: bookingId || null,
      files: Array.isArray(req.files) ? req.files : [],
      // Create as Visible so it appears in feeds, but keep moderation metadata for the UI to show a red flag.
      Status: 'Visible'
    });
    if (moderationResult.needsReview || moderationResult.decision === 'flagged') {
      await logModeration(post.PostID, null, contentSafe, moderationResult);
      // Post.Status already set above to 'PendingReview' when appropriate
    }

    const baseUrl = buildBaseUrl(req);

  const formattedPost = formatPostForResponse(post, baseUrl);

  // Emit realtime event for new post (namespace-wide broadcast)
  try {
    const emitter = require('../../lib/realtimeEmitter');
    // Only broadcast created posts to the general namespace when they are Visible.
    // PendingReview posts should not appear in public feeds via realtime broadcast.
    if (formattedPost.Status === 'Visible' || formattedPost.status === 'Visible') {
      emitter.emitEvent('post:created', null, { post: formattedPost });
    } else {
      // For pending posts, consider emitting a private/admin notification in future.
      console.debug('post created with PendingReview - skipping public realtime broadcast');
    }
  } catch (e) { console.debug('post:created emit failed', e && e.message); }

  // If the post was created because moderation flagged/removed it, surface that
  // information in the response so the frontend can present a helpful UX.
  const moderationMeta = (moderationResult && (moderationResult.decision || moderationResult.recommendedAction))
    ? {
      decision: moderationResult.decision,
      recommendedAction: moderationResult.recommendedAction,
      reasons: moderationResult.reasons || [],
      severity: moderationResult.severity || null
    }
    : null;

  if (moderationMeta && (moderationMeta.decision === 'flagged' || moderationMeta.recommendedAction === 'remove' || moderationResult.needsReview)) {
    // Attach moderation info to the response data under a non-colliding key so
    // the frontend can render the red-flag UI while the post remains Visible.
    formattedPost.__moderation = moderationMeta;
    return sendCreated(res, formattedPost, 'Post created (flagged)');
  }

  return sendCreated(res, formattedPost, 'Post created successfully');
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

      // Allow deletion if requester is the owner, or if requester is an admin.
      let isAdmin = false;
      try {
        if (req.user && req.user.isAdmin) isAdmin = true;
        else {
          const AccountRoleModel = require('../../models/Auth/AccountRole');
          isAdmin = await AccountRoleModel.hasRoleByName(accountId, 'Admin');
        }
      } catch (e) {
        // If role check fails, default to not admin
        isAdmin = false;
      }

      if (parseInt(existing.AccountID, 10) !== parseInt(accountId, 10) && !isAdmin) {
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

    console.log('📍 Reaction result:', result);

    if (result?.action === 'created') {
      try {
        console.log('💡 Like notification - starting...');
        const post = await PostDAL.getById(idCheck.value);
        console.log('📄 Post found:', post?.PostID, 'Owner:', post?.AccountID);
        
        if (post && post.AccountID && post.AccountID !== accountId) {
          const UserDAL = require('../../DAL/Auth/userDAL');
          const fromUser = await UserDAL.getUserById(accountId);
          console.log('👤 From user:', fromUser?.AccountID, fromUser?.FullName);
          
          if (fromUser) {
            await createNotification({
              recipientId: post.AccountID,
              senderId: accountId,
              type: 'like',
              contentId: idCheck.value,
              content: `${fromUser.FullName || fromUser.Username} liked your post!`
            });
          }
        } else {
          console.log('⏭️ Skipping notification - same user or no post');
        }
      } catch (e) { 
        console.error('❌ Like notification error:', e);
      }
    } else {
      console.log('⏭️ Not a new like, action:', result?.action);
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

  const formattedShared = formatPostForResponse(sharedPost, baseUrl);
  try {
    const emitter = require('../../lib/realtimeEmitter');
    emitter.emitEvent('post:shared', null, { post: formattedShared });
  } catch (e) { console.debug('post:shared emit failed', e && e.message); }

  return sendCreated(res, formattedShared, 'Post shared successfully');
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