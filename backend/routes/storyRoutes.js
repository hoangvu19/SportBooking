const express = require('express');
const router = express.Router();
const {
  createStory,
  getActiveStories,
  getUserStories,
  deleteStory,
  viewStory,
  getStoryViewers,
  getStoryViewCount
} = require('../controllers/storyController');
const { authenticateToken } = require('../middleware/auth');
const { uploadStoryMedia } = require('../middleware/upload');

// Create new story (authenticated, with file upload)
router.post('/', authenticateToken, uploadStoryMedia, createStory);

// Get all active stories
router.get('/', getActiveStories);

// Get stories by user
router.get('/user/:userId', getUserStories);

// Record story view (authenticated)
router.post('/:storyId/view', authenticateToken, viewStory);

// Get story viewers list (authenticated, owner only)
router.get('/:storyId/viewers', authenticateToken, getStoryViewers);

// Get story view count (public)
router.get('/:storyId/views/count', getStoryViewCount);

// Delete story (authenticated, owner only)
router.delete('/:storyId', authenticateToken, deleteStory);

module.exports = router;
