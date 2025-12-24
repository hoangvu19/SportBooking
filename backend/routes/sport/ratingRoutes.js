/**
 * Rating Routes
 * Routes for star ratings (1 rating per user per target)
 */
const express = require('express');
const router = express.Router();
const ratingController = require('../../controllers/Sport/ratingController');
const { authenticateToken } = require('../../middleware/auth');

// Public routes
router.get('/stats/:targetType/:targetId', ratingController.getRatingStats);

// Protected routes
router.use(authenticateToken);

// Set or update rating (POST method can create or update)
router.post('/', ratingController.setRating);

// Get user's own rating for a target
router.get('/my-rating/:targetType/:targetId', ratingController.getMyRating);

// Delete user's rating
router.delete('/:targetType/:targetId', ratingController.deleteRating);

module.exports = router;
