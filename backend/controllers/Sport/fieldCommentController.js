/**
 * Field Comment Controller
 * Handles comment operations for fields (multiple comments allowed per user)
 */
const FieldCommentDAL = require('../../DAL/Sport/FieldCommentDAL');

/**
 * Create new comment
 * Users can post multiple comments
 */
async function createComment(req, res) {
  try {
    const { targetType, targetId, content } = req.body;
    const accountId = req.user.AccountID;
    
    // Validate required fields
    if (!targetType || !targetId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing information: target type, ID, content'
      });
    }
    
    // Validate target type
    const validTargetTypes = ['Facility', 'Field'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid target type (only supports Facility, Field)'
      });
    }
    
    // Validate content
    if (!content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment content must not be empty'
      });
    }
    
    const result = await FieldCommentDAL.createComment({
      accountId,
      targetType,
      targetId: parseInt(targetId),
      content: content.trim()
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Comment submitted successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Unable to submit comment'
      });
    }
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting comment',
      error: error.message
    });
  }
}

/**
 * Get comments for a target
 */
async function getComments(req, res) {
  try {
    const { targetType, targetId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await FieldCommentDAL.getComments(
      targetType,
      parseInt(targetId),
      parseInt(page),
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unable to fetch comments list'
      });
    }
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}

/**
 * Update comment (only owner can update)
 */
async function updateComment(req, res) {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const accountId = req.user.AccountID;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment content must not be empty'
      });
    }
    
    const result = await FieldCommentDAL.updateComment(
      parseInt(commentId),
      content.trim(),
      accountId
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Comment updated successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Unable to update comment'
      });
    }
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}

/**
 * Delete comment
 */
async function deleteComment(req, res) {
  try {
    const { commentId } = req.params;
    const accountId = req.user.AccountID;
    const isAdmin = req.user.isAdmin || false;
    
    const result = await FieldCommentDAL.deleteComment(
      parseInt(commentId),
      accountId,
      isAdmin
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Unable to delete comment'
      });
    }
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}

/**
 * Get user's own comments
 */
async function getMyComments(req, res) {
  try {
    const accountId = req.user.AccountID;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await FieldCommentDAL.getMyComments(
      accountId,
      parseInt(page),
      parseInt(limit)
    );
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unable to fetch your comments list'
      });
    }
  } catch (error) {
    console.error('Get my comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

module.exports = {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  getMyComments
};
