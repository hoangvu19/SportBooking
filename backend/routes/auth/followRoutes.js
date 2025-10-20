const express = require('express');
const router = express.Router();
const FollowController = require('../../controllers/Auth/followController');
const { authenticateToken } = require('../../middleware/auth');

// Protected follow routes
router.get('/followers', authenticateToken, FollowController.getFollowers);
router.get('/following', authenticateToken, FollowController.getFollowing);
router.post('/follow/:userId', authenticateToken, FollowController.followUser);
router.delete('/unfollow/:userId', authenticateToken, FollowController.unfollowUser);

module.exports = router;
