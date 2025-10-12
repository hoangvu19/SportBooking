const express = require('express');
const router = express.Router();
const {
  createPost,
  getFeedPosts,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost
} = require('../controllers/postController');
const { authenticateToken } = require('../middleware/auth');

// Create new post
router.post('/', authenticateToken, createPost);

// Get feed posts - PHẢI ĐẶT TRƯỚC /:postId
router.get('/feed', getFeedPosts);

// Get user posts - PHẢI ĐẶT TRƯỚC /:postId
router.get('/user/:userId', getUserPosts);

// Get single post - ĐẶT SAU các route cụ thể
router.get('/:postId', getPostById);

// Update post
router.put('/:postId', authenticateToken, updatePost);

// Delete post
router.delete('/:postId', authenticateToken, deletePost);

module.exports = router;