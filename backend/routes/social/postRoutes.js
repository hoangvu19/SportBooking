const express = require('express');
const router = express.Router();
const {
  createPost,
  getFeedPosts,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost
} = require('../../controllers/Social/postController');
const { authenticateToken } = require('../../middleware/auth');

// Create new post
router.post('/', authenticateToken, createPost);

// Get feed posts
router.get('/feed', getFeedPosts);

// Get user posts
router.get('/user/:userId', getUserPosts);

// Get single post
router.get('/:postId', getPostById);

// Update post
router.put('/:postId', authenticateToken, updatePost);

// Delete post
router.delete('/:postId', authenticateToken, deletePost);

module.exports = router;
