/**
 * AI Routes
 * API endpoints cho AI services
 */

const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/AI/aiController');
const { authenticateToken, optionalAuth } = require('../../middleware/auth');

// Health check (public)
router.get('/health', aiController.healthCheck);

// Recommendations (Legacy)
router.get('/recommendations/posts', authenticateToken, aiController.getPostRecommendations);
router.get('/recommendations/facilities', authenticateToken, aiController.getFacilityRecommendations);

// NEW: Personalized Feed API
router.get('/feed/personalized', authenticateToken, aiController.getPersonalizedFeed);
router.get('/feed/trending', aiController.getTrendingFeed); // Public - no auth needed

// NEW: Field Recommendations
router.get('/fields/trending', aiController.getTrendingFields); // Public - trending fields
router.get('/fields/recommendations', authenticateToken, aiController.getFieldRecommendations); // Personalized
router.get('/recommendations/fields', authenticateToken, aiController.getFieldRecommendations); // Legacy endpoint

// Cache management
router.post('/recommendations/clear-cache', authenticateToken, aiController.clearCache);

// Stats
router.get('/stats', authenticateToken, aiController.getStats);

// Test moderation
router.post('/moderation/test', aiController.testModeration);

module.exports = router;
