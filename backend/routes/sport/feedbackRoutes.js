/**
 * Feedback Routes
 */
const express = require('express');
const router = express.Router();
const feedbackController = require('../../controllers/Sport/feedbackController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Public routes
router.get('/:targetType/:targetId', feedbackController.getFeedbackByTarget);
router.get('/:targetType/:targetId/stats', feedbackController.getRatingStatistics);
router.get('/top-rated/:targetType', feedbackController.getTopRated);
router.get('/details/:feedbackId', feedbackController.getFeedbackById);

// Protected routes
router.use(authenticateToken);

// User routes
router.post('/', feedbackController.createFeedback);
router.get('/my-feedback', feedbackController.getMyFeedback);
router.put('/:feedbackId', feedbackController.updateFeedback);
router.delete('/:feedbackId', feedbackController.deleteFeedback);

module.exports = router;
