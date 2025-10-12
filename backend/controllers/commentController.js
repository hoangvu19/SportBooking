/**
 * Comment Controller - Xử lý logic cho comments
 */
const CommentDAL = require('../DAL/CommentDAL');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized
} = require('../utils/responseHelper');
const {
  isBlank,
  getAccountId,
  ensurePositiveInteger,
  normalizePagination
} = require('../utils/requestUtils');
const {
  buildBaseUrl,
  buildPaginationMeta,
  formatCommentForResponse
} = require('../utils/controllerHelpers');

const CommentController = {
  /**
   * Get comments by post ID
   */
  async getCommentsByPost(req, res) {
    try {
      const { postId } = req.params;
      const idCheck = ensurePositiveInteger(postId, 'postId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      const { page, limit } = normalizePagination(req.query, { page: 1, limit: 20 });
      const baseUrl = buildBaseUrl(req);

      const comments = await CommentDAL.getByPostId(idCheck.value, page, limit);
      const formatted = comments.map((comment) => formatCommentForResponse(comment, baseUrl));

      return sendSuccess(res, {
        comments: formatted,
        pagination: buildPaginationMeta(comments.length, limit, page)
      });
    } catch (error) {
      return sendError(res, 'Lỗi server khi lấy comments', 500, { error });
    }
  },

  /**
   * Create new comment
   */
  async createComment(req, res) {
    try {
      const { postId, content, parentCommentId } = req.body || {};
      const accountId = getAccountId(req);
      const files = req.files || [];

      const postCheck = ensurePositiveInteger(postId, 'postId');
      if (!postCheck.ok) {
        return sendValidationError(res, postCheck.message);
      }

      if (isBlank(content) && files.length === 0) {
        return sendValidationError(res, 'PostID và Content hoặc ảnh là bắt buộc');
      }

      if (!accountId) {
        return sendUnauthorized(res);
      }

      if (!isBlank(parentCommentId)) {
        const parentCheck = ensurePositiveInteger(parentCommentId, 'parentCommentId');
        if (!parentCheck.ok) {
          return sendValidationError(res, parentCheck.message);
        }
      }

      const payload = {
        PostID: postCheck.value,
        AccountID: accountId,
        Content: isBlank(content) ? '' : content.trim()
      };

      if (!isBlank(parentCommentId)) {
        payload.ParentCommentID = parseInt(parentCommentId, 10);
      }

      const created = await CommentDAL.createWithImages(payload, files);
      // Gửi thông báo cho chủ post hoặc chủ comment nếu là reply
      try {
        const PostDAL = require('../DAL/PostDAL');
        const notifications = require('../lib/notifications');
        if (payload.ParentCommentID) {
          // Là reply, gửi cho chủ comment cha
          const parentComment = await CommentDAL.getById(payload.ParentCommentID);
          if (parentComment && parentComment.AccountID && parentComment.AccountID !== accountId) {
            const UserDAL = require('../DAL/userDAL');
            const fromUser = await UserDAL.getUserById(accountId);
            if (fromUser) {
              const notify = {
                type: 'reply',
                postId: payload.PostID,
                commentId: created.CommentID,
                parentCommentId: payload.ParentCommentID,
                fromUser: {
                  id: fromUser.AccountID,
                  fullName: fromUser.FullName,
                  username: fromUser.Username,
                  avatar: fromUser.AvatarUrl
                },
                message: `${fromUser.FullName || fromUser.Username} đã trả lời bình luận của bạn!`,
                link: `/post/${payload.PostID}?comment=${payload.ParentCommentID}`,
                createdAt: new Date(),
                read: false
              };
              if (!notifications[parentComment.AccountID]) notifications[parentComment.AccountID] = [];
              notifications[parentComment.AccountID].unshift(notify);
            }
          }
        } else {
          // Là comment mới, gửi cho chủ post
          const post = await PostDAL.getById(payload.PostID);
          if (post && post.AccountID && post.AccountID !== accountId) {
            const UserDAL = require('../DAL/userDAL');
            const fromUser = await UserDAL.getUserById(accountId);
            if (fromUser) {
              const notify = {
                type: 'comment',
                postId: payload.PostID,
                commentId: created.CommentID,
                fromUser: {
                  id: fromUser.AccountID,
                  fullName: fromUser.FullName,
                  username: fromUser.Username,
                  avatar: fromUser.AvatarUrl
                },
                message: `${fromUser.FullName || fromUser.Username} đã bình luận bài viết của bạn!`,
                link: `/post/${payload.PostID}`,
                createdAt: new Date(),
                read: false
              };
              if (!notifications[post.AccountID]) notifications[post.AccountID] = [];
              notifications[post.AccountID].unshift(notify);
            }
          }
        }
      } catch (e) { /* ignore */ }
      const baseUrl = buildBaseUrl(req);
      return sendCreated(res, formatCommentForResponse(created, baseUrl), 'Tạo comment thành công');
    } catch (error) {
      return sendError(res, 'Lỗi server khi tạo comment', 500, { error });
    }
  },

  async getCommentById(req, res) {
    try {
      const { commentId } = req.params;
      const idCheck = ensurePositiveInteger(commentId, 'commentId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      const comment = await CommentDAL.getById(idCheck.value);
      if (!comment) {
        return sendNotFound(res, 'Comment không tồn tại');
      }

      const baseUrl = buildBaseUrl(req);
      return sendSuccess(res, formatCommentForResponse(comment, baseUrl));
    } catch (error) {
      return sendError(res, 'Lỗi server khi lấy comment', 500, { error });
    }
  },

  async updateComment(req, res) {
    try {
      const { commentId } = req.params;
      const { content } = req.body || {};
      const accountId = getAccountId(req);

      if (isBlank(content)) {
        return sendValidationError(res, 'Nội dung comment không được để trống');
      }

      const idCheck = ensurePositiveInteger(commentId, 'commentId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

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
  },

  async deleteComment(req, res) {
    try {
      const { commentId } = req.params;
      const accountId = getAccountId(req);

      const idCheck = ensurePositiveInteger(commentId, 'commentId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

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
};

module.exports = CommentController;