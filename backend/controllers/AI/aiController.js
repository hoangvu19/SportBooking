/**
 * AI Integration Controller
 * Backend endpoints để sử dụng AI services
 */

const AI = require('../../../AI');
const { sendSuccess, sendError } = require('../../utils/responseHelper');
const { getAccountId } = require('../../utils/requestUtils');

// Import DAL methods
const PostDAL = require('../../DAL/Social/PostDAL');
const BookingDAL = require('../../DAL/Sport/bookingDAL');
const ReactionDAL = require('../../DAL/Social/ReactionDAL');
const FacilityDAL = require('../../DAL/Sport/facilityDAL');
const SportFieldDAL = require('../../DAL/Sport/SportFieldDAL');
const { toVnDateString } = require('../../utils/vnTime');

/**
 * Health check cho AI module
 */
async function healthCheck(req, res) {
  try {
    const health = AI.healthCheck();
    return sendSuccess(res, health);
  } catch (error) {
    console.error('AI health check error:', error);
    return sendError(res, 'AI health check failed', 500, error);
  }
}

/**
 * Get post recommendations
 */
async function getPostRecommendations(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const limit = parseInt(req.query.limit) || 30;

    // TODO: Implement khi có đủ DAL methods
    // Hiện tại return mock data
    const recommendations = [];

    return sendSuccess(res, {
      recommendations,
      count: recommendations.length,
      message: 'Recommendation feature coming soon - need DAL implementation'
    });

  } catch (error) {
    console.error('Error getting post recommendations:', error);
    return sendError(res, 'Failed to generate recommendations', 500, error.message);
  }
}

/**
 * Get facility recommendations
 */
async function getFacilityRecommendations(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const limit = parseInt(req.query.limit) || 20;

    // TODO: Implement khi có đủ DAL methods
    const recommendations = [];

    return sendSuccess(res, {
      recommendations,
      count: recommendations.length,
      message: 'Facility recommendation feature coming soon'
    });

  } catch (error) {
    console.error('Error getting facility recommendations:', error);
    return sendError(res, 'Failed to generate facility recommendations', 500, error.message);
  }
}

/**
 * Clear recommendation cache for user
 */
async function clearCache(req, res) {
  try {
    const accountId = getAccountId(req);
    AI.recommendation.clearCache(accountId || null);
    
    return sendSuccess(res, { message: 'Cache cleared successfully' });
  } catch (error) {
    return sendError(res, 'Failed to clear cache', 500, error);
  }
}

/**
 * Get AI stats (admin only)
 */
async function getStats(req, res) {
  try {
    const stats = {
      moderation: AI.moderation.getStats(),
      recommendation: AI.recommendation.getStats(),
      health: AI.healthCheck()
    };

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Error getting AI stats:', error);
    return sendError(res, 'Failed to get AI stats', 500, error.message);
  }
}

async function testModeration(req, res) {
  try {
    const { text, imageUrls } = req.body;
    
    if (!text && (!imageUrls || imageUrls.length === 0)) {
      return sendError(res, 'text or imageUrls required', 400);
    }

    const result = await AI.moderation.moderate(text || '', imageUrls || []);
    
    return sendSuccess(res, result);
  } catch (error) {
    console.error('Moderation test error:', error);
    return sendError(res, 'Moderation test failed', 500, error.message);
  }
}

/**
 * Get personalized feed (NEW)
 * Kết hợp trending + personalized recommendations
 */
async function getPersonalizedFeed(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const limit = parseInt(req.query.limit) || 10;
    const feedType = req.query.feedType || 'hybrid'; // 'hybrid' | 'trending-first' | 'personalized-only'

    // Build context (TODO: Replace with real DAL calls)
    const context = await buildUserContext(accountId);

    // Generate feed
    const feed = await AI.recommendation.getPersonalizedFeed(
      accountId,
      context,
      limit,
      feedType
    );

    return sendSuccess(res, {
      feed,
      count: feed.length,
      feedType,
      userId: accountId
    });

  } catch (error) {
    console.error('Error getting personalized feed:', error);
    return sendError(res, 'Failed to generate personalized feed', 500, error.message);
  }
}

/**
 * Get trending feed (NEW)
 * Chỉ hiển thị trending items (posts/fields/facilities)
 */
async function getTrendingFeed(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || 'posts'; // 'posts' | 'fields' | 'facilities'

    // Build context
    const context = await buildTrendingContext(type);

    // Get trending items
    const trending = await AI.recommendation.getTrendingFeed(context, limit, type);

    return sendSuccess(res, {
      trending,
      count: trending.length,
      type
    });

  } catch (error) {
    console.error('Error getting trending feed:', error);
    return sendError(res, 'Failed to get trending feed', 500, error.message);
  }
}

/**
 * Get trending fields specifically (NEW)
 * Wrapper cho getTrendingFeed với type='fields'
 */
async function getTrendingFields(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Build context for fields
    const context = await buildTrendingContext('fields');

    // Get trending fields
    const trending = await AI.recommendation.getTrendingFeed(context, limit, 'fields');

    return sendSuccess(res, {
      data: trending, // Changed from 'trending' to 'data' for consistency
      count: trending.length
    });

  } catch (error) {
    console.error('Error getting trending fields:', error);
    return sendError(res, 'Failed to get trending fields', 500, error.message);
  }
}

