/**
 * Feedback Routes
 */
const express = require('express');
const router = express.Router();
const feedbackController = require('../../controllers/Sport/feedbackController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Public routes - list fixed/specific routes first
router.get('/top-rated/:targetType', feedbackController.getTopRated);
router.get('/details/:feedbackId', feedbackController.getFeedbackById);
router.get('/:targetType/:targetId/stats', feedbackController.getRatingStatistics);
// Generic route last to avoid shadowing more specific endpoints
router.get('/:targetType/:targetId', feedbackController.getFeedbackByTarget);

// Protected routes
router.use(authenticateToken);

// User routes
router.post('/', feedbackController.createFeedback);
router.get('/my-feedback', feedbackController.getMyFeedback);
router.put('/:feedbackId', feedbackController.updateFeedback);
router.delete('/:feedbackId', feedbackController.deleteFeedback);

module.exports = router;
