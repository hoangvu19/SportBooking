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
        message: 'Missing information: target type, ID, rating'
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
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
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
        message: result.isUpdate ? 'Rating updated successfully' : 'Rating submitted successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Unable to save rating'
      });
    }
  } catch (error) {
    console.error('Set rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving rating',
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
        message: 'Unable to fetch your rating'
      });
    }
  } catch (error) {
    console.error('Get my rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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
        message: 'Unable to fetch rating statistics'
      });
    }
  } catch (error) {
    console.error('Get rating stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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
        message: 'Rating deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Unable to delete rating'
      });
    }
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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