/**
 * Get field recommendations (NEW)
 * Gợi ý sân cụ thể cho user
 */
async function getFieldRecommendations(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const limit = parseInt(req.query.limit) || 10;
    
    // Filters from query params
    const filters = {
      sportType: req.query.sportType ? parseInt(req.query.sportType) : null,
      priceRange: {
        min: req.query.priceMin ? parseFloat(req.query.priceMin) : null,
        max: req.query.priceMax ? parseFloat(req.query.priceMax) : null
      },
      timeSlot: req.query.timeSlot ? {
        hour: parseInt(req.query.hour) || new Date().getHours(),
        date: req.query.date || toVnDateString()
      } : null
    };

    // User location (optional)
    const location = req.query.lat && req.query.lng ? {
      lat: parseFloat(req.query.lat),
      lng: parseFloat(req.query.lng)
    } : null;

    // Build context
    const context = await buildFieldContext(accountId, filters, location);

    // Get recommendations
    const recommendations = await AI.recommendation.recommendFields(
      accountId,
      context,
      limit
    );

    return sendSuccess(res, {
      recommendations,
      count: recommendations.length,
      filters,
      location
    });

  } catch (error) {
    console.error('Error getting field recommendations:', error);
    return sendError(res, 'Failed to get field recommendations', 500, error.message);
  }
}

/**
 * Helper: Build user context for personalized feed
 */
async function buildUserContext(accountId) {
  try {
    // Get user's historical data from database
    const bookings = await BookingDAL.getUserBookingHistory(accountId);
    const reactions = await ReactionDAL.getUserReactionsWithDetails(accountId);
    const posts = await PostDAL.getUserCreatedPosts(accountId);
    
    // Get available content to recommend from
    const availablePosts = await PostDAL.getAllWithEngagement({ 
      limit: 100, 
      orderBy: 'recent',
      includeEngagement: true 
    });
    
    const availableFields = await SportFieldDAL.getAllFields({ 
      limit: 50, 
      includeBookingStats: false 
    });
    
    const availableFacilities = await FacilityDAL.getAllFacilities({ 
      limit: 50, 
      includeBookingStats: false 
    });
    
    return {
      bookings,
      reactions,
      posts,
      availablePosts,
      availableFields,
      availableFacilities
    };
  } catch (error) {
    console.error('Error building user context:', error);
    // Return empty context on error to prevent recommendation failure
    return {
      bookings: [],
      reactions: [],
      posts: [],
      availablePosts: [],
      availableFields: [],
      availableFacilities: []
    };
  }
}

/**
 * Helper: Build context for trending feed
 */
async function buildTrendingContext(type) {
  try {
    if (type === 'posts') {
      const posts = await PostDAL.getAllWithEngagement({ 
        limit: 100, 
        orderBy: 'recent',
        includeEngagement: true 
      });
      return {
        availablePosts: posts
      };
    } else if (type === 'fields') {
      const fields = await SportFieldDAL.getAllFields({
        limit: 50,
        includeBookingStats: true
      });
      return {
        availableFields: fields
      };
    } else if (type === 'facilities') {
      const facilities = await FacilityDAL.getAllFacilities({
        limit: 50,
        includeBookingStats: true
      });
      return {
        availableFacilities: facilities
      };
    }
    
    return {};
  } catch (error) {
    console.error('Error building trending context:', error);
    return {};
  }
}

/**
 * Helper: Build context for field recommendations
 */
async function buildFieldContext(accountId, filters, location) {
  try {
    // Get user's historical data
    const bookings = await BookingDAL.getUserBookingHistory(accountId);
    const reactions = await ReactionDAL.getUserReactionsWithDetails(accountId);
    const posts = await PostDAL.getUserCreatedPosts(accountId);
    
    // Get available facilities (using Facility table instead of SportField)
    // SportField table may be empty, but Facility table has data
    // getAllFacilities() returns {success, data: [...], pagination}
    const facilitiesResult = await FacilityDAL.getAllFacilities({
      includeBookingStats: true,
      limit: 50
    });
    
    // Extract the actual array from the result
    const facilities = (facilitiesResult && facilitiesResult.data) || [];
    
    // Map facilities to field-like structure for compatibility
    const fields = facilities.map(f => ({
      fieldId: f.facilityId,
      facilityId: f.facilityId,
      fieldName: f.facilityName,
      facilityName: f.facilityName,
      sportTypeId: f.sportTypeId || null,
      sportName: f.sportName || '',
      averageRating: f.averageRating || 0,
      areaId: f.areaId,
      areaName: f.areaName,
      totalBookings: f.totalBookings || 0,
      recentBookings: f.recentBookings || 0
    }));
    
    return {
      bookings,
      reactions,
      posts,
      availableFields: fields,
      location,
      filters
    };
  } catch (error) {
    console.error('Error building field context:', error);
    return {
      bookings: [],
      reactions: [],
      posts: [],
      availableFields: [],
      location,
      filters
    };
  }
}

module.exports = {
  healthCheck,
  getPostRecommendations,
  getFacilityRecommendations,
  clearCache,
  getStats,
  testModeration,
  
  // NEW exports
  getPersonalizedFeed,
  getTrendingFeed,
  getTrendingFields,
  getFieldRecommendations
};
