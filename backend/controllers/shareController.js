/**
 * Share Controller - Xử lý các thao tác chia sẻ bài viết
 */
const ShareModel = require('../models/Share');

class ShareController {
  /**
   * Chia sẻ bài viết
   */
  static async createShare(req, res) {
    try {
      const { postId, note } = req.body;
      const accountId = req.user.AccountID;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: 'PostID là bắt buộc'
        });
      }

      // Kiểm tra xem đã chia sẻ chưa
      const hasShared = await ShareModel.hasUserSharedPost(accountId, postId);
      if (hasShared) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã chia sẻ bài viết này rồi'
        });
      }

      const result = await ShareModel.createShare({
        accountId,
        postId,
        note
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Lỗi tạo share:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi chia sẻ bài viết'
      });
    }
  }

  /**
   * Lấy danh sách shares của một post
   */
  static async getPostShares(req, res) {
    try {
      const { postId } = req.params;
      const shares = await ShareModel.getSharesByPostId(postId);
      
      res.json({
        success: true,
        data: shares
      });
    } catch (error) {
      console.error('Lỗi lấy post shares:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách shares'
      });
    }
  }

  /**
   * Lấy danh sách bài viết đã chia sẻ của user
   */
  static async getUserShares(req, res) {
    try {
      const accountId = req.user.AccountID;
      const shares = await ShareModel.getSharesByAccountId(accountId);
      
      res.json({
        success: true,
        data: shares
      });
    } catch (error) {
      console.error('Lỗi lấy user shares:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách shares của user'
      });
    }
  }

  /**
   * Lấy số lượng shares của một post
   */
  static async getShareCount(req, res) {
    try {
      const { postId } = req.params;
      const count = await ShareModel.getShareCount(postId);
      
      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Lỗi lấy share count:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy số lượng shares'
      });
    }
  }

  /**
   * Xóa share
   */
  static async deleteShare(req, res) {
    try {
      const { postId } = req.params;
      const accountId = req.user.AccountID;
      
      const success = await ShareModel.deleteShareByAccountAndPost(accountId, postId);
      
      if (success) {
        res.json({
          success: true,
          message: 'Đã hủy chia sẻ thành công'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Không tìm thấy share để xóa'
        });
      }
    } catch (error) {
      console.error('Lỗi xóa share:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi xóa share'
      });
    }
  }

  /**
   * Kiểm tra user đã share post chưa
   */
  static async checkUserShared(req, res) {
    try {
      const { postId } = req.params;
      const accountId = req.user.AccountID;
      
      const hasShared = await ShareModel.hasUserSharedPost(accountId, postId);
      
      res.json({
        success: true,
        data: { hasShared }
      });
    } catch (error) {
      console.error('Lỗi kiểm tra share:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi kiểm tra share status'
      });
    }
  }
}

module.exports = ShareController;