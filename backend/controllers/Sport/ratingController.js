/**
 * Rating Controller
 * Handles star rating operations (1 rating per user per target)
 */
const RatingDAL = require('../../DAL/Sport/RatingDAL');

/**
 * Set or update user's rating for a target
 * User can only have 1 rating per target, calling again will update
 */
async function setRating(req, res) {
  try {
    const { targetType, targetId, rating } = req.body;
    const accountId = req.user.AccountID;
    
    // Validate required fields
    if (!targetType || !targetId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin: loại đối tượng, ID, điểm số'
      });
    }
    
    // Validate target type
    const validTargetTypes = ['Facility', 'Field'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'Loại đối tượng không hợp lệ (chỉ hỗ trợ Facility, Field)'
      });
    }
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Điểm đánh giá phải từ 1 đến 5'
      });
    }
    
    const result = await RatingDAL.setRating({
      accountId,
      targetType,
      targetId: parseInt(targetId),
      rating: parseInt(rating)
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.isUpdate ? 'Cập nhật đánh giá thành công' : 'Đánh giá thành công',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể lưu đánh giá'
      });
    }
  } catch (error) {
    console.error('Set rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lưu đánh giá',
      error: error.message
    });
  }
}

/**
 * Get user's rating for a specific target
 */
async function getMyRating(req, res) {
  try {
    const { targetType, targetId } = req.params;
    const accountId = req.user.AccountID;
    
    const result = await RatingDAL.getUserRating(accountId, targetType, parseInt(targetId));
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data // null if user hasn't rated yet
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy đánh giá của bạn'
      });
    }
  } catch (error) {
    console.error('Get my rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

/**
 * Get rating statistics for a target
 */
async function getRatingStats(req, res) {
  try {
    const { targetType, targetId } = req.params;
    
    const result = await RatingDAL.getRatingStats(targetType, parseInt(targetId));
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy thống kê đánh giá'
      });
    }
  } catch (error) {
    console.error('Get rating stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

/**
 * Delete user's rating
 */
async function deleteRating(req, res) {
  try {
    const { targetType, targetId } = req.params;
    const accountId = req.user.AccountID;
    
    const result = await RatingDAL.deleteRating(accountId, targetType, parseInt(targetId));
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Xóa đánh giá thành công'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể xóa đánh giá'
      });
    }
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

module.exports = {
  setRating,
  getMyRating,
  getRatingStats,
  deleteRating
};
