/**
 * Reaction Controller - Xử lý các thao tác với reactions (like, love, etc.)
 */
const ReactionDAL = require('../DAL/ReactionDAL');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendNotFound
} = require('../utils/responseHelper');
const {
  getAccountId,
  ensurePositiveInteger,
  toAbsoluteUrl
} = require('../utils/requestUtils');
const {
  normalizeReactionType,
  buildBaseUrl
} = require('../utils/controllerHelpers');

class ReactionController {
  /**
   * Tạo hoặc cập nhật reaction
   */
  static async createOrUpdateReaction(req, res) {
    try {
      const { postId, reactionType } = req.body || {};
      const accountId = getAccountId(req);

      const idCheck = ensurePositiveInteger(postId, 'postId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      if (!accountId) {
        return sendUnauthorized(res);
      }

      const normalizedReaction = normalizeReactionType(reactionType);
      if (!normalizedReaction) {
        return sendValidationError(res, 'ReactionType phải là một trong: Like, Love, Haha, Wow, Sad, Angry');
      }

      const result = await ReactionDAL.createOrUpdate({
        AccountID: accountId,
        PostID: idCheck.value,
        ReactionType: normalizedReaction
      });

      const messageByAction = {
        created: 'Đã thêm reaction',
        updated: 'Đã cập nhật reaction',
        removed: 'Đã bỏ reaction'
      };

      const payload = {
        success: true,
        data: result,
        message: messageByAction[result?.action] || 'Xử lý reaction thành công'
      };

      return result?.action === 'created'
        ? sendCreated(res, payload.data, payload.message)
        : sendSuccess(res, payload.data, payload.message);
    } catch (error) {
      return sendError(res, 'Lỗi server khi tạo reaction', 500, { error });
    }
  }

  /**
   * Lấy reactions của một post
   */
  static async getPostReactions(req, res) {
    try {
      const { postId } = req.params;
      const idCheck = ensurePositiveInteger(postId, 'postId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      const [reactions, counts] = await Promise.all([
        ReactionDAL.getByPostId(idCheck.value),
        ReactionDAL.getCountsByPostId(idCheck.value)
      ]);

      const baseUrl = buildBaseUrl(req);
      const formatted = reactions.map((reaction) => {
        const data = reaction.toFrontendFormat();
        if (data?.user?.avatar_url) {
          data.user.avatar_url = toAbsoluteUrl(baseUrl, data.user.avatar_url);
        }
        return data;
      });

      return sendSuccess(res, {
        reactions: formatted,
        counts,
        total: formatted.length
      });
    } catch (error) {
      return sendError(res, 'Lỗi server khi lấy reactions', 500, { error });
    }
  }

  /**
   * Lấy số lượng reactions theo loại
   */
  static async getReactionCounts(req, res) {
    try {
      const { postId } = req.params;
      const idCheck = ensurePositiveInteger(postId, 'postId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      const counts = await ReactionDAL.getCountsByPostId(idCheck.value);

      return sendSuccess(res, counts);
    } catch (error) {
      return sendError(res, 'Lỗi server khi lấy reaction counts', 500, { error });
    }
  }

  /**
   * Lấy reaction của user cho một post
   */
  static async getUserReaction(req, res) {
    try {
      const { postId } = req.params;
      const accountId = getAccountId(req);
      const idCheck = ensurePositiveInteger(postId, 'postId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      if (!accountId) {
        return sendUnauthorized(res);
      }

      const reaction = await ReactionDAL.getUserReaction(accountId, idCheck.value);

      const baseUrl = buildBaseUrl(req);
      const formatted = reaction ? reaction.toFrontendFormat() : null;
      if (formatted?.user?.avatar_url) {
        formatted.user.avatar_url = toAbsoluteUrl(baseUrl, formatted.user.avatar_url);
      }

      return sendSuccess(res, formatted);
    } catch (error) {
      return sendError(res, 'Lỗi server khi lấy user reaction', 500, { error });
    }
  }

  /**
   * Xóa reaction
   */
  static async deleteReaction(req, res) {
    try {
      const { postId } = req.params;
      const accountId = getAccountId(req);
      const idCheck = ensurePositiveInteger(postId, 'postId');
      if (!idCheck.ok) {
        return sendValidationError(res, idCheck.message);
      }

      if (!accountId) {
        return sendUnauthorized(res);
      }

      const userReaction = await ReactionDAL.getUserReaction(accountId, idCheck.value);

      if (!userReaction) {
        return sendNotFound(res, 'Không tìm thấy reaction để xóa');
      }

      await ReactionDAL.delete(userReaction.ReactionID);

      return sendSuccess(res, null, 'Đã xóa reaction thành công');
    } catch (error) {
      return sendError(res, 'Lỗi server khi xóa reaction', 500, { error });
    }
  }

  /**
   * Lấy tất cả reactions của user
   */
  static async getUserReactions(req, res) {
    try {
      const accountId = getAccountId(req);
      if (!accountId) {
        return sendUnauthorized(res);
      }

      const reactions = await ReactionDAL.getByAccountId(accountId);
      const baseUrl = buildBaseUrl(req);
      const formatted = reactions.map((reaction) => {
        const data = reaction.toFrontendFormat();
        if (data?.user?.avatar_url) {
          data.user.avatar_url = toAbsoluteUrl(baseUrl, data.user.avatar_url);
        }
        return data;
      });

      return sendSuccess(res, formatted);
    } catch (error) {
      return sendError(res, 'Lỗi server khi lấy user reactions', 500, { error });
    }
  }
}

module.exports = ReactionController;