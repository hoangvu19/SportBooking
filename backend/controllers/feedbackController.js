/**
 * Feedback Controller
 * Handles review and rating operations
 */
const FeedbackModel = require('../models/Feedback');

/**
 * Create new feedback/review
 */
async function createFeedback(req, res) {
  try {
    const { targetType, targetId, content, rating } = req.body;
    const accountId = req.user.AccountID;
    
    // Validate required fields
    if (!targetType || !targetId || !content || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: loại đối tượng, ID, nội dung, điểm số'
      });
    }
    
    // Validate target type
    const validTargetTypes = ['Facility', 'Field', 'Post'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'Loại đối tượng không hợp lệ'
      });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Điểm đánh giá phải từ 1 đến 5'
      });
    }
    
    const result = await FeedbackModel.createFeedback({
      accountId,
      targetType,
      targetId: parseInt(targetId),
      content: content.trim(),
      rating: parseInt(rating)
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Tạo đánh giá thành công',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể tạo đánh giá'
      });
    }
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo đánh giá',
      error: error.message
    });
  }
}

/**
 * Get feedback for a specific target
 */
async function getFeedbackByTarget(req, res) {
  try {
    const { targetType, targetId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const result = await FeedbackModel.getFeedbackByTarget(
      targetType,
      parseInt(targetId),
      parseInt(page),
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách đánh giá thành công',
        data: result.data,
        pagination: result.pagination,
        stats: result.stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách đánh giá'
      });
    }
  } catch (error) {
    console.error('Get feedback by target error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách đánh giá',
      error: error.message
    });
  }
}

/**
 * Get user's feedback
 */
async function getMyFeedback(req, res) {
  try {
    const accountId = req.user.AccountID;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await FeedbackModel.getFeedbackByUser(
      accountId,
      parseInt(page),
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách đánh giá của bạn thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách đánh giá của bạn'
      });
    }
  } catch (error) {
    console.error('Get my feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách đánh giá của bạn',
      error: error.message
    });
  }
}

/**
 * Update feedback
 */
async function updateFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const { content, rating } = req.body;
    const userId = req.user.AccountID;
    
    if (!content || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin nội dung hoặc điểm số'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Điểm đánh giá phải từ 1 đến 5'
      });
    }
    
    const result = await FeedbackModel.updateFeedback(
      parseInt(feedbackId),
      {
        content: content.trim(),
        rating: parseInt(rating)
      },
      userId
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cập nhật đánh giá thành công',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể cập nhật đánh giá'
      });
    }
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật đánh giá',
      error: error.message
    });
  }
}

/**
 * Delete feedback
 */
async function deleteFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const userId = req.user.AccountID;
    const isAdmin = req.user.isAdmin || false;
    
    const result = await FeedbackModel.deleteFeedback(
      parseInt(feedbackId),
      userId,
      isAdmin
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Xóa đánh giá thành công'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Không thể xóa đánh giá'
      });
    }
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa đánh giá',
      error: error.message
    });
  }
}

/**
 * Get rating statistics for a target
 */
async function getRatingStatistics(req, res) {
  try {
    const { targetType, targetId } = req.params;
    
    const result = await FeedbackModel.getRatingStatistics(targetType, parseInt(targetId));
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy thống kê đánh giá thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy thống kê đánh giá'
      });
    }
  } catch (error) {
    console.error('Get rating statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê đánh giá',
      error: error.message
    });
  }
}

/**
 * Get top rated facilities or fields
 */
async function getTopRated(req, res) {
  try {
    const { targetType } = req.params;
    const { areaId, limit = 10 } = req.query;
    
    // Validate target type
    const validTargetTypes = ['Facility', 'Field'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'Loại đối tượng không hợp lệ'
      });
    }
    
    const result = await FeedbackModel.getTopRated(
      targetType,
      areaId ? parseInt(areaId) : null,
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Lấy danh sách đánh giá cao thành công',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách đánh giá cao'
      });
    }
  } catch (error) {
    console.error('Get top rated error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách đánh giá cao',
      error: error.message
    });
  }
}

/**
 * Get feedback by ID
 */
async function getFeedbackById(req, res) {
  try {
    const { feedbackId } = req.params;
    
    const result = await FeedbackModel.getFeedbackById(parseInt(feedbackId));
    
    if (result && result.success) {
      res.json({
        success: true,
        message: 'Lấy thông tin đánh giá thành công',
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
    }
  } catch (error) {
    console.error('Get feedback by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin đánh giá',
      error: error.message
    });
  }
}

module.exports = {
  createFeedback,
  getFeedbackByTarget,
  getMyFeedback,
  updateFeedback,
  deleteFeedback,
  getRatingStatistics,
  getTopRated,
  getFeedbackById
};