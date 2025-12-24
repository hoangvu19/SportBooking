/**
 * AI Module Main Entry Point
 * Export tất cả AI services
 */

const moderationEngine = require('./moderation/engine');
const recommendationEngine = require('./recommendation/engine');
const config = require('./config');
const logger = require('./utils/logger');
const TextAnalyzer = require('./utils/textAnalyzer');
// VN timestamp helper for AI health
let toVnIso = null;
try { toVnIso = require('../backend/utils/vnTime').toVnIso; } catch (e) { /* ignore */ }

// Initialize silently
if (process.env.DEBUG_AI === 'true') {
  logger.info('AI-Module', 'AI Module initialized', {
    moderation: moderationEngine.getStats(),
    recommendation: recommendationEngine.getStats()
  });
}

module.exports = {
  // Moderation
  moderation: {
    moderate: (text, images) => moderationEngine.moderate(text, images),
    getStats: () => moderationEngine.getStats()
  },

  // Recommendation
  recommendation: {
    recommendPosts: (userId, context, limit) => 
      recommendationEngine.recommendPosts(userId, context, limit),
    recommendFacilities: (userId, context, limit) => 
      recommendationEngine.recommendFacilities(userId, context, limit),
    recommendFields: (userId, context, limit) => 
      recommendationEngine.recommendFields(userId, context, limit),
    
    // NEW: Personalized Feed (trending + personalized)
    getPersonalizedFeed: (userId, context, limit, feedType) =>
      recommendationEngine.getPersonalizedFeed(userId, context, limit, feedType),
    
    // NEW: Trending Feed
    getTrendingFeed: (context, limit, type) =>
      recommendationEngine.getTrendingFeed(context, limit, type),
    
    clearCache: (userId) => recommendationEngine.clearCache(userId),
    getStats: () => recommendationEngine.getStats()
  },

  // Utilities
  utils: {
    TextAnalyzer,
    logger
  },

  // Config
  config,

  // Health check
  healthCheck: () => {
    return {
      status: 'healthy',
  timestamp: (typeof toVnIso === 'function') ? toVnIso() : new Date().toISOString().replace('Z', '+07:00'),
      modules: {
        moderation: 'active',
        recommendation: 'active'
      },
      stats: {
        moderation: moderationEngine.getStats(),
        recommendation: recommendationEngine.getStats()
      }
    };
  }
};
